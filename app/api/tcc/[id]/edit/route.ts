/**
 * POST /api/tcc/:id/edit { secaoId?, op, corpo?, titulo?, aposId?, origem? }
 *   origem "estudos" | "aluno" (padrão) → APLICA direto (última vence; o anterior vai pro histórico)
 *   origem "pesquisa"                    → vira SUGESTÃO (o aluno aceita/rejeita; nunca muda em silêncio)
 * A edição com IA da Sala de Pesquisa (com fonte verificada) é POST /api/tcc/:id/revisar.
 */
import { NextResponse } from "next/server";
import { entrarTcc, respostaDeRecusa } from "@/lib/tcc/route-auth";
import { aplicarNoTcc, sugerirNoTcc } from "@/lib/tcc/store";
import { isOpTipo, isOrigem, isSecaoId, type OpSecao } from "@/lib/tcc/secoes";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await entrarTcc(req, "tcc-edit");
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !isOpTipo(body.op)) {
    return NextResponse.json({ error: "Operação inválida" }, { status: 400 });
  }
  const origem = isOrigem(body.origem) ? body.origem : "aluno";
  const op: OpSecao = {
    op: body.op,
    ...(isSecaoId(body.secaoId) ? { secaoId: body.secaoId } : {}),
    ...(typeof body.corpo === "string" ? { corpo: body.corpo } : {}),
    ...(typeof body.titulo === "string" ? { titulo: body.titulo } : {}),
    ...(isSecaoId(body.aposId) ? { aposId: body.aposId } : {}),
  };
  if (origem === "pesquisa") {
    const r = await sugerirNoTcc(params.id, a.userId, [op]);
    if (!r.ok) return respostaDeRecusa(r.reason);
    if (!r.revisoes.length) return respostaDeRecusa("invalid", "nada a sugerir");
    return NextResponse.json({ sugestoes: r.revisoes }, { status: 201 });
  }
  const r = await aplicarNoTcc(params.id, a.userId, [op], origem);
  if (!r.ok) return respostaDeRecusa(r.reason, r.detalhe);
  return NextResponse.json({ tcc: r.tcc, efeitos: r.efeitos });
}
