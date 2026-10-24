import type { Paper } from "../types";
import { searchSemanticScholar } from "./semanticScholar";
import { searchOpenAlex } from "./openalex";
import { searchArxiv } from "./arxiv";
import { searchCrossref } from "./crossref";
import { searchPubmed } from "./pubmed";

export type SourceName = "semanticscholar" | "openalex" | "arxiv" | "crossref" | "pubmed";

export interface SourceResult { source: SourceName; papers: Paper[]; status: "ok" | "rate_limited" | "error"; }

export const SOURCE_FN: Record<SourceName, (q: string, limit?: number) => Promise<{ papers: Paper[]; status: "ok" | "rate_limited" | "error" }>> = {
  semanticscholar: searchSemanticScholar,
  openalex: searchOpenAlex,
  arxiv: searchArxiv,
  crossref: searchCrossref,
  pubmed: searchPubmed,
};

// Domain → ordered priority (see spec §6.1). Always includes the multidisciplinary anchors.
export function basesForDomain(domain?: string): SourceName[] {
  const d = (domain ?? "").toLowerCase();
  if (/cs|ml|ai|comput|software|engenharia/.test(d)) return ["arxiv", "semanticscholar", "openalex", "crossref"];
  if (/med|bio|saúde|health|neuro/.test(d)) return ["pubmed", "semanticscholar", "openalex", "crossref"];
  if (/phys|astro|math|física|matemática/.test(d)) return ["arxiv", "semanticscholar", "openalex"];
  return ["semanticscholar", "openalex", "arxiv", "crossref"];
}

// Timeout POR FONTE: sem isso, uma fonte que dá 429 e fica re-tentando (ex.: Semantic
// Scholar sem API key) segura a pesquisa por dezenas de segundos. Com timeout, ela
// devolve vazio (status error) e a pesquisa SEGUE com as outras fontes.
const SOURCE_TIMEOUT_MS = Number(process.env.SCHOLAR_SOURCE_TIMEOUT_MS || 9000);

// PAUSA após 429 (out/2026, medido em prod: o Semantic Scholar sem chave respondeu rate_limited em TODA busca,
// gastando ~6,3 s pra trazer nada): a fonte que limitou fica de fora por um tempo e custa zero.
const PAUSA_429_MS = Number(process.env.SCHOLAR_PAUSA_429_MS || 10 * 60_000);
const pausadaAte = new Map<SourceName, number>();
/** (testes) esquece as pausas */
export const _zerarPausas = () => pausadaAte.clear();

export interface SearchOpts { /** prazo por fonte nesta busca (o chat usa curto; a pesquisa profunda, o padrão) */ prazoMs?: number; agora?: () => number }

export async function searchAll(query: string, sources: SourceName[], opts: SearchOpts = {}): Promise<SourceResult[]> {
  const agora = opts.agora ?? Date.now;
  const prazo = opts.prazoMs ?? SOURCE_TIMEOUT_MS;
  return Promise.all(sources.map(async (s): Promise<SourceResult> => {
    if ((pausadaAte.get(s) ?? 0) > agora()) return { source: s, papers: [], status: "rate_limited" };
    try {
      const r = await Promise.race([
        SOURCE_FN[s](query),
        new Promise<{ papers: Paper[]; status: "error" }>((res) =>
          setTimeout(() => res({ papers: [], status: "error" }), prazo)
        ),
      ]);
      if (r.status === "rate_limited") pausadaAte.set(s, agora() + PAUSA_429_MS);
      return { source: s, ...r };
    } catch {
      return { source: s, papers: [], status: "error" };
    }
  }));
}
