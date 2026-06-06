import { getGeminiModel, extractText } from "./gemini";
import { buildSuggestSystemPrompt, buildSuggestUserMessage } from "./prompts-suggest";
import { retrievePapers } from "./retrieve";
import { buildTermometro, type Termometro } from "./termometro";
import { LEVEL_META, type Level } from "./levels";
import type { Paper } from "./types";

export interface SuggestInput { topic: string; level: Level; excludeTitles?: string[]; }
export interface Suggestion {
  type: "Exploratória" | "Experimental" | "Pioneira";
  title: string; rationale: string; novelty_angle: string; gap_score: number;
}
export interface RefItem {
  source: "PubMed" | "arXiv" | "DOI" | "Scholar";
  title: string; authors: string; year: string; venue: string; doi?: string | null;
}
export interface SuggestResult { suggestion: Suggestion; references: RefItem[]; termometro: Termometro; }

export interface SuggestDeps {
  llm?: (system: string, user: string) => Promise<string>;
  retrieve?: typeof retrievePapers;
}

const TYPES = ["Exploratória", "Experimental", "Pioneira"] as const;

export function parseSuggestion(raw: string, fallbackType: Suggestion["type"]): Suggestion {
  const cleaned = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  let data: any = {};
  try { data = JSON.parse(cleaned); } catch { data = {}; }
  const s = (data && data.suggestion) || data || {};
  const type = (TYPES as readonly string[]).includes(s.type) ? s.type : fallbackType;
  const gap = Number(s.gap_score);
  return {
    type: type as Suggestion["type"],
    title: String(s.title ?? "").slice(0, 200),
    rationale: String(s.rationale ?? ""),
    novelty_angle: String(s.novelty_angle ?? ""),
    gap_score: Number.isFinite(gap) ? Math.max(0, Math.min(1, gap)) : 0.5,
  };
}

export function paperToRefItem(p: Paper): RefItem {
  const src = (p.sources?.[0] ?? "").toLowerCase();
  const source: RefItem["source"] =
    src.includes("arxiv") || p.arxivId ? "arXiv"
    : src.includes("pubmed") || src.includes("europepmc") ? "PubMed"
    : p.doi ? "DOI"
    : "Scholar";
  const authors = p.authors.length
    ? p.authors.slice(0, 3).join(", ") + (p.authors.length > 3 ? " et al." : "")
    : "—";
  return { source, title: p.title, authors, year: p.year ? String(p.year) : "", venue: p.venue ?? "", doi: p.doi ?? null };
}

async function defaultLlm(system: string, user: string): Promise<string> {
  const model = getGeminiModel(system, { temperature: 0.8 });
  const result = await model.generateContent(user);
  return extractText(result) || "{}";
}

export async function generateSuggestion(input: SuggestInput, deps: SuggestDeps = {}): Promise<SuggestResult> {
  const llm = deps.llm ?? defaultLlm;
  const retrieve = deps.retrieve ?? retrievePapers;
  const system = buildSuggestSystemPrompt(input.level, input.excludeTitles ?? []);
  const user = buildSuggestUserMessage(input.topic);

  const [raw, retrieved] = await Promise.all([
    llm(system, user),
    retrieve(input.topic, { minResults: 6 }).catch(() => ({ papers: [] as Paper[], perSource: [], reachedMin: false })),
  ]);

  const suggestion = parseSuggestion(raw, LEVEL_META[input.level].suggestionType);
  const references = retrieved.papers.slice(0, 8).map(paperToRefItem);
  const termometro = buildTermometro(input.level, suggestion.gap_score);
  return { suggestion, references, termometro };
}
