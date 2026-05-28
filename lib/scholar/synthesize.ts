import { geminiJson } from "./gemini";
import { OMEGA_SYSTEM } from "./prompt";
import type { Paper, RawSynthesis } from "./types";

export interface Plan { intent: string; domain: string; queries: string[]; }

export async function planQuery(query: string): Promise<Plan> {
  const sys = "Classifique o pedido de pesquisa. Responda JSON {intent, domain, queries:[2-4 strings]}. domain em PT-BR (ex: 'CS/ML','Medicina','Economia').";
  try {
    return await geminiJson<Plan>(sys, `Pedido: ${query}`);
  } catch {
    return { intent: "search", domain: "", queries: [query] };
  }
}

// Feed ONLY retrieved text; the model must quote verbatim from it.
// (RawSynthesis is defined in ./types so assemble.ts can import it independently.)
export async function synthesize(query: string, papers: Paper[]): Promise<RawSynthesis> {
  const corpus = papers.map((p) => ({
    paperId: p.id,
    title: p.title,
    text: (p.retrievedText?.paragraphs ?? []).map((x) => x.text).join("\n\n").slice(0, 6000),
  }));
  const user = `Pergunta: ${query}

PAPERS (use SOMENTE este texto; quote verbatim a partir daqui):
${JSON.stringify(corpus)}

Responda JSON: {answer, evidence:[{paperId,claim,quote,confidence}], insights:{summary,trends[],contradictions[]}, gaps:{description,rqCards[]}}`;
  return geminiJson<RawSynthesis>(OMEGA_SYSTEM, user);
}
