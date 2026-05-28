import { titleOverlap } from "./normalize";
import type { Paper } from "./types";

const TITLE_THRESHOLD = 0.85;

function merge(a: Paper, b: Paper): Paper {
  // prefer non-empty fields; union sources; keep max citationCount; OR openAccess
  const pick = <K extends keyof Paper>(k: K) => (a[k] ?? b[k]) as Paper[K];
  const richer = (x?: any, y?: any) => x ?? y;
  return {
    ...a,
    title: a.title || b.title,
    authors: a.authors.length ? a.authors : b.authors,
    year: richer(a.year, b.year),
    venue: richer(a.venue, b.venue),
    doi: richer(a.doi, b.doi),
    arxivId: richer(a.arxivId, b.arxivId),
    url: richer(a.url, b.url),
    pdfUrl: richer(a.pdfUrl, b.pdfUrl),
    abstract: richer(a.abstract, b.abstract),
    citationCount: Math.max(a.citationCount ?? 0, b.citationCount ?? 0) || undefined,
    openAccess: a.openAccess || b.openAccess,
    retrievedText: richer(a.retrievedText, b.retrievedText),
    sources: Array.from(new Set([...a.sources, ...b.sources])),
    id: pick("id"),
  };
}

export function dedupePapers(papers: Paper[]): Paper[] {
  const result: Paper[] = [];
  for (const p of papers) {
    const dKey = p.doi?.toLowerCase();
    let hitIndex = -1;
    for (let i = 0; i < result.length; i++) {
      const r = result[i];
      if (dKey && r.doi?.toLowerCase() === dKey) { hitIndex = i; break; }
      if (!dKey && !r.doi && titleOverlap(p.title, r.title) > TITLE_THRESHOLD) { hitIndex = i; break; }
    }
    if (hitIndex >= 0) result[hitIndex] = merge(result[hitIndex], p);
    else result.push(p);
  }
  return result;
}
