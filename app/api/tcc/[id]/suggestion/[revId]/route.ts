/**
 * POST /api/tcc/:id/suggestion/:revId { aceitar: boolean }
 *   aceitar → a sugestão da Pesquisa é aplicada (vira "aplicada"; fontes vão pra REFERÊNCIAS)
 *   rejeitar → "rejeitada" (fica no histórico; o documento não muda)
 */
import { NextResponse } from "next/server";
import { entrarTcc, respostaDeRecusa } from "@/lib/tcc/route-auth";
import { decidirSugestao } from "@/lib/tcc/store";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string; revId: string } }) {
  const a = await entrarTcc(req, "tcc-suggestion");
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.aceitar !== "boolean") return NextResponse.json({ error: "Informe aceitar: true|false" }, { status: 400 });
  const r = await decidirSugestao(params.id, params.revId, a.userId, body.aceitar);
  if (!r.ok) return respostaDeRecusa(r.reason);
  return NextResponse.json({ tcc: r.tcc, revisao: r.revisao });
}
