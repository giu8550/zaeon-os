import type { Paper } from "./types";
import { fetchBibtex } from "./sources/crossref";

// Deterministic citation key, e.g. "vaswani2017" or "arxiv1706.03762".
export function bibKey(p: Paper): string {
  const first = (p.authors[0] ?? "").split(/\s+/).pop()?.toLowerCase().replace(/[^a-z]/g, "") || (p.arxivId ? "arxiv" : "ref");
  return `${first}${p.year ?? ""}` || p.id.replace(/[^a-z0-9]/gi, "");
}

// Manual BibTeX from verified metadata only (no invented fields). Pure + testable.
export function manualBibtex(p: Paper): string {
  const fields: string[] = [];
  if (p.title) fields.push(`  title={${p.title}}`);
  if (p.authors.length) fields.push(`  author={${p.authors.join(" and ")}}`);
  if (p.year) fields.push(`  year={${p.year}}`);
  if (p.venue) fields.push(`  journal={${p.venue}}`);
  if (p.doi) fields.push(`  doi={${p.doi}}`);
  else if (p.arxivId) fields.push(`  eprint={${p.arxivId}}`);
  const type = p.arxivId && !p.doi ? "misc" : "article";
  return `@${type}{${bibKey(p)},\n${fields.join(",\n")}\n}`;
}

// For each paper: prefer verified CrossRef BibTeX (by DOI), else manual fallback.
export async function buildReferencesBib(papers: Paper[]): Promise<string> {
  const entries = await Promise.all(
    papers.map(async (p) => (p.doi ? (await fetchBibtex(p.doi)) ?? manualBibtex(p) : manualBibtex(p)))
  );
  return entries.join("\n\n");
}
