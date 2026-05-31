import lexiconData from "./academic-lexicon.json";

export type AcademicDomain =
  | "bio" | "med" | "cs" | "phys" | "chem" | "eng" | "human" | "social" | "multi";

export interface AcademicTermResult {
  isAcademic: boolean;
  confidence: number;
  matchedTerms: string[];
  domain?: AcademicDomain;
}

const THRESHOLD = 0.55;
const DOMAIN_KEYS: AcademicDomain[] = [
  "bio", "med", "cs", "phys", "chem", "eng", "human", "social", "multi",
];

// Productive academic morphology (tested against the normalized string).
const MORPH: RegExp[] = [
  /[a-z]{2,}omics?\b/,    // genomics, proteomics, metabolomics
  /\bnano[a-z]{3,}/,      // nanoparticle, nanotube, nanomaterial
  /[a-z]{3,}genesis\b/,   // angiogenesis, carcinogenesis
  /\bab initio\b/,
  /\bquantum\b/,
];
const DOI_RE = /10\.\d{4,9}\/[-._;()/:a-z0-9]+/;          // on normalized (lowercased) text
const ARXIV_RE = /\b(?:arxiv:\s*)?\d{4}\.\d{4,5}(?:v\d+)?\b/;
const CHEM_RE = /\b(?:[A-Z][a-z]?\d*){2,}\b/;             // on RAW text; must contain a digit

function norm(s: string): string {
  // strip accents (combining diacritical marks U+0300–U+036F) and lowercase
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

interface Lexicon { bases: string[]; domains: Record<string, string[]>; }
const LEX = lexiconData as Lexicon;
const NORM_BASES = LEX.bases.map(norm);
const NORM_DOMAINS: Record<string, string[]> = Object.fromEntries(
  DOMAIN_KEYS.map((d) => [d, (LEX.domains[d] ?? []).map(norm)]),
);

export function isAcademicTerm(input: string): AcademicTermResult {
  const raw = (input ?? "").trim();
  if (raw.length < 2) return { isAcademic: false, confidence: 0, matchedTerms: [] };

  const normalized = norm(raw);
  const words = normalized.replace(/[^a-z0-9+\-]/g, " ").split(/\s+/).filter(Boolean);
  const wordSet = new Set(words);
  const padded = " " + words.join(" ") + " ";

  // Multiword: left boundary, free on the right (plural-tolerant). Single: tolerate "+s".
  const hasTerm = (term: string): boolean =>
    term.includes(" ")
      ? padded.includes(" " + term)
      : wordSet.has(term) || wordSet.has(term + "s");
  // Bases: exact match (avoids "core"->"cores" etc.).
  const hasBase = (b: string): boolean =>
    b.includes(" ") ? padded.includes(" " + b) : wordSet.has(b);

  const matchedTerms: string[] = [];
  const domainScore: Record<string, number> = {};
  for (const d of DOMAIN_KEYS) {
    for (const term of NORM_DOMAINS[d]) {
      if (hasTerm(term)) {
        matchedTerms.push(term);
        domainScore[d] = (domainScore[d] ?? 0) + 1;
      }
    }
  }

  const matchedBases = NORM_BASES.filter(hasBase);
  matchedTerms.push(...matchedBases);

  let morphHits = 0;
  for (const re of MORPH) if (re.test(normalized)) morphHits++;

  const hasDoi = DOI_RE.test(normalized);
  const hasArxiv = ARXIV_RE.test(normalized);
  const chemMatch = raw.match(CHEM_RE);
  const hasChem = !!chemMatch && /\d/.test(chemMatch[0]);

  let score = 0;
  score += 0.35 * Math.min(matchedTerms.length, 3);
  score += 0.45 * Math.min(morphHits, 2);
  if (matchedBases.length) score += 0.6;
  if (hasDoi || hasArxiv) score += 0.8;
  if (hasChem) score += 0.3;
  const confidence = Math.min(1, score);

  let domain: AcademicDomain | undefined;
  const entries = Object.entries(domainScore).sort((a, b) => b[1] - a[1]);
  if (entries.length) {
    const [topD, topN] = entries[0];
    const tie = entries.filter(([, n]) => n === topN).length > 1;
    domain = tie ? "multi" : (topD as AcademicDomain);
  } else if (confidence >= THRESHOLD) {
    domain = "multi";
  }

  return {
    isAcademic: confidence >= THRESHOLD,
    confidence: Math.round(confidence * 100) / 100,
    matchedTerms: Array.from(new Set(matchedTerms)),
    domain,
  };
}
