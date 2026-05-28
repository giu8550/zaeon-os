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

// word-shingle overlap over a sliding window; deterministic, no deps
export function fuzzyContains(haystack: string, needle: string, threshold = 0.92): boolean {
  const H = tokenize(haystack);
  const N = tokenize(needle);
  if (N.length === 0) return false;
  if (N.length > H.length) return false;
  const needleSet = new Set(N);
  let best = 0;
  for (let i = 0; i + N.length <= H.length; i++) {
    let hit = 0;
    for (let j = 0; j < N.length; j++) if (needleSet.has(H[i + j])) hit++;
    best = Math.max(best, hit / N.length);
    if (best >= threshold) return true;
  }
  return false;
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
