/**
 * POST /api/tcc/:id/edit { secaoId?, op, corpo?, titulo?, aposId?, origem? }
 * POST /api/tcc/:id/edit { tituloDoc }  → renomeia o trabalho (o título da folha)
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
  // Renomear o TRABALHO (o título da folha): { tituloDoc } sem op — não mexe em seção nenhuma.
  if (body && typeof body === "object" && body.op === undefined && typeof body.tituloDoc === "string") {
    const titulo = body.tituloDoc.replace(/\s+/g, " ").trim();
    if (!titulo) return NextResponse.json({ error: "Título vazio" }, { status: 400 });
    const r = await aplicarNoTcc(params.id, a.userId, [], "aluno", { titulo });
    if (!r.ok) return respostaDeRecusa(r.reason, r.detalhe);
    return NextResponse.json({ tcc: r.tcc, efeitos: [] });
  }
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
