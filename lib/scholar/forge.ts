// Maps verified ScholarSession references (Paper[]) into the Suggestion Forge's
// IncomingRef contract (suggestion-forge/engine_spec.md §2) and assembles a
// ForgeRequest. Pure + testable so the proxy route stays thin.
import type { Level } from "./levels";
import type { Paper } from "./types";

export interface IncomingRef {
  title: string;
  authors: string;
  year: string;
  venue: string;
  doi: string | null;
  abstract: string | null;
}

export interface ForgeRequestBody {
  topic: string;
  user_level: Level;
  references: IncomingRef[];
  count: number;
  exclude_titles: string[];
  language: "pt-BR" | "en";
}

const DOI_RE = /^10\.\d{4,}\/.+$/;

/** Coerce a Paper into an IncomingRef, or null if it can't satisfy the contract. */
export function paperToIncomingRef(p: Paper): IncomingRef | null {
  if (!p?.title || p.title.trim().length < 3) return null;
  const year =
    typeof p.year === "number" && p.year >= 1000 && p.year <= 9999 ? String(p.year) : null;
  if (!year) return null; // contract requires a 4-digit year

  const authors = (p.authors ?? []).filter(Boolean).join(", ").slice(0, 600);
  const venue = (p.venue ?? "").trim();
  return {
    title: p.title.trim().slice(0, 400),
    authors: authors.length >= 2 ? authors : "Autoria não informada",
    year,
    venue: (venue.length >= 2 ? venue : "Preprint").slice(0, 200),
    doi: p.doi && DOI_RE.test(p.doi) ? p.doi : null,
    abstract: p.abstract ? p.abstract.slice(0, 4000) : null,
  };
}

/** Build a ForgeRequest body, or an error when there aren't enough valid refs. */
export function buildForgeRequest(opts: {
  topic: string;
  level: Level;
  references: Paper[];
  count?: number;
  excludeTitles?: string[];
  language?: "pt-BR" | "en";
}): ForgeRequestBody | { error: string } {
  const refs = (opts.references ?? [])
    .map(paperToIncomingRef)
    .filter((r): r is IncomingRef => r !== null)
    .slice(0, 40);

  if (refs.length < 3) {
    return { error: `São necessárias ≥ 3 referências válidas (com ano) — encontradas ${refs.length}.` };
  }

  return {
    topic: opts.topic.trim().slice(0, 500),
    user_level: opts.level,
    references: refs,
    count: Math.min(Math.max(opts.count ?? 5, 1), 10),
    exclude_titles: (opts.excludeTitles ?? []).filter((t) => typeof t === "string" && t).slice(0, 50),
    language: opts.language ?? "pt-BR",
  };
}
