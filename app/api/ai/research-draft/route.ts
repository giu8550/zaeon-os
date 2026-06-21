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

const TIMEOUT_MS = Number(process.env.SCHOLAR_GEMINI_TIMEOUT_MS || 30000);

interface DraftJson {
  titulo?: string;
  resumo?: string;
  palavrasChave?: string;
  introducao?: string;
  objetivos?: string;
  justificativa?: string;
  metodologia?: string;
  referencias?: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic) return NextResponse.json({ error: "Tema ausente" }, { status: 400 });
  const refs: string[] = Array.isArray(body.references) ? body.references.filter((s: any) => typeof s === "string").slice(0, 12) : [];

  const sys = [
    "Você é um orientador acadêmico. Gere um ESBOÇO de pesquisa em PT-BR — básico e didático",
    "(NÃO experimental), pra dar um norte ao aluno começar o trabalho dele.",
    "NÃO escreva títulos de seção nem numeração — só o MIOLO de cada campo (o sistema já tem o esqueleto).",
    "Responda APENAS um JSON com estas chaves (strings):",
    "{",
    '  "titulo": "título claro e específico",',
    '  "resumo": "3-4 frases",',
    '  "palavrasChave": "termo1; termo2; termo3",',
    '  "introducao": "contexto + problema + pergunta de pesquisa (1-2 parágrafos)",',
    '  "objetivos": "1 objetivo geral + 2-3 específicos, separados por quebra de linha",',
    '  "justificativa": "aponte UMA lacuna/ângulo original (o pioneirismo) e por que importa",',
    '  "metodologia": "abordagem simples: tipo de pesquisa, fontes, passos",',
    '  "referencias": "as fornecidas, formato autor-data, uma por linha (ou vazio)"',
    "}",
    "Seja conciso e concreto. Não invente dados nem referências.",
  ].join("\n");

  const user = `Tema do estudo: ${topic}\n\nReferências disponíveis:\n${refs.length ? refs.map((r, i) => `${i + 1}. ${r}`).join("\n") : "(nenhuma fornecida)"}`;

  try {
    const d = await geminiJson<DraftJson>(sys, user, { temperature: 0.4, timeoutMs: TIMEOUT_MS });
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
