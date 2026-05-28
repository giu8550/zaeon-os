import type { Paper } from "../types";
import { searchSemanticScholar } from "./semanticScholar";
import { searchOpenAlex } from "./openalex";
import { searchArxiv } from "./arxiv";
import { searchCrossref } from "./crossref";

export type SourceName = "semanticscholar" | "openalex" | "arxiv" | "crossref";

export interface SourceResult { source: SourceName; papers: Paper[]; status: "ok" | "rate_limited" | "error"; }

export const SOURCE_FN: Record<SourceName, (q: string, limit?: number) => Promise<{ papers: Paper[]; status: "ok" | "rate_limited" | "error" }>> = {
  semanticscholar: searchSemanticScholar,
  openalex: searchOpenAlex,
  arxiv: searchArxiv,
  crossref: searchCrossref,
};

// Domain → ordered priority (see spec §6.1). Always includes the multidisciplinary anchors.
export function basesForDomain(domain?: string): SourceName[] {
  const d = (domain ?? "").toLowerCase();
  if (/cs|ml|ai|comput|software|engenharia/.test(d)) return ["arxiv", "semanticscholar", "openalex", "crossref"];
  if (/med|bio|saúde|health|neuro/.test(d)) return ["semanticscholar", "openalex", "crossref"]; // PubMed/EuropePMC added in 2.2
  if (/phys|astro|math|física|matemática/.test(d)) return ["arxiv", "semanticscholar", "openalex"];
  return ["semanticscholar", "openalex", "arxiv", "crossref"];
}

export async function searchAll(query: string, sources: SourceName[]): Promise<SourceResult[]> {
  return Promise.all(sources.map(async (s) => { const r = await SOURCE_FN[s](query); return { source: s, ...r }; }));
}
