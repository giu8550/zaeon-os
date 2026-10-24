import type { Paper } from "./types";
import { basesForDomain, searchAll, type SourceName, type SourceResult } from "./sources";
import { dedupePapers } from "./dedup";

const ALL_SOURCES: SourceName[] = ["semanticscholar", "openalex", "arxiv", "crossref", "pubmed"];
export const MIN_RESULTS = 12;

export interface RetrieveOptions {
  domain?: string;
  minResults?: number;
  search?: (query: string, sources: SourceName[], opts?: { prazoMs?: number }) => Promise<SourceResult[]>;
  /** prazo por fonte (o chat passa curto: a resposta não espera fonte lenta) */
  prazoFonteMs?: number;
  onSource?: (r: SourceResult) => void;
}

export interface RetrieveResult {
  papers: Paper[];
  perSource: { source: SourceName; count: number; status: SourceResult["status"] }[];
  reachedMin: boolean;
}

export async function retrievePapers(queries: string | string[], opts: RetrieveOptions = {}): Promise<RetrieveResult> {
  const minResults = opts.minResults ?? MIN_RESULTS;
  const search = opts.search ?? searchAll;
  const qs = [...new Set((Array.isArray(queries) ? queries : [queries]).map((q) => q.trim()).filter(Boolean))].slice(0, 3);
  if (!qs.length) return { papers: [], perSource: [], reachedMin: false };

  const primary = basesForDomain(opts.domain);
  const perSource: RetrieveResult["perSource"] = [];
  const pool: Paper[] = [];

  const run = async (query: string, sources: SourceName[]) => {
    const results = await search(query, sources, opts.prazoFonteMs ? { prazoMs: opts.prazoFonteMs } : undefined);
    for (const r of results) {
      opts.onSource?.(r);
      perSource.push({ source: r.source, count: r.papers.length, status: r.status });
      pool.push(...r.papers); // push in-place (seguro com queries em paralelo)
    }
  };

  // Queries em PARALELO (antes era sequencial → somava o tempo de cada uma).
  await Promise.all(qs.map((q) => run(q, primary)));
  let unique = dedupePapers(pool);

  // Top-up: amplia para as fontes restantes (na query principal) se não bateu o mínimo.
  if (unique.length < minResults) {
    const extra = ALL_SOURCES.filter((s) => !primary.includes(s));
    if (extra.length) {
      await run(qs[0], extra);
      unique = dedupePapers(pool);
    }
  }

  return { papers: unique, perSource, reachedMin: unique.length >= minResults };
}

// Lista de exibição ≥ min: citações verificadas primeiro, depois descobertas relacionadas, sem duplicar.
export function mergeDisplayReferences(verified: Paper[], discovered: Paper[], min = MIN_RESULTS): Paper[] {
  const ids = new Set(verified.map((p) => p.id));
  const related = discovered.filter((p) => !ids.has(p.id));
  return [...verified, ...related].slice(0, Math.max(min, verified.length));
}
