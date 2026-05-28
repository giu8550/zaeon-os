import type { Paper } from "../types";

export function reconstructAbstract(inv?: Record<string, number[]>): string | undefined {
  if (!inv) return undefined;
  const words: string[] = [];
  for (const [w, positions] of Object.entries(inv)) for (const pos of positions) words[pos] = w;
  return words.filter(Boolean).join(" ") || undefined;
}

export function parseOpenAlex(json: any): Paper[] {
  return (json?.results ?? []).map((w: any): Paper => {
    const doi = w.doi ? String(w.doi).replace(/^https?:\/\/doi\.org\//, "") : undefined;
    const pdf = w.open_access?.oa_url || w.primary_location?.pdf_url || undefined;
    return {
      id: doi ? `doi:${doi}` : `openalex:${w.id}`,
      title: w.title ?? "",
      authors: (w.authorships ?? []).map((a: any) => a.author?.display_name).filter(Boolean),
      year: w.publication_year ?? undefined,
      venue: w.primary_location?.source?.display_name || undefined,
      doi,
      url: w.id,
      pdfUrl: pdf,
      abstract: reconstructAbstract(w.abstract_inverted_index),
      citationCount: w.cited_by_count ?? undefined,
      openAccess: !!w.open_access?.is_oa,
      sources: ["openalex"],
    };
  });
}

export async function searchOpenAlex(query: string, limit = 15): Promise<Paper[]> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    return parseOpenAlex(await res.json());
  } catch { return []; }
}
