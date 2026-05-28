import type { Paper } from "../types";
import { searchSemanticScholar } from "./semanticScholar";
import { searchOpenAlex } from "./openalex";
import { searchArxiv } from "./arxiv";
import { searchCrossref } from "./crossref";

export type SourceName = "semanticscholar" | "openalex" | "arxiv" | "crossref";

export const SOURCE_FN: Record<SourceName, (q: string, limit?: number) => Promise<Paper[]>> = {
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

export async function searchAll(query: string, sources: SourceName[]): Promise<{ source: SourceName; papers: Paper[] }[]> {
  return Promise.all(sources.map(async (s) => ({ source: s, papers: await SOURCE_FN[s](query) })));
}
