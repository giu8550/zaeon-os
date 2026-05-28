import type { Paper } from "../types";

export function parseSemanticScholar(json: any): Paper[] {
  return (json?.data ?? []).map((p: any): Paper => ({
    id: p.externalIds?.DOI ? `doi:${p.externalIds.DOI}` : `s2:${p.paperId}`,
    title: p.title ?? "",
    authors: (p.authors ?? []).map((a: any) => a.name),
    year: p.year ?? undefined,
    venue: p.venue || undefined,
    doi: p.externalIds?.DOI || undefined,
    arxivId: p.externalIds?.ArXiv || undefined,
    url: p.url || undefined,
    pdfUrl: p.openAccessPdf?.url || undefined,
    abstract: p.abstract || undefined,
    citationCount: p.citationCount ?? undefined,
    openAccess: !!p.openAccessPdf?.url,
    sources: ["semanticscholar"],
  }));
}

export async function searchSemanticScholar(query: string, limit = 15): Promise<Paper[]> {
  try {
    const fields = "title,authors,year,venue,externalIds,abstract,openAccessPdf,citationCount,url";
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    return parseSemanticScholar(await res.json());
  } catch { return []; }
}
