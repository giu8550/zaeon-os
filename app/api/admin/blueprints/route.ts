/**
 * /api/admin/blueprints (só admin) — a vitrine de blueprints da landing (lib/landing/blueprints).
 *  GET  ⇒ { blueprints } (todos, rascunhos inclusive; por `order`)
 *  POST { title, description?, imageUrl?, href?, tags?, published?, order? } ⇒ 201 { blueprint }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { validarBlueprint } from "@/lib/landing/blueprints";

const negado = (status: 401 | 403) => NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status });

export async function GET() {
  const a = await assertAdmin();
  if (!a.ok) return negado(a.status);
  const blueprints = await prisma.blueprint.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json({ blueprints });
}

export async function POST(req: Request) {
  const a = await assertAdmin();
  if (!a.ok) return negado(a.status);
  const v = validarBlueprint(await req.json().catch(() => null), false);
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });
  const blueprint = await prisma.blueprint.create({ data: v.dados });
  return NextResponse.json({ blueprint }, { status: 201 });
}
