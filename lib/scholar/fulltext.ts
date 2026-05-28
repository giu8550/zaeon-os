import type { Paper, RetrievedText } from "./types";
import { isSafePublicHttpUrl } from "./ssrf";
import { extractPdfParagraphs } from "./pdf";
import { unpaywallPdfUrl } from "./sources/unpaywall";
import { europePmcFullText } from "./sources/europepmc";

async function fetchPdfBytes(url: string): Promise<Uint8Array | null> {
  if (!isSafePublicHttpUrl(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!/pdf/i.test(ct)) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch { return null; }
}

// Mutates+returns the paper with retrievedText filled by the best available source.
export async function resolveFullText(paper: Paper): Promise<Paper> {
  // 1) Try a PDF (arXiv / existing pdfUrl / Unpaywall) → page-attributed paragraphs (best proof)
  let pdfUrl = paper.pdfUrl;
  if (!pdfUrl && paper.doi) pdfUrl = (await unpaywallPdfUrl(paper.doi)) ?? undefined;
  if (pdfUrl) {
    const bytes = await fetchPdfBytes(pdfUrl);
    if (bytes) {
      const paragraphs = await extractPdfParagraphs(bytes).catch(() => []);
      if (paragraphs.length) {
        return { ...paper, pdfUrl, openAccess: true, retrievedText: { kind: "pdf", paragraphs } };
      }
    }
  }
  // 2) Europe PMC sectioned full text
  if (paper.doi) {
    const paras = await europePmcFullText(paper.doi);
    if (paras?.length) return { ...paper, retrievedText: { kind: "fulltext", paragraphs: paras } };
  }
  // 3) Abstract-only fallback
  if (paper.abstract) {
    return { ...paper, retrievedText: { kind: "abstract", paragraphs: [{ idx: 0, text: paper.abstract }] } };
  }
  return paper; // no text at all → cannot ground any claim
}
