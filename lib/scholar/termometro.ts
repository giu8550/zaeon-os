import type { Level } from "./levels";
import { getBolsaInfo, bolsaRange } from "./bolsas-brasil";

export interface ResearchTime { minMonths: number; maxMonths: number; typicalMonths: number; label: string; }
export interface ScholarshipOutlook {
  probability: "baixa" | "média" | "alta";
  probabilityScore: number;
  monthlyValueBRL: number;
  monthlyValueRangeBRL: [number, number];
  agencies: string[];
  competitiveness: "baixa" | "média" | "alta";
  note: string;
}
export interface PublicationTarget { qualis: string; tier: string; note: string; }
export interface Termometro {
  level: Level;
  researchTime: ResearchTime;
  scholarship: ScholarshipOutlook;
  publication: PublicationTarget;
  gapScore: number;
  gapLabel: string;
}

const RESEARCH_TIME: Record<Level, ResearchTime> = {
  grad:    { minMonths: 6,  maxMonths: 12, typicalMonths: 9,  label: "6–12 meses" },
  msc:     { minMonths: 18, maxMonths: 24, typicalMonths: 21, label: "18–24 meses" },
  phd:     { minMonths: 36, maxMonths: 48, typicalMonths: 42, label: "3–4 anos" },
  postdoc: { minMonths: 12, maxMonths: 24, typicalMonths: 18, label: "1–2 anos" },
};

// Probabilidade de obter bolsa por nível (heurística do cenário nacional, documentada):
// graduação (IC) — cotas amplas mas disputadas; mestrado/doutorado — alta prioridade de fomento;
// pós-doc — cotas PNPD escassas, as mais competitivas.
const PROBABILITY: Record<Level, { p: "baixa" | "média" | "alta"; score: number }> = {
  grad:    { p: "média", score: 0.55 },
  msc:     { p: "alta",  score: 0.72 },
  phd:     { p: "alta",  score: 0.78 },
  postdoc: { p: "média", score: 0.48 },
};

const PUBLICATION: Record<Level, PublicationTarget> = {
  grad:    { qualis: "B3–B4", tier: "Revista regional / anais",                 note: "TCC aprovado; possível artigo em revista regional brasileira." },
  msc:     { qualis: "A2–B1", tier: "Periódico Scopus/WoS",                     note: "1–2 artigos indexados; metodologia controlada." },
  phd:     { qualis: "Q1",    tier: "Journal internacional (IF > 3.0)",         note: "2–3 artigos Q1; contribuição original na fronteira." },
  postdoc: { qualis: "Q1+",   tier: "Top-tier (Nature/Science/PNAS, IF > 8.0)", note: "Alto impacto; cruzamento de disciplinas inédito." },
};

export function estimateResearchTime(level: Level): ResearchTime { return RESEARCH_TIME[level]; }

export function scholarshipOutlook(level: Level): ScholarshipOutlook {
  const info = getBolsaInfo(level);
  const { reference, min, max } = bolsaRange(level);
  const prob = PROBABILITY[level];
  return {
    probability: prob.p,
    probabilityScore: prob.score,
    monthlyValueBRL: reference,
    monthlyValueRangeBRL: [min, max],
    agencies: info.agencies.map((a) => a.name),
    competitiveness: info.competitiveness,
    note: info.availabilityNote,
  };
}

export function publicationTarget(level: Level): PublicationTarget { return PUBLICATION[level]; }

function clamp01(n: number): number { return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0)); }

function gapLabel(score: number): string {
  if (score >= 0.85) return "Pioneira (lacuna inédita)";
  if (score >= 0.7) return "Alta originalidade";
  if (score >= 0.45) return "Originalidade média";
  return "Território consolidado";
}

export function buildTermometro(level: Level, gapScore: number): Termometro {
  const g = clamp01(gapScore);
  return {
    level,
    researchTime: estimateResearchTime(level),
    scholarship: scholarshipOutlook(level),
    publication: publicationTarget(level),
    gapScore: g,
    gapLabel: gapLabel(g),
  };
}
