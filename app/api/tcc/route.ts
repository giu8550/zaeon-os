/**
 * GET  /api/tcc?scopeId=           → { tcc: { id, titulo, status } | null }  (o TCC da conversa)
 * POST /api/tcc { topic, scopeId } → { workId }  (cria do tópico e escreve em BACKGROUND; poll no GET /:id)
 * TCC cross-sala (Estudos cria/edita · Pesquisa lapida). Docs: docs/HANDOFF_TCC_CROSS_SALA.md. Atrás de TCC_CROSS=1.
 */
import { NextResponse } from "next/server";
import { sanitizeScopeId } from "@/lib/cartolina/route-auth";
import { entrarTcc } from "@/lib/tcc/route-auth";
import { criarTcc, findTccDoEscopo } from "@/lib/tcc/store";
import { ESQUELETO_TCC } from "@/lib/tcc/secoes";
import { gerarTccEmBackground } from "@/lib/tcc/gerar";
import { fixarCardTcc } from "@/lib/tcc/turno";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const a = await entrarTcc(req, "tcc-get");
  if ("response" in a) return a.response;
  const scopeId = sanitizeScopeId(new URL(req.url).searchParams.get("scopeId"));
  if (!scopeId) return NextResponse.json({ tcc: null });
  const t = await findTccDoEscopo(a.userId, scopeId);
  return NextResponse.json({ tcc: t ? { id: t.id, titulo: t.titulo, status: t.status } : null });
}

export async function POST(req: Request) {
  const a = await entrarTcc(req, "tcc-post", "ai-heavy"); // dispara geração com LLM → balde pesado
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => ({}));
  const topic = typeof body?.topic === "string" ? body.topic.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  if (!topic) return NextResponse.json({ error: "Informe o tema do TCC." }, { status: 400 });
  const scopeId = sanitizeScopeId(body?.scopeId);

  // Um TCC por conversa: duplo-clique/reload devolve o que já existe (sem gastar modelo).
  if (scopeId) {
    const existente = await findTccDoEscopo(a.userId, scopeId);
    if (existente) return NextResponse.json({ workId: existente.id, status: existente.status });
  }
  const t = await criarTcc({
    userId: a.userId, scopeId, titulo: topic, origem: "estudos", status: "gerando",
    secoes: ESQUELETO_TCC.map((titulo) => ({ titulo })),
  });
  // Solto (padrão do Studio): responde já; o documento cresce e o cliente vê pelo poll.
  void gerarTccEmBackground(t.id, a.userId, topic);
  if (scopeId) void fixarCardTcc(a.userId, scopeId, { workId: t.id, titulo: t.titulo, secoes: t.secoes.length });
  return NextResponse.json({ workId: t.id, status: "gerando" }, { status: 202 });
}
