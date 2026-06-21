import { clientPromise } from "@/src/lib/db";
import { ObjectId } from "mongodb";

/**
 * purgeUser — apaga uma conta DE VERDADE (reset fresh).
 *
 * Remove o User + TODOS os dados ligados a ele + os registros de auth do NextAuth
 * (`accounts`, `sessions`). Apagar o `accounts` é o que garante que o PRÓXIMO login
 * Google crie uma conta NOVA, sem resquício da antiga (o adapter relinka pelo
 * providerAccountId; sem o accounts, ele cria do zero).
 *
 * Varredura genérica: para cada coleção, apaga docs cujas chaves de "dono"
 * (userId/ownerId/authorId/sender/receiver/teacher/student…) batam com este usuário.
 * Assim cobre study_spaces, study_items, scholar, chats, posts, mensagens, convites,
 * etc. — inclusive coleções futuras — sem precisar listar uma a uma.
 */
const OWNER_KEYS = [
  "userId", "ownerId", "authorId", "senderId", "receiverId",
  "fromUserId", "toUserId", "fromId", "toId", "teacherId", "studentId", "createdBy",
];

export interface PurgeResult { ok: boolean; reason?: string; id?: string; email?: string; removed?: number }

export async function purgeUser(opts: { id?: string; email?: string }): Promise<PurgeResult> {
  const client = await clientPromise;
  const db = client.db();

  // resolve o usuário (por id ou email)
  let userDoc: any = null;
  if (opts.id && ObjectId.isValid(opts.id)) {
    userDoc = await db.collection("users").findOne({ _id: new ObjectId(opts.id) });
  }
  if (!userDoc && opts.email) {
    userDoc = await db.collection("users").findOne({ email: opts.email.toLowerCase() });
  }
  if (!userDoc) return { ok: false, reason: "not_found" };

  const oid: ObjectId = userDoc._id;
  const id = oid.toString();
  const email = (userDoc.email || "").toLowerCase();
  let removed = 0;

  // 1) varredura genérica por chaves de dono em TODAS as coleções
  let cols: { name: string }[] = [];
  try { cols = await db.listCollections().toArray() as any; } catch { cols = []; }
  for (const c of cols) {
    if (c.name === "users") continue; // o user em si é apagado por último
    const or: any[] = [];
    for (const k of OWNER_KEYS) { or.push({ [k]: oid }); or.push({ [k]: id }); }
    try {
      const r = await db.collection(c.name).deleteMany({ $or: or });
      removed += r.deletedCount || 0;
    } catch { /* coleção sem esses campos → ignora */ }
  }

  // 2) auth do NextAuth (garante login fresh) + convites que ele é dono
  try { await db.collection("accounts").deleteMany({ userId: oid }); } catch { /* ignore */ }
  try { await db.collection("sessions").deleteMany({ userId: oid }); } catch { /* ignore */ }
  try { await db.collection("invite_codes").deleteMany({ ownerId: oid }); } catch { /* ignore */ }

  // 3) por fim, o próprio usuário
  try { const r = await db.collection("users").deleteOne({ _id: oid }); removed += r.deletedCount || 0; } catch { /* ignore */ }

  return { ok: true, id, email, removed };
}
