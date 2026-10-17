/**
 * POST /api/canal/sino { acao: "visto" | "limpar" } — o sino do escritório guardado no BANCO (#425), um
 * registro por pessoa (CanalSino):
 *   "visto"  → abriu o sino agora: a bolinha passa a contar só os pendentes e o que chegar depois.
 *   "limpar" → tira do sino o que já foi respondido até agora (pendentes ficam) — e também conta como visto.
 * Só mexe no registro de quem está logado. Regras em lib/canal/sino.ts.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, sessaoUsuario, exigirFlag } from "@/lib/canal/server";
import { acaoDoSino, estadoDoSino } from "@/lib/canal/sino";

export async function POST(req: Request): Promise<NextResponse> {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const acao = acaoDoSino(body?.acao);
  if (!acao) return NextResponse.json({ error: "Ação inválida (visto ou limpar)." }, { status: 400 });

  const agora = new Date();
  const dados = acao === "limpar" ? { vistoEm: agora, limpoAte: agora } : { vistoEm: agora };
  const r = await prisma.canalSino.upsert({ where: { userId: u.id }, create: { userId: u.id, ...dados }, update: dados });
  return NextResponse.json({ ok: true, sino: estadoDoSino(r) });
}
