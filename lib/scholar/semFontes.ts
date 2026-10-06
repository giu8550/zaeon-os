/**
 * lib/scholar/semFontes.ts — quando as bases acadêmicas voltam VAZIAS, a Sala de Pesquisa não morre em
 * "não encontrei": tenta a internet e, na falta dela, responde pelo conhecimento do modelo — sempre
 * deixando claro (1 linha) que a resposta NÃO veio de fonte acadêmica indexada. Ordem: web → modelo.
 * Injetável (webSearch/genJson) pra testar sem rede.
 */
import { webSearch as webSearchReal, webParaPrompt, type WebResult, type WebSearchResult } from "@/lib/search/web";

export const SEM_FONTES_SYSTEM =
  "Você é o Omega Scholar (Sala de Pesquisa da Zaeon). As bases acadêmicas NÃO trouxeram trabalhos para esta pergunta. " +
  "NÃO responda 'não encontrei' e pare: RESPONDA a pergunta em PT-BR, em tom acadêmico e claro. " +
  "Se houver RESULTADOS DA WEB abaixo, apoie-se neles e cite como [1], [2]… (só os fornecidos; nunca invente link, autor, número ou DOI). " +
  "Sem resultados web, responda com o conhecimento geral do modelo e seja prudente com números e nomes. " +
  "A PRIMEIRA linha da resposta deve avisar, curta: que isso NÃO veio de fontes acadêmicas indexadas " +
  "(diga se veio de pesquisa na internet ou do conhecimento geral). Termine sugerindo 1–2 recortes/termos pra aprofundar na literatura. " +
  'Responda SOMENTE JSON: {"answer":"..."}';

export type SemFontesOut = { answer: string; origem: "web" | "modelo"; web: WebResult[] };

export async function responderSemFontes(
  prompt: string,
  deps: { webSearch?: (q: string) => Promise<WebSearchResult>; genJson?: <T>(system: string, user: string, o?: any) => Promise<T> } = {},
): Promise<SemFontesOut> {
  const web = await (deps.webSearch ?? ((q: string) => webSearchReal(q)))(prompt).catch(() => ({ ok: false } as WebSearchResult));
  const results = web.ok ? web.results : [];
  const user = `Pergunta: ${prompt}\n\n` + (results.length ? `RESULTADOS DA WEB:\n${webParaPrompt(results)}` : "(sem resultados da web — use o conhecimento geral)");
  const gen = deps.genJson ?? (await import("@/lib/scholar/gemini")).geminiJson;
  let answer = "";
  try { answer = String((await gen<{ answer?: string }>(SEM_FONTES_SYSTEM, user, { temperature: 0.3, timeoutMs: 30_000 }))?.answer ?? "").trim(); } catch { /* cai no texto mínimo abaixo */ }
  const origem = results.length ? "web" : "modelo";
  if (!answer) {
    // Último recurso (modelo fora do ar): ainda assim não é um "não encontrei" seco.
    answer = `Não achei trabalhos acadêmicos indexados sobre isso e não consegui montar a resposta agora. ` +
      `Tente de novo em instantes ou reformule com termos mais específicos (ex.: o nome técnico do conceito, em inglês).`;
  } else if (!/n[ãa]o (veio|vem|foi|s[ãa]o)|sem fontes? acad[êe]micas|n[ãa]o encontr/i.test(answer.split("\n")[0] ?? "")) {
    answer = `Nota: isto não veio de fontes acadêmicas indexadas (${origem === "web" ? "pesquisa na internet" : "conhecimento geral do modelo"}).\n\n` + answer;
  }
  if (results.length) answer += `\n\n**Fontes (web)**\n` + results.map((r, i) => `[${i + 1}] ${r.title} — ${r.url}`).join("\n");
  return { answer, origem, web: results };
}
