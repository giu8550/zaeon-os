import type { Paper } from "../types";

export function parseCrossref(json: any): Paper[] {
  return (json?.message?.items ?? []).map((it: any): Paper => ({
    id: it.DOI ? `doi:${it.DOI}` : `crossref:${it.URL ?? (Array.isArray(it.title) ? it.title[0] : it.title) ?? "unknown"}`,
    title: Array.isArray(it.title) ? it.title[0] : (it.title ?? ""),
    authors: (it.author ?? []).map((a: any) => [a.given, a.family].filter(Boolean).join(" ")),
    year: it.issued?.["date-parts"]?.[0]?.[0] ?? undefined,
    venue: Array.isArray(it["container-title"]) ? it["container-title"][0] : undefined,
    doi: it.DOI,
    url: it.URL,
    citationCount: it["is-referenced-by-count"] ?? undefined,
    openAccess: false,
    sources: ["crossref"],
  }));
}

export async function searchCrossref(query: string, limit = 10): Promise<Paper[]> {
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}&select=DOI,title,author,issued,container-title,URL,is-referenced-by-count`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    return parseCrossref(await res.json());
  } catch { return []; }
}

// Verified BibTeX via CrossRef transform; null on failure (caller builds manual fallback).
export async function fetchBibtex(doi: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}/transform/application/x-bibtex`, {
      headers: { Accept: "application/x-bibtex" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return (await res.text()).trim();
  } catch { return null; }
}
