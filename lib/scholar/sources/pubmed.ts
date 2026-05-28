import type { Paper } from "../types";
import { fetchWithRetry } from "../http";

// Pure: maps an esummary JSON ({ result: { uids: [...], <pmid>: {...} } }) to Paper[].
export function parsePubmedSummary(json: any): Paper[] {
  const result = json?.result;
  if (!result) return [];
  const uids: string[] = result.uids ?? [];
  return uids.map((pmid): Paper => {
    const r = result[pmid] ?? {};
    const doi = (r.articleids ?? []).find((a: any) => a.idtype === "doi")?.value || undefined;
    const year = Number(String(r.pubdate ?? "").match(/\d{4}/)?.[0]) || undefined;
    return {
      id: doi ? `doi:${doi}` : `pubmed:${pmid}`,
      title: r.title ?? "",
      authors: (r.authors ?? []).map((a: any) => a.name).filter(Boolean),
      year,
      venue: r.fulljournalname || r.source || undefined,
      doi,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      abstract: undefined, // esummary has no abstract; full text via Europe PMC later
      openAccess: false,
      sources: ["pubmed"],
    };
  });
}

export async function searchPubmed(query: string, limit = 15): Promise<{ papers: Paper[]; status: "ok" | "rate_limited" | "error" }> {
  try {
    const email = process.env.UNPAYWALL_EMAIL ? `&email=${encodeURIComponent(process.env.UNPAYWALL_EMAIL)}` : "";
    const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=${limit}&term=${encodeURIComponent(query)}&tool=zaeon${email}`;
    const sres = await fetchWithRetry(esearchUrl, {}, { retries: 2 });
    if (!sres.ok) return { papers: [], status: sres.status === 429 ? "rate_limited" : "error" };
    const sjson: any = await sres.json();
    const ids: string[] = sjson?.esearchresult?.idlist ?? [];
    if (ids.length === 0) return { papers: [], status: "ok" };
    const sumUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}&tool=zaeon${email}`;
    const sumres = await fetchWithRetry(sumUrl, {}, { retries: 2 });
    if (!sumres.ok) return { papers: [], status: sumres.status === 429 ? "rate_limited" : "error" };
    return { papers: parsePubmedSummary(await sumres.json()), status: "ok" };
  } catch { return { papers: [], status: "error" }; }
}
