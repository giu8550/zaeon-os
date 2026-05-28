import type { Paragraph } from "./types";

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function paragraphsFromPages(pages: { page: number; text: string }[]): Paragraph[] {
  const out: Paragraph[] = [];
  let idx = 0;
  for (const pg of pages) {
    for (const para of splitParagraphs(pg.text)) {
      out.push({ idx: idx++, page: pg.page, text: para });
    }
  }
  return out;
}

// Impure: extract per-page text with pdfjs-dist (Node, no worker), then attribute.
export async function extractPdfParagraphs(data: Uint8Array): Promise<Paragraph[]> {
  // legacy build runs in Node without a worker
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, disableFontFace: true }).promise;
  const pages: { page: number; text: string }[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    // pdfjs returns items per text run; join with spaces, insert breaks on large Y gaps is overkill here
    const text = content.items.map((it: any) => (it.str ?? "")).join(" ");
    pages.push({ page: n, text });
  }
  return paragraphsFromPages(pages);
}
