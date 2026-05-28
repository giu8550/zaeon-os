import { normalizeText, tokenize } from "./normalize";
import type { Locator, Paragraph, RetrievedText } from "./types";

const MIN_QUOTE_CHARS = 12;

export interface VerifyResult {
  verified: boolean;
  locator?: Locator;
}

function buildLocator(kind: RetrievedText["kind"], p: Paragraph): Locator {
  if (kind === "pdf") return { kind: "pdf", page: p.page ?? 0, paragraph: p.idx };
  if (kind === "fulltext") return { kind: "fulltext", section: p.section, paragraph: p.idx };
  return { kind: "abstract" };
}

// contiguous bigram overlap; order-sensitive, deterministic, no deps
export function fuzzyContains(haystack: string, needle: string, threshold = 0.92): boolean {
  const H = tokenize(haystack);
  const N = tokenize(needle);
  if (N.length < 2) return false;
  // Build set of haystack bigrams
  const haystackBigrams = new Set<string>();
  for (let i = 0; i + 1 < H.length; i++) {
    haystackBigrams.add(H[i] + " " + H[i + 1]);
  }
  // Count needle bigrams present in haystack bigram set
  const totalNeedleBigrams = N.length - 1;
  let present = 0;
  for (let i = 0; i + 1 < N.length; i++) {
    if (haystackBigrams.has(N[i] + " " + N[i + 1])) present++;
  }
  return present / totalNeedleBigrams >= threshold;
}

export function verifyQuote(quote: string, rt: RetrievedText): VerifyResult {
  const nq = normalizeText(quote);
  if (nq.length < MIN_QUOTE_CHARS) return { verified: false };
  for (const p of rt.paragraphs) {
    const np = normalizeText(p.text);
    if (np.includes(nq) || fuzzyContains(np, nq, 0.92)) {
      return { verified: true, locator: buildLocator(rt.kind, p) };
    }
  }
  return { verified: false };
}

// Apply verification to a batch of records against their papers.
export function verifyEvidence<T extends { paperId: string; quote: string }>(
  records: T[],
  paperTextById: Map<string, RetrievedText>
): (T & VerifyResult)[] {
  return records.map((rec) => {
    const rt = paperTextById.get(rec.paperId);
    if (!rt) return { ...rec, verified: false };
    return { ...rec, ...verifyQuote(rec.quote, rt) };
  });
}
