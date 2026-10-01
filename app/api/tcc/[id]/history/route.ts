/**
 * GET  /api/tcc/:id/history          → { revisoes }  (timeline, mais recente primeiro; o cliente agrupa por seção)
 * POST /api/tcc/:id/history { revId } → desfaz: restaura a seção como estava ANTES daquela revisão
 *   (vira revisão nova, origem "aluno" — última vence e nada se perde).
 */
import { NextResponse } from "next/server";
import { entrarTcc, respostaDeRecusa } from "@/lib/tcc/route-auth";
import { desfazerRevisao, historicoDoTcc } from "@/lib/tcc/store";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const a = await entrarTcc(req, "tcc-get");
  if ("response" in a) return a.response;
  const revisoes = await historicoDoTcc(params.id, a.userId);
  if (!revisoes) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ revisoes });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await entrarTcc(req, "tcc-edit");
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => null);
  if (typeof body?.revId !== "string") return NextResponse.json({ error: "Informe revId" }, { status: 400 });
  const r = await desfazerRevisao(params.id, body.revId, a.userId);
  if (!r.ok) return respostaDeRecusa(r.reason, r.detalhe);
  return NextResponse.json({ tcc: r.tcc, efeitos: r.efeitos });
}
