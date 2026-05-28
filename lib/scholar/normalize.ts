export function normalizeText(s: string): string {
  return s
    .replace(/-\s*\n\s*/g, "")           // de-hyphenate across line breaks
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export function tokenize(s: string): string[] {
  return normalizeText(s)
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// overlap coefficient over token sets (robust to length differences)
export function titleOverlap(a: string, b: string): number {
  const tokA = tokenize(a);
  const tokB = tokenize(b);
  // Guard: if either title has fewer than 3 tokens, short-subset false-merges are likely
  if (tokA.length < 3 || tokB.length < 3) return 0;
  const A = new Set(tokA);
  const B = new Set(tokB);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}
