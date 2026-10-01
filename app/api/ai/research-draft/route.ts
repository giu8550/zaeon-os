/**
 * POST /api/ai/research-draft — gera um ESBOÇO de pesquisa (básico, não experimental)
 * a partir de um estudo. Devolve CAMPOS estruturados (sem cabeçalhos/seções) para o
 * front encaixar no framework do tipo escolhido (TCC/Artigo/Relatório) sem repetir as
 * regras das repartições. Inclui a LACUNA/ângulo original (pioneirismo) na justificativa.
 *   body: { topic: string, references?: string[] }
 *   → { title, fields: { resumo, palavrasChave, introducao, objetivos, justificativa, metodologia, referencias } }
 */
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { geminiJson } from "@/lib/scholar/gemini";
import { ESBOCO_SYS, esbocoUser, type DraftJson } from "@/lib/research/esboco";

const TIMEOUT_MS = Number(process.env.SCHOLAR_GEMINI_TIMEOUT_MS || 30000);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic) return NextResponse.json({ error: "Tema ausente" }, { status: 400 });
  const refs: string[] = Array.isArray(body.references) ? body.references.filter((s: any) => typeof s === "string").slice(0, 12) : [];

  try {
    const d = await geminiJson<DraftJson>(ESBOCO_SYS, esbocoUser(topic, refs), { temperature: 0.4, timeoutMs: TIMEOUT_MS });
    const title = (d.titulo || topic).slice(0, 120);
    const fields = {
      resumo: d.resumo || "",
      palavrasChave: d.palavrasChave || "",
      introducao: d.introducao || "",
      objetivos: d.objetivos || "",
      justificativa: d.justificativa || "",
      metodologia: d.metodologia || "",
      referencias: d.referencias || (refs.length ? refs.join("\n") : ""),
    };
    if (!fields.resumo && !fields.introducao && !fields.metodologia) {
      return NextResponse.json({ error: "Não consegui gerar o esboço agora." }, { status: 502 });
    }
    return NextResponse.json({ title, fields });
  } catch (e: any) {
    console.error("[research-draft] erro:", e?.message);
    return NextResponse.json({ error: e?.message || "Erro ao gerar a pesquisa" }, { status: 500 });
  }
}
