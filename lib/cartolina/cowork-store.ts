/**
 * Banco do coworking: membros, convite e comentários. Tudo passa por `getBoardForUser`
 * (papel derivado) antes de ler/escrever — mesma regra anti-IDOR do store.
 */
import { prisma } from "@/src/lib/prisma";
import { getBoardForUser } from "@/lib/cartolina/store";
import { podeAdministrar, podeEscrever, type Papel, type PapelConvidavel } from "@/lib/cartolina/access";
import { criarConvite, lerConvite, novoSal } from "@/lib/cartolina/convite";

export const cartolinaCoworkOn = () => process.env.CARTOLINA_COWORK === "1";
const isObjectId = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{24}$/i.test(v);

type Falha = { ok: false; reason: "not_found" | "forbidden" | "invalid" };

/** Só o dono gera link. Reusa o sal existente (links anteriores seguem válidos). */
export async function gerarLink(boardId: string, userId: string, papel: PapelConvidavel): Promise<{ ok: true; token: string } | Falha> {
  const b = await getBoardForUser(boardId, userId);
  if (!b) return { ok: false, reason: "not_found" };
  if (!podeAdministrar(b.papel)) return { ok: false, reason: "forbidden" };
  const row = await prisma.cartolina.findUnique({ where: { id: boardId }, select: { conviteSalt: true } });
  let sal = row?.conviteSalt;
  if (!sal) {
    sal = novoSal();
    await prisma.cartolina.update({ where: { id: boardId }, data: { conviteSalt: sal } });
  }
  return { ok: true, token: criarConvite(boardId, papel, sal) };
}

/** Revoga TODOS os links (troca o sal). Quem já entrou continua membro. */
export async function revogarLinks(boardId: string, userId: string): Promise<{ ok: true } | Falha> {
  const b = await getBoardForUser(boardId, userId);
  if (!b) return { ok: false, reason: "not_found" };
  if (!podeAdministrar(b.papel)) return { ok: false, reason: "forbidden" };
  await prisma.cartolina.update({ where: { id: boardId }, data: { conviteSalt: novoSal() } });
  return { ok: true };
}

const PESO: Record<Papel, number> = { leitor: 1, editor: 2, dono: 3 };

/**
 * Entrar pelo link. Idempotente. Nunca rebaixa: um editor que abre um link de leitor
 * continua editor; o dono abrindo o próprio link não vira membro.
 */
export async function entrarPorConvite(boardId: string, userId: string, token: unknown): Promise<{ ok: true; papel: Papel } | Falha> {
  if (!isObjectId(boardId)) return { ok: false, reason: "not_found" };
  const conv = lerConvite(token, boardId);
  if (!conv) return { ok: false, reason: "invalid" };
  const row = await prisma.cartolina.findUnique({ where: { id: boardId }, select: { ownerId: true, conviteSalt: true } });
  if (!row) return { ok: false, reason: "not_found" };
  if (!row.conviteSalt || row.conviteSalt !== conv.sal) return { ok: false, reason: "invalid" }; // revogado
  if (row.ownerId === userId) return { ok: true, papel: "dono" };
  const atual = await prisma.cartolinaMembro.findUnique({ where: { cartolinaId_userId: { cartolinaId: boardId, userId } } });
  if (atual && PESO[atual.papel as Papel] >= PESO[conv.papel]) return { ok: true, papel: atual.papel as Papel };
  await prisma.cartolinaMembro.upsert({
    where: { cartolinaId_userId: { cartolinaId: boardId, userId } },
    create: { cartolinaId: boardId, userId, papel: conv.papel },
    update: { papel: conv.papel },
  });
  return { ok: true, papel: conv.papel };
}

export type MembroView = { userId: string; nome: string; imagem: string | null; papel: Papel };

/** Dono + membros, com nome/avatar (sem e-mail: não expõe contato de ninguém). */
export async function listarMembros(boardId: string, userId: string): Promise<{ ok: true; membros: MembroView[] } | Falha> {
  const b = await getBoardForUser(boardId, userId);
  if (!b) return { ok: false, reason: "not_found" };
  const row = await prisma.cartolina.findUnique({ where: { id: boardId }, select: { ownerId: true } });
  const ms = await prisma.cartolinaMembro.findMany({ where: { cartolinaId: boardId }, select: { userId: true, papel: true }, take: 100 });
  const ids = [row!.ownerId, ...ms.map((m) => m.userId)];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, image: true } });
  const u = new Map(users.map((x) => [x.id, x]));
  const view = (id: string, papel: Papel): MembroView => ({ userId: id, nome: u.get(id)?.name || "Colega", imagem: u.get(id)?.image ?? null, papel });
  return { ok: true, membros: [view(row!.ownerId, "dono"), ...ms.map((m) => view(m.userId, m.papel as Papel))] };
}

/** Remove um membro (só o dono; o dono não se remove). */
export async function removerMembro(boardId: string, userId: string, alvo: unknown): Promise<{ ok: true } | Falha> {
  const b = await getBoardForUser(boardId, userId);
  if (!b) return { ok: false, reason: "not_found" };
  if (!podeAdministrar(b.papel)) return { ok: false, reason: "forbidden" };
  if (!isObjectId(alvo)) return { ok: false, reason: "invalid" };
  await prisma.cartolinaMembro.deleteMany({ where: { cartolinaId: boardId, userId: alvo } });
  return { ok: true };
}

// ── Comentários ─────────────────────────────────────────────────────────────────────────
export const MAX_COMENTARIO = 2000;
export type ComentarioView = { id: string; cardId: string; userId: string; nome: string; imagem: string | null; texto: string; parentId: string | null; createdAt: Date };

export async function listarComentarios(boardId: string, userId: string, desde?: Date): Promise<{ ok: true; comentarios: ComentarioView[] } | Falha> {
  const b = await getBoardForUser(boardId, userId);
  if (!b) return { ok: false, reason: "not_found" };
  const rows = await prisma.cartolinaComentario.findMany({
    where: { cartolinaId: boardId, ...(desde ? { createdAt: { gt: desde } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { id: true, name: true, image: true } });
  const u = new Map(users.map((x) => [x.id, x]));
  return {
    ok: true,
    comentarios: rows.map((r) => ({
      id: r.id, cardId: r.cardId, userId: r.userId, nome: u.get(r.userId)?.name || "Colega", imagem: u.get(r.userId)?.image ?? null,
      texto: r.texto, parentId: r.parentId ?? null, createdAt: r.createdAt,
    })),
  };
}

/** Comentar/responder: dono/editor. Resposta só vale se o pai for do MESMO board e card. */
export async function comentar(boardId: string, userId: string, input: { cardId: unknown; texto: unknown; parentId?: unknown }):
  Promise<{ ok: true; id: string } | Falha> {
  const b = await getBoardForUser(boardId, userId);
  if (!b) return { ok: false, reason: "not_found" };
  if (!podeEscrever(b.papel)) return { ok: false, reason: "forbidden" };
  const cardId = typeof input.cardId === "string" ? input.cardId : "";
  const texto = typeof input.texto === "string" ? input.texto.trim().slice(0, MAX_COMENTARIO) : "";
  if (!texto || !b.cards.some((c) => c.id === cardId)) return { ok: false, reason: "invalid" };
  let parentId: string | null = null;
  if (input.parentId != null) {
    if (!isObjectId(input.parentId)) return { ok: false, reason: "invalid" };
    const pai = await prisma.cartolinaComentario.findFirst({ where: { id: input.parentId, cartolinaId: boardId, cardId }, select: { id: true, parentId: true } });
    if (!pai) return { ok: false, reason: "invalid" };
    parentId = pai.parentId ?? pai.id; // thread de UM nível: resposta de resposta pendura na raiz
  }
  const c = await prisma.cartolinaComentario.create({ data: { cartolinaId: boardId, cardId, userId, texto, parentId }, select: { id: true } });
  return { ok: true, id: c.id };
}
