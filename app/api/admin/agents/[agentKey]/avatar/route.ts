/**
 * Estúdio de avatar vivo no ADMIN (Etapa B — self-service, founder-only, flag NEXT_PUBLIC_AGENTS_ADMIN).
 *   POST { acao: "base" | "base-de-imagem" | "estado", … } → gera UMA peça (lib/avatars/estudio.ts)
 *   POST { acao: "salvar", base, quadros, cor? }          → grava o set aprovado no banco
 *   DELETE                                               → apaga o set (volta à foto/estático)
 * O dono vê cada peça aparecer no estúdio e aprova/rerola antes de salvar.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { agentsAdmin } from "@/lib/canal/flags";
import { isAgentKey } from "@/lib/agents/roster";
import { atenderEstudio, validarSalvar } from "@/lib/avatars/estudio";
import { apagarDoBanco, salvarNoBanco } from "@/lib/avatars/banco";
import { geminiImageDisponivel } from "@/lib/avatars/gemini-image";

async function gate(params: { agentKey: string }): Promise<{ agentKey: string } | NextResponse> {
  if (!agentsAdmin()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const a = await assertAdmin();
  if (!a.ok) return NextResponse.json({ error: a.status === 401 ? "Unauthorized" : "Forbidden" }, { status: a.status });
  const agentKey = String(params.agentKey || "").toLowerCase();
  if (!isAgentKey(agentKey)) return NextResponse.json({ error: "agentKey inválido" }, { status: 400 });
  return { agentKey };
}

export async function POST(req: Request, { params }: { params: { agentKey: string } }) {
  const g = await gate(params); if (g instanceof NextResponse) return g;
  const body = await req.json().catch(() => ({}));
  if (body?.acao === "salvar") {
    const v = validarSalvar(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    const versao = await salvarNoBanco(g.agentKey, v.set);
    return NextResponse.json({ ok: true, versao });
  }
  if (!geminiImageDisponivel()) return NextResponse.json({ error: "Sem credencial do Vertex no servidor." }, { status: 503 });
  const r = await atenderEstudio(body);
  return NextResponse.json(r.json, { status: r.status });
}

export async function DELETE(_req: Request, { params }: { params: { agentKey: string } }) {
  const g = await gate(params); if (g instanceof NextResponse) return g;
  return NextResponse.json({ ok: true, apagados: await apagarDoBanco(g.agentKey) });
}
