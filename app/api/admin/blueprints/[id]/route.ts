/**
 * /api/admin/blueprints/:id (só admin) — editar ou apagar um blueprint da vitrine da landing.
 *  PATCH  { ...campos que mudam } ⇒ { blueprint }   (inclui ligar/desligar `published`)
 *  DELETE                         ⇒ { ok: true }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { OID, validarBlueprint } from "@/lib/landing/blueprints";

const negado = (status: 401 | 403) => NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status });
const naoAchado = () => NextResponse.json({ error: "not_found" }, { status: 404 });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const a = await assertAdmin();
  if (!a.ok) return negado(a.status);
  if (!OID.test(params.id)) return naoAchado();
  const v = validarBlueprint(await req.json().catch(() => null), true);
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });
  const r = await prisma.blueprint.updateMany({ where: { id: params.id }, data: v.dados });
  if (r.count === 0) return naoAchado();
  const blueprint = await prisma.blueprint.findUnique({ where: { id: params.id } });
  return NextResponse.json({ blueprint });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const a = await assertAdmin();
  if (!a.ok) return negado(a.status);
  if (!OID.test(params.id)) return naoAchado();
  const r = await prisma.blueprint.deleteMany({ where: { id: params.id } });
  return r.count === 0 ? naoAchado() : NextResponse.json({ ok: true });
}
