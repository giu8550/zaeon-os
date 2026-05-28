import type { Paragraph } from "../types";

// Pure: JATS-ish full-text XML → sectioned paragraphs (no page numbers).
export function parseEuropePmcXml(xml: string): Paragraph[] {
  const secs = Array.from(xml.matchAll(/<sec[\s\S]*?>([\s\S]*?)<\/sec>/g));
  const paras: Paragraph[] = [];
  let idx = 0;
  for (const s of secs) {
    const title = (s[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
    for (const p of Array.from(s[1].matchAll(/<p[\s\S]*?>([\s\S]*?)<\/p>/g))) {
      const text = p[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (text) paras.push({ idx: idx++, section: title || undefined, text });
    }
  }
  return paras;
}

// Returns sectioned paragraphs (no page numbers) when an OA full text exists.
export async function europePmcFullText(doi: string): Promise<Paragraph[] | null> {
  try {
    const search = await fetch(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(doi)}&format=json`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!search.ok) return null;
    const sj: any = await search.json();
    const hit = sj.resultList?.result?.[0];
    if (!hit || hit.source !== "PMC" || !hit.pmcid) return null;
    const ft = await fetch(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/${hit.source}/${hit.pmcid}/fullTextXML`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!ft.ok) return null;
    const paras = parseEuropePmcXml(await ft.text());
    return paras.length ? paras : null;
  } catch { return null; }
}
