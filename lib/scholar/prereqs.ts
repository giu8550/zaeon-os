// Engine de contexto "Conhecimentos Prévios": dado o contexto de uma pesquisa
// (tópico + referências + insights), recomenda o que estudar ANTES para entendê-la.
// Usa o Gemini "pesado" (2.5-pro) via geminiJson. Pure parts testadas; o call fica no route.
import { geminiJson } from "./gemini";
import type { Paper } from "./types";

export type PrereqDepth = "básico" | "intermediário" | "avançado";

export interface Prereq {
  area: string;
  why: string;
  depth: PrereqDepth;
}

export interface PrereqsResult {
  prereqs: Prereq[];
  summary: string;
}

export function buildPrereqsSystemPrompt(): string {
  return `Você é o Omega Scholar. Tarefa: dado o contexto de uma pesquisa acadêmica (tópico, referências, insights),
recomende os CONHECIMENTOS PRÉVIOS que alguém precisa estudar ANTES para entender essa pesquisa a fundo.

Para cada item:
- "area": o tópico/conceito/método a estudar (ex.: "Eletroquímica fundamental", "Cadeias de Markov").
- "why": POR QUE importa para ESTA pesquisa especificamente — conecte a um aspecto concreto
  ("necessário para entender o método X usado em Y").
- "depth": "básico" | "intermediário" | "avançado".

Regras:
- 4 a 7 itens, do mais fundamental ao mais específico.
- Não invente referências. Foque no que habilita a compreensão.
- Tom: recomendação direta ("Estude X para entender Y").

SAÍDA: JSON puro { "prereqs": [{ "area", "why", "depth" }], "summary": "1 frase de orientação geral" }. Sem markdown.`;
}

export function buildPrereqsUserMessage(opts: {
  topic: string;
  references?: Paper[];
  insights?: { summary?: string } | null;
}): string {
  const refs = (opts.references ?? [])
    .slice(0, 12)
    .map((r, i) => `[${i}] ${r.title}${r.year ? ` (${r.year})` : ""}`)
    .join("\n");
  const ins = opts.insights?.summary ? `\n\nINSIGHTS:\n${opts.insights.summary.slice(0, 800)}` : "";
  return `PESQUISA: "${opts.topic}"

REFERÊNCIAS:
${refs || "(sem referências)"}${ins}

Recomende os conhecimentos prévios para entender esta pesquisa.`;
}

export function sanitizePrereqs(raw: any): PrereqsResult {
  const depths: PrereqDepth[] = ["básico", "intermediário", "avançado"];
  const items = Array.isArray(raw?.prereqs) ? raw.prereqs : [];
  const prereqs: Prereq[] = items
    .filter((p: any) => p && typeof p.area === "string" && p.area.trim())
    .slice(0, 8)
    .map((p: any) => ({
      area: String(p.area).slice(0, 160),
      why: typeof p.why === "string" ? p.why.slice(0, 400) : "",
      depth: depths.includes(p.depth) ? p.depth : "intermediário",
    }));
  return { prereqs, summary: typeof raw?.summary === "string" ? raw.summary.slice(0, 400) : "" };
}

export async function generatePrereqs(opts: {
  topic: string;
  references?: Paper[];
  insights?: { summary?: string } | null;
}): Promise<PrereqsResult> {
  const raw = await geminiJson<PrereqsResult>(
    buildPrereqsSystemPrompt(),
    buildPrereqsUserMessage(opts),
    { temperature: 0.4 }
  );
  return sanitizePrereqs(raw);
}
