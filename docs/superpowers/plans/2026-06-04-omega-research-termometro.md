# Engine Omega (≥12 papers) + Termômetro Acadêmico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a aba Omega plenamente funcional — busca científica garantindo ≥12 papers por assunto, e sugestão de pesquisa (portada Python→TS) com um termômetro afiado (tempo médio, bolsa CAPES/CNPq/FAPESP, gap, alvo Qualis) por nível acadêmico.

**Architecture:** Lógica determinística e testável vive em `lib/scholar/*` (vitest cobre só `lib/**/*.test.ts`); rotas/componentes ficam finos e são verificados por `tsc --noEmit` + `next lint`. A sugestão deixa de depender do serviço Python (morto em produção) e roda em TypeScript usando o wrapper Vertex/Gemini já existente, com referências aterradas nas fontes reais.

**Tech Stack:** Next.js App Router, TypeScript (strict), Vitest, Vertex AI (`gemini-2.0-flash-001`), Prisma/Mongo.

**Convenções de teste (deste repo):** `import { describe, it, expect, vi } from "vitest";` · alias `@/` → raiz · rodar `npm test` ou `npx vitest run lib/scholar/<arquivo>.test.ts`.

---

## Task 1: `lib/scholar/levels.ts` — vocabulário de níveis

**Files:**
- Create: `lib/scholar/levels.ts`
- Test: `lib/scholar/levels.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/scholar/levels.test.ts
import { describe, it, expect } from "vitest";
import { LEVELS, LEVEL_META, isLevel, type Level } from "./levels";

describe("levels", () => {
  it("has exactly the 4 academic levels", () => {
    expect(LEVELS).toEqual(["grad", "msc", "phd", "postdoc"]);
  });
  it("has metadata for every level", () => {
    for (const l of LEVELS) {
      expect(LEVEL_META[l].id).toBe(l);
      expect(LEVEL_META[l].name.length).toBeGreaterThan(0);
      expect(LEVEL_META[l].programLabel.length).toBeGreaterThan(0);
    }
  });
  it("isLevel narrows valid/invalid strings", () => {
    expect(isLevel("phd")).toBe(true);
    expect(isLevel("bsc")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/scholar/levels.test.ts`
Expected: FAIL — `Cannot find module './levels'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/scholar/levels.ts
export type Level = "grad" | "msc" | "phd" | "postdoc";

export const LEVELS: Level[] = ["grad", "msc", "phd", "postdoc"];

export interface LevelMeta {
  id: Level;
  name: string;
  programLabel: string;
  suggestionType: "Exploratória" | "Experimental" | "Pioneira";
  icon: string;
}

export const LEVEL_META: Record<Level, LevelMeta> = {
  grad:    { id: "grad",    name: "Graduando",  programLabel: "Iniciação Científica (PIBIC/IC)", suggestionType: "Exploratória", icon: "🎓" },
  msc:     { id: "msc",     name: "Mestrando",  programLabel: "Mestrado",                        suggestionType: "Experimental", icon: "🔬" },
  phd:     { id: "phd",     name: "Doutorando", programLabel: "Doutorado",                       suggestionType: "Pioneira",     icon: "⚗️" },
  postdoc: { id: "postdoc", name: "Pós-Doc",    programLabel: "Pós-Doutorado (PNPD)",            suggestionType: "Pioneira",     icon: "🚀" },
};

export function isLevel(v: unknown): v is Level {
  return typeof v === "string" && (LEVELS as string[]).includes(v);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/scholar/levels.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scholar/levels.ts lib/scholar/levels.test.ts
git commit -m "feat(scholar): vocabulário canônico de níveis acadêmicos"
```

---

## Task 2: `lib/scholar/bolsas-brasil.ts` — dataset curado (cenário 2025)

**Files:**
- Create: `lib/scholar/bolsas-brasil.ts`
- Test: `lib/scholar/bolsas-brasil.test.ts`

Valores verificados (jun/2026): federais CAPES/CNPq do reajuste de 2023, ainda vigentes em 2025; FAPESP vigente 01/08/2025.

- [ ] **Step 1: Write the failing test**

```ts
// lib/scholar/bolsas-brasil.test.ts
import { describe, it, expect } from "vitest";
import { BOLSAS_BRASIL, getBolsaInfo, bolsaRange } from "./bolsas-brasil";
import { LEVELS } from "./levels";

describe("bolsas-brasil dataset", () => {
  it("cobre os 4 níveis", () => {
    for (const l of LEVELS) expect(BOLSAS_BRASIL[l].level).toBe(l);
  });
  it("cada agência tem valor mensal positivo, fonte e ano", () => {
    for (const l of LEVELS)
      for (const a of BOLSAS_BRASIL[l].agencies) {
        expect(a.monthlyBRL).toBeGreaterThan(0);
        expect(a.sourceUrl).toMatch(/^https?:\/\//);
        expect(a.asOf.length).toBeGreaterThanOrEqual(4);
      }
  });
  it("inclui FAPESP e o valor FAPESP é >= federal em todo nível", () => {
    for (const l of LEVELS) {
      const fap = BOLSAS_BRASIL[l].agencies.find((a) => a.name === "FAPESP");
      const fed = BOLSAS_BRASIL[l].agencies.find((a) => a.name !== "FAPESP");
      expect(fap).toBeTruthy();
      expect(fap!.monthlyBRL).toBeGreaterThanOrEqual(fed!.monthlyBRL);
    }
  });
  it("bolsaRange entrega reference (federal) <= max (FAPESP)", () => {
    const r = bolsaRange("phd");
    expect(r.reference).toBe(3100);
    expect(r.max).toBe(7140);
    expect(r.min).toBeLessThanOrEqual(r.reference);
  });
  it("getBolsaInfo devolve o programa correto", () => {
    expect(getBolsaInfo("postdoc").programLabel).toMatch(/Pós-Doutorado/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/scholar/bolsas-brasil.test.ts`
Expected: FAIL — `Cannot find module './bolsas-brasil'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/scholar/bolsas-brasil.ts
// Cenário nacional de bolsas — valores verificados em jun/2026.
// Federais (CAPES/CNPq): reajuste de 2023 (mestrado R$1.5k→2.1k, doutorado R$2.2k→3.1k,
//   pós-doc R$4.1k→5.2k) ainda vigente em 2025 — sem novo reajuste sob o arcabouço fiscal.
// FAPESP: tabela vigente a partir de 01/08/2025 (mais alta do país).
import type { Level } from "./levels";

export type Agency = "CAPES" | "CNPq" | "FAPESP";

export interface BolsaAgencyValue {
  name: Agency;
  monthlyBRL: number;
  sourceUrl: string;
  asOf: string;
}

export interface BolsaInfo {
  level: Level;
  programLabel: string;
  agencies: BolsaAgencyValue[];
  availabilityNote: string;
  competitiveness: "baixa" | "média" | "alta";
}

const FAPESP = "https://fapesp.br/valores/bolsasnopais";
const FED_REAJUSTE = "https://adufscar.org.br/veja-os-novos-valores-das-bolsas-de-estudo-do-cnpq-e-da-capes/";
const PIBIC = "https://www.gov.br/cti/pt-br/programas-de-bolsas/pibic/editais/EditalPIBICCTI2025_2026.pdf";

export const BOLSAS_BRASIL: Record<Level, BolsaInfo> = {
  grad: {
    level: "grad",
    programLabel: "Iniciação Científica (PIBIC/IC)",
    agencies: [
      { name: "CNPq",   monthlyBRL: 700,  sourceUrl: PIBIC, asOf: "2025" },
      { name: "CAPES",  monthlyBRL: 700,  sourceUrl: FED_REAJUSTE, asOf: "2025" },
      { name: "FAPESP", monthlyBRL: 1140, sourceUrl: FAPESP, asOf: "2025" },
    ],
    availabilityNote: "Cotas amplas por universidade (PIBIC/PIBITI), mas muito concorridas; valor federal de R$700 congelado desde 2023.",
    competitiveness: "média",
  },
  msc: {
    level: "msc",
    programLabel: "Mestrado",
    agencies: [
      { name: "CAPES",  monthlyBRL: 2100, sourceUrl: FED_REAJUSTE, asOf: "2025" },
      { name: "CNPq",   monthlyBRL: 2100, sourceUrl: FED_REAJUSTE, asOf: "2025" },
      { name: "FAPESP", monthlyBRL: 3450, sourceUrl: FAPESP, asOf: "2025" },
    ],
    availabilityNote: "PPGs bem avaliados (CAPES 5–7) contemplam a maioria; federal R$2.100 desde 2023, reajuste em negociação (CAPES pediu +R$500mi p/ 2025).",
    competitiveness: "média",
  },
  phd: {
    level: "phd",
    programLabel: "Doutorado",
    agencies: [
      { name: "CAPES",  monthlyBRL: 3100, sourceUrl: FED_REAJUSTE, asOf: "2025" },
      { name: "CNPq",   monthlyBRL: 3100, sourceUrl: FED_REAJUSTE, asOf: "2025" },
      { name: "FAPESP", monthlyBRL: 7140, sourceUrl: FAPESP, asOf: "2025" },
    ],
    availabilityNote: "Alta prioridade de fomento; doutorandos em PPGs fortes costumam ser bolsistas; federal R$3.100 desde 2023.",
    competitiveness: "média",
  },
  postdoc: {
    level: "postdoc",
    programLabel: "Pós-Doutorado (PNPD/PD)",
    agencies: [
      { name: "CAPES",  monthlyBRL: 5200,  sourceUrl: FED_REAJUSTE, asOf: "2025" },
      { name: "CNPq",   monthlyBRL: 5200,  sourceUrl: FED_REAJUSTE, asOf: "2025" },
      { name: "FAPESP", monthlyBRL: 12570, sourceUrl: FAPESP, asOf: "2025" },
    ],
    availabilityNote: "Cotas PNPD limitadas por programa — as mais disputadas; federal R$5.200 (+25% em 2023). FAPESP PD é a maior do país.",
    competitiveness: "alta",
  },
};

export function getBolsaInfo(level: Level): BolsaInfo {
  return BOLSAS_BRASIL[level];
}

export function bolsaRange(level: Level): { reference: number; min: number; max: number } {
  const all = BOLSAS_BRASIL[level].agencies.map((a) => a.monthlyBRL);
  const federal = BOLSAS_BRASIL[level].agencies.filter((a) => a.name !== "FAPESP").map((a) => a.monthlyBRL);
  return { reference: Math.min(...federal), min: Math.min(...all), max: Math.max(...all) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/scholar/bolsas-brasil.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scholar/bolsas-brasil.ts lib/scholar/bolsas-brasil.test.ts
git commit -m "feat(scholar): dataset curado de bolsas CAPES/CNPq/FAPESP (cenário 2025)"
```

---

## Task 3: `lib/scholar/termometro.ts` — métricas determinísticas

**Files:**
- Create: `lib/scholar/termometro.ts`
- Test: `lib/scholar/termometro.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/scholar/termometro.test.ts
import { describe, it, expect } from "vitest";
import {
  estimateResearchTime, scholarshipOutlook, publicationTarget, buildTermometro,
} from "./termometro";

describe("termometro", () => {
  it("tempo de pesquisa por nível", () => {
    expect(estimateResearchTime("grad").label).toBe("6–12 meses");
    expect(estimateResearchTime("phd").typicalMonths).toBeGreaterThan(estimateResearchTime("msc").typicalMonths);
  });
  it("outlook de bolsa do mestrado usa valor federal de referência e faixa até FAPESP", () => {
    const o = scholarshipOutlook("msc");
    expect(o.monthlyValueBRL).toBe(2100);
    expect(o.monthlyValueRangeBRL).toEqual([2100, 3450]);
    expect(o.agencies).toContain("FAPESP");
    expect(["baixa", "média", "alta"]).toContain(o.probability);
    expect(o.probabilityScore).toBeGreaterThan(0);
    expect(o.probabilityScore).toBeLessThanOrEqual(1);
  });
  it("pós-doc tem competitividade alta", () => {
    expect(scholarshipOutlook("postdoc").competitiveness).toBe("alta");
  });
  it("alvo de publicação por nível", () => {
    expect(publicationTarget("phd").qualis).toBe("Q1");
    expect(publicationTarget("grad").qualis).toMatch(/B/);
  });
  it("buildTermometro faz clamp do gapScore e rotula", () => {
    expect(buildTermometro("phd", 1.5).gapScore).toBe(1);
    expect(buildTermometro("phd", -2).gapScore).toBe(0);
    expect(buildTermometro("phd", NaN).gapScore).toBe(0);
    const t = buildTermometro("postdoc", 0.9);
    expect(t.gapLabel).toMatch(/Pioneira/);
    expect(t.level).toBe("postdoc");
    expect(t.scholarship.monthlyValueBRL).toBe(5200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/scholar/termometro.test.ts`
Expected: FAIL — `Cannot find module './termometro'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/scholar/termometro.ts
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
  grad:    { qualis: "B3–B4", tier: "Revista regional / anais",                    note: "TCC aprovado; possível artigo em revista regional brasileira." },
  msc:     { qualis: "A2–B1", tier: "Periódico Scopus/WoS",                        note: "1–2 artigos indexados; metodologia controlada." },
  phd:     { qualis: "Q1",    tier: "Journal internacional (IF > 3.0)",            note: "2–3 artigos Q1; contribuição original na fronteira." },
  postdoc: { qualis: "Q1+",   tier: "Top-tier (Nature/Science/PNAS, IF > 8.0)",    note: "Alto impacto; cruzamento de disciplinas inédito." },
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/scholar/termometro.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scholar/termometro.ts lib/scholar/termometro.test.ts
git commit -m "feat(scholar): termômetro acadêmico (tempo, bolsa, gap, publicação) por nível"
```

---

## Task 4: `lib/scholar/retrieve.ts` — busca com garantia de ≥12

**Files:**
- Create: `lib/scholar/retrieve.ts`
- Test: `lib/scholar/retrieve.test.ts`

`retrievePapers` recebe um `search` injetável (default = `searchAll` real) para teste determinístico.

- [ ] **Step 1: Write the failing test**

```ts
// lib/scholar/retrieve.test.ts
import { describe, it, expect, vi } from "vitest";
import { retrievePapers, mergeDisplayReferences } from "./retrieve";
import type { Paper } from "./types";
import type { SourceName, SourceResult } from "./sources";

const mk = (id: string, over: Partial<Paper> = {}): Paper => ({
  id, title: `t-${id}`, authors: [], openAccess: false, sources: ["x"], ...over,
});
// devolve N papers únicos para uma dada fonte
const papersFor = (src: SourceName, n: number, offset = 0): Paper[] =>
  Array.from({ length: n }, (_, i) => mk(`${src}-${offset + i}`, { sources: [src] }));

describe("retrievePapers", () => {
  it("dedup + atinge o mínimo só com as fontes primárias", async () => {
    const search = vi.fn(async (_q: string, sources: SourceName[]): Promise<SourceResult[]> =>
      sources.map((s) => ({ source: s, papers: papersFor(s, 5), status: "ok" as const })));
    const r = await retrievePapers("ia", { domain: undefined, minResults: 12, search });
    expect(r.papers.length).toBeGreaterThanOrEqual(12);
    expect(r.reachedMin).toBe(true);
    expect(search).toHaveBeenCalledTimes(1); // sem top-up
  });

  it("faz top-up nas fontes restantes quando as primárias não bastam", async () => {
    const search = vi.fn(async (_q: string, sources: SourceName[]): Promise<SourceResult[]> => {
      // primárias (default: semanticscholar/openalex/arxiv/crossref) devolvem só 2 cada;
      // top-up (pubmed) devolve 20.
      return sources.map((s) =>
        s === "pubmed"
          ? { source: s, papers: papersFor(s, 20), status: "ok" as const }
          : { source: s, papers: papersFor(s, 2), status: "ok" as const });
    });
    const r = await retrievePapers("medicina", { minResults: 12, search });
    expect(search).toHaveBeenCalledTimes(2); // primárias + top-up
    expect(r.reachedMin).toBe(true);
    expect(r.papers.length).toBeGreaterThanOrEqual(12);
  });

  it("degrada graciosamente (reachedMin=false) quando todas as fontes trazem pouco", async () => {
    const search = vi.fn(async (_q: string, sources: SourceName[]): Promise<SourceResult[]> =>
      sources.map((s) => ({ source: s, papers: papersFor(s, 1), status: "ok" as const })));
    const r = await retrievePapers("tópico raro", { minResults: 12, search });
    expect(r.reachedMin).toBe(false);
    expect(r.papers.length).toBeLessThan(12);
  });

  it("chama onSource para cada fonte e reporta perSource", async () => {
    const seen: string[] = [];
    const search = async (_q: string, sources: SourceName[]): Promise<SourceResult[]> =>
      sources.map((s) => ({ source: s, papers: papersFor(s, 4), status: "ok" as const }));
    const r = await retrievePapers("dados", { minResults: 12, search, onSource: (x) => seen.push(x.source) });
    expect(seen.length).toBe(r.perSource.length);
    expect(r.perSource.every((p) => p.count === 4)).toBe(true);
  });

  it("string vazia → resultado vazio sem chamar search", async () => {
    const search = vi.fn();
    const r = await retrievePapers("   ", { search: search as any });
    expect(r.papers).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });
});

describe("mergeDisplayReferences", () => {
  it("verificados primeiro, sem duplicar, completando até o mínimo", () => {
    const verified = [mk("a"), mk("b")];
    const discovered = [mk("a"), mk("c"), mk("d"), mk("e"), ...Array.from({ length: 10 }, (_, i) => mk(`g${i}`))];
    const out = mergeDisplayReferences(verified, discovered, 12);
    expect(out.length).toBe(12);
    expect(out[0].id).toBe("a");
    expect(out[1].id).toBe("b");
    expect(new Set(out.map((p) => p.id)).size).toBe(12); // sem duplicatas
  });
  it("mantém todos os verificados mesmo acima do mínimo", () => {
    const verified = Array.from({ length: 15 }, (_, i) => mk(`v${i}`));
    expect(mergeDisplayReferences(verified, [], 12).length).toBe(15);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/scholar/retrieve.test.ts`
Expected: FAIL — `Cannot find module './retrieve'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/scholar/retrieve.ts
import type { Paper } from "./types";
import { basesForDomain, searchAll, type SourceName, type SourceResult } from "./sources";
import { dedupePapers } from "./dedup";

const ALL_SOURCES: SourceName[] = ["semanticscholar", "openalex", "arxiv", "crossref", "pubmed"];
export const MIN_RESULTS = 12;

export interface RetrieveOptions {
  domain?: string;
  minResults?: number;
  search?: (query: string, sources: SourceName[]) => Promise<SourceResult[]>;
  onSource?: (r: SourceResult) => void;
}

export interface RetrieveResult {
  papers: Paper[];
  perSource: { source: SourceName; count: number; status: SourceResult["status"] }[];
  reachedMin: boolean;
}

export async function retrievePapers(queries: string | string[], opts: RetrieveOptions = {}): Promise<RetrieveResult> {
  const minResults = opts.minResults ?? MIN_RESULTS;
  const search = opts.search ?? searchAll;
  const qs = [...new Set((Array.isArray(queries) ? queries : [queries]).map((q) => q.trim()).filter(Boolean))].slice(0, 3);
  if (!qs.length) return { papers: [], perSource: [], reachedMin: false };

  const primary = basesForDomain(opts.domain);
  const perSource: RetrieveResult["perSource"] = [];
  let pool: Paper[] = [];

  const run = async (query: string, sources: SourceName[]) => {
    const results = await search(query, sources);
    for (const r of results) {
      opts.onSource?.(r);
      perSource.push({ source: r.source, count: r.papers.length, status: r.status });
      pool = pool.concat(r.papers);
    }
  };

  for (const q of qs) await run(q, primary);
  let unique = dedupePapers(pool);

  // Top-up: amplia para as fontes restantes (na query principal) se não bateu o mínimo.
  if (unique.length < minResults) {
    const extra = ALL_SOURCES.filter((s) => !primary.includes(s));
    if (extra.length) {
      await run(qs[0], extra);
      unique = dedupePapers(pool);
    }
  }

  return { papers: unique, perSource, reachedMin: unique.length >= minResults };
}

// Lista de exibição ≥ min: citações verificadas primeiro, depois descobertas relacionadas, sem duplicar.
export function mergeDisplayReferences(verified: Paper[], discovered: Paper[], min = MIN_RESULTS): Paper[] {
  const ids = new Set(verified.map((p) => p.id));
  const related = discovered.filter((p) => !ids.has(p.id));
  return [...verified, ...related].slice(0, Math.max(min, verified.length));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/scholar/retrieve.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scholar/retrieve.ts lib/scholar/retrieve.test.ts
git commit -m "feat(scholar): retrievePapers com garantia de ≥12 + merge de referências"
```

---

## Task 5: integrar `retrievePapers` na rota do scholar (≥12 na aba Omega)

**Files:**
- Modify: `app/api/ai/scholar/route.ts`

- [ ] **Step 1: Substituir imports e o bloco de busca**

Trocar os imports do topo (remover `basesForDomain, searchAll` e `dedupePapers`; adicionar retrieve):

```ts
import { retrievePapers, mergeDisplayReferences, MIN_RESULTS } from "@/lib/scholar/retrieve";
import { resolveFullText } from "@/lib/scholar/fulltext";
import { planQuery, synthesize } from "@/lib/scholar/synthesize";
import { assembleResults } from "@/lib/scholar/assemble";
import { buildReferencesBib } from "@/lib/scholar/bibtex";
import { planTone } from "@/lib/scholar/prompt";
import { mapLimit } from "@/lib/scholar/http";
import type { ScholarEvent } from "@/lib/scholar/types";
```

(Remove-se `Paper` do import — o refactor não anota mais o tipo diretamente, e import não usado quebra o lint/strict.)

Substituir o trecho de SEARCH + DEDUP (do `const bases = ...` até o `send({ ... phase: "dedup" ... })`) por:

```ts
        // SEARCH (garante ≥ MIN_RESULTS pesquisas)
        const queries = plan.queries.length ? plan.queries : [prompt];
        const retrieved = await retrievePapers(queries, {
          domain: plan.domain,
          minResults: MIN_RESULTS,
          onSource: (r) =>
            send({
              type: "phase",
              phase: "searching",
              source: r.source,
              count: r.papers.length,
              message:
                r.status === "ok"
                  ? `✓ ${r.source}: ${r.papers.length} papers`
                  : r.status === "rate_limited"
                    ? `⏳ ${r.source}: limite de requisições atingido (tentei reenviar)`
                    : `⚠ ${r.source}: indisponível agora`,
            }),
        });
        const unique = retrieved.papers;

        // FULL TEXT (top N — síntese profunda só nos primeiros, por qualidade/velocidade)
        const top = unique.slice(0, 10);
        const withText = await mapLimit(top, 3, (p) => resolveFullText(p));
        const ftCount = withText.filter(
          (p) => p.retrievedText && p.retrievedText.kind !== "abstract"
        ).length;
        send({
          type: "phase",
          phase: "dedup",
          unique: unique.length,
          fulltext: ftCount,
          message: `✓ ${unique.length} pesquisas encontradas · full-text aberto de ${ftCount}`,
        });
```

- [ ] **Step 2: Construir a lista de exibição ≥12 ao salvar**

Logo após `const r = assembleResults(prompt, grounded, raw);` e o `send` de "verifying", trocar a montagem de referências salvas. Substituir `references: r.references as any,` por uma referência à lista mesclada. Inserir antes do `prisma.scholarSession.update`:

```ts
        // Referências exibidas (≥12): citações verificadas primeiro, depois descobertas relacionadas.
        const displayReferences = mergeDisplayReferences(r.references, unique, MIN_RESULTS);
```

E no `data:` do update, usar:

```ts
            references: displayReferences as any,
```

(O `r.files` / literature-review.md continua baseado nas verificadas — não alterar.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros (rotas não têm teste unitário; a lógica de ≥12 já está coberta em `retrieve.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add app/api/ai/scholar/route.ts
git commit -m "feat(omega): engine garante ≥12 pesquisas exibidas na aba (verificadas + relacionadas)"
```

---

## Task 6: `lib/scholar/prompts-suggest.ts` — port do prompt do Arquiteto de Pesquisa

**Files:**
- Create: `lib/scholar/prompts-suggest.ts`
- Test: `lib/scholar/prompts-suggest.test.ts`

Port fiel de `research-engine/prompts.py` (calibração por nível preservada).

- [ ] **Step 1: Write the failing test**

```ts
// lib/scholar/prompts-suggest.test.ts
import { describe, it, expect } from "vitest";
import { buildSuggestSystemPrompt, buildSuggestUserMessage } from "./prompts-suggest";

describe("prompts-suggest", () => {
  it("inclui o bloco de calibração do nível pedido", () => {
    expect(buildSuggestSystemPrompt("msc", [])).toMatch(/MESTRANDO/);
    expect(buildSuggestSystemPrompt("phd", [])).toMatch(/DOUTORANDO/);
  });
  it("injeta os títulos a excluir como restrição", () => {
    const p = buildSuggestSystemPrompt("grad", ["Título A", "Título B"]);
    expect(p).toMatch(/RESTRIÇÃO/);
    expect(p).toMatch(/Título A/);
    expect(p).toMatch(/Título B/);
  });
  it("nível inválido cai no grad", () => {
    expect(buildSuggestSystemPrompt("xxx" as any, [])).toMatch(/GRADUANDO/);
  });
  it("a mensagem do usuário carrega o tópico", () => {
    expect(buildSuggestUserMessage("redes neurais")).toMatch(/redes neurais/);
  });
  it("pede JSON puro no formato esperado", () => {
    const p = buildSuggestSystemPrompt("postdoc", []);
    expect(p).toMatch(/"gap_score"/);
    expect(p).toMatch(/JSON/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/scholar/prompts-suggest.test.ts`
Expected: FAIL — `Cannot find module './prompts-suggest'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/scholar/prompts-suggest.ts
// Port TS de research-engine/prompts.py — Arquiteto de Pesquisa, calibrado por nível.
import type { Level } from "./levels";

const LEVEL_INSTRUCTIONS: Record<Level, string> = {
  grad: `GRADUANDO — Modo EXPLORATÓRIA
• Objetivo: mapeamento territorial com twist local/contextual único
• Prazo realista: 6-12 meses
• Alvo publicação: TCC aprovado; possível artigo em revista regional (Qualis B3-B4)
• Regra de ouro: o gap deve existir na literatura internacional, mas ser INEXPLORADO no contexto brasileiro ou para uma variável específica — não exija novidade absoluta
• Tipo esperado: "Exploratória"`,
  msc: `MESTRANDO — Modo EXPERIMENTAL
• Objetivo: contribuição original com hipótese testável e metodologia controlada
• Prazo realista: 18-24 meses (dissertação)
• Alvo publicação: 1-2 artigos Scopus (Qualis A2-B1)
• Regra de ouro: a hipótese DEVE ser testável com recursos de universidade federal brasileira; prefira designs quasi-experimentais, metanálises, coortes
• Tipo esperado: "Experimental"`,
  phd: `DOUTORANDO — Modo PIONEIRA
• Objetivo: contribuição que avance a FRONTEIRA INTERNACIONAL do conhecimento
• Prazo realista: 3-4 anos (tese)
• Alvo publicação: 2-3 artigos Q1 internacional (IF > 3.0)
• Regra de ouro: identifique gap real na literatura indexada E proponha método inovador/interdisciplinar — gap_score mínimo 0.70
• Tipo esperado: "Pioneira"`,
  postdoc: `PÓS-DOC — Modo PIONEIRA ULTRA
• Objetivo: pesquisa paradigmática que redefina um campo ou crie um subdomínio
• Prazo: 1-2 anos com resultado publicável rapidamente
• Alvo publicação: Nature/Science/PNAS ou Q1 de alta relevância (IF > 8.0)
• Regra de ouro: a combinação TEMA + MÉTODO + CONTEXTO deve ser ÚNICA no mundo — gap_score mínimo 0.85
• Tipo esperado: "Pioneira"`,
};

export function buildSuggestSystemPrompt(level: Level, excludeTitles: string[]): string {
  const block = LEVEL_INSTRUCTIONS[level] ?? LEVEL_INSTRUCTIONS.grad;
  const exclude = excludeTitles.length
    ? `\nRESTRIÇÃO OBRIGATÓRIA — os títulos abaixo JÁ foram sugeridos; NÃO repita nem parafraseie, proponha ângulo COMPLETAMENTE diferente:\n${excludeTitles.map((t) => `  • ${t}`).join("\n")}\n`
    : "";

  return `Você é ARQUITETO DE PESQUISA — estrategista acadêmico de classe mundial. Missão: identificar UMA oportunidade de pesquisa original, viável no nível informado, e de máximo valor científico.
${exclude}
PROCESSO INTERNO (raciocine antes de responder):
1) VARREDURA DE LACUNAS: empíricas, metodológicas, geográficas, temporais (pós-2022) e interdisciplinares. Para cada, estime novidade×0.4 + relevância×0.4 + viabilidade×0.2 e escolha a de maior score.
2) DETECÇÃO PIONEIRA: sinalize quando nenhum trabalho recente cobre o ângulo, há cruzamento interdisciplinar promissor, ou contradições não resolvidas.
3) CALIBRAÇÃO DE NÍVEL:
${block}
4) REFERÊNCIAS: cite 5-9 trabalhos reais de alta confiança (2018-2024), de fontes reconhecidas, classificando a fonte (PubMed | arXiv | DOI | Scholar).

FORMATO DE SAÍDA — JSON PURO, SEM MARKDOWN, SEM TEXTO FORA DO JSON:
{
  "suggestion": {
    "type": "Exploratória | Experimental | Pioneira",
    "title": "<título da pesquisa, máx 180 caracteres>",
    "rationale": "<1-2 frases: qual lacuna e por que vale; máx 300 caracteres>",
    "novelty_angle": "<o que torna único; máx 120 caracteres>",
    "gap_score": <float 0.0-1.0>
  },
  "references": [
    { "source": "PubMed | arXiv | DOI | Scholar", "title": "...", "authors": "...", "year": "YYYY", "venue": "...", "doi": "10.xxx/... ou null" }
  ],
  "inline_citation": null
}`;
}

export function buildSuggestUserMessage(topic: string): string {
  return `Tópico de pesquisa do estudante: "${topic}"\n\nGere a sugestão e as referências conforme o processo descrito.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/scholar/prompts-suggest.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scholar/prompts-suggest.ts lib/scholar/prompts-suggest.test.ts
git commit -m "feat(scholar): port TS do prompt do Arquiteto de Pesquisa (calibrado por nível)"
```

---

## Task 7: `lib/scholar/suggest.ts` — montagem da sugestão (Gemini + refs reais + termômetro)

**Files:**
- Modify: `lib/scholar/gemini.ts` (adicionar temperatura opcional — aditivo)
- Create: `lib/scholar/suggest.ts`
- Test: `lib/scholar/suggest.test.ts`

- [ ] **Step 1: Tornar a temperatura configurável no wrapper Gemini (aditivo, default 0.2)**

Em `lib/scholar/gemini.ts`, alterar as assinaturas (mantendo o comportamento padrão):

```ts
export function getGeminiModel(systemInstruction?: string, opts?: { temperature?: number }) {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || "{}");
  const vertexAI = new VertexAI({
    project: credentials.project_id || process.env.GOOGLE_PROJECT_ID,
    location: process.env.GOOGLE_LOCATION || "us-central1",
    googleAuthOptions: { credentials: { client_email: credentials.client_email, private_key: credentials.private_key } },
  });
  return vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash-001",
    generationConfig: { temperature: opts?.temperature ?? 0.2, responseMimeType: "application/json" },
    ...(systemInstruction ? { systemInstruction: { role: "system", parts: [{ text: systemInstruction }] } } : {}),
  });
}

export async function geminiJson<T>(systemInstruction: string, userPrompt: string, opts?: { temperature?: number }): Promise<T> {
  const model = getGeminiModel(systemInstruction, opts);
  const result = await model.generateContent(userPrompt);
  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(text) as T;
}
```

(`synthesize.ts` chama `geminiJson` sem `opts` → segue em 0.2; sem mudança de comportamento.)

- [ ] **Step 2: Write the failing test**

```ts
// lib/scholar/suggest.test.ts
import { describe, it, expect } from "vitest";
import { generateSuggestion, parseSuggestion, paperToRefItem } from "./suggest";
import type { Paper } from "./types";

const mk = (over: Partial<Paper>): Paper => ({
  id: "x", title: "t", authors: [], openAccess: false, sources: ["semanticscholar"], ...over,
});

describe("parseSuggestion", () => {
  it("lê JSON válido", () => {
    const s = parseSuggestion('{"suggestion":{"type":"Pioneira","title":"T","rationale":"R","novelty_angle":"N","gap_score":0.8}}', "Exploratória");
    expect(s.type).toBe("Pioneira");
    expect(s.title).toBe("T");
    expect(s.gap_score).toBe(0.8);
  });
  it("tolera cercas markdown", () => {
    const s = parseSuggestion('```json\n{"suggestion":{"title":"X","gap_score":0.5}}\n```', "Experimental");
    expect(s.title).toBe("X");
    expect(s.type).toBe("Experimental"); // type ausente → fallback
  });
  it("JSON malformado → fallback seguro", () => {
    const s = parseSuggestion("isto não é json", "Exploratória");
    expect(s.type).toBe("Exploratória");
    expect(s.gap_score).toBe(0.5);
    expect(s.title).toBe("");
  });
  it("clampa o gap_score", () => {
    expect(parseSuggestion('{"suggestion":{"gap_score":9}}', "Pioneira").gap_score).toBe(1);
  });
});

describe("paperToRefItem", () => {
  it("classifica a fonte", () => {
    expect(paperToRefItem(mk({ sources: ["arxiv"], arxivId: "1" })).source).toBe("arXiv");
    expect(paperToRefItem(mk({ sources: ["pubmed"] })).source).toBe("PubMed");
    expect(paperToRefItem(mk({ sources: ["crossref"], doi: "10.1/x" })).source).toBe("DOI");
    expect(paperToRefItem(mk({ sources: ["openalex"] })).source).toBe("Scholar");
  });
  it("formata autores com et al.", () => {
    expect(paperToRefItem(mk({ authors: ["A", "B", "C", "D"] })).authors).toMatch(/et al\./);
  });
});

describe("generateSuggestion", () => {
  const llm = async () => '{"suggestion":{"type":"Experimental","title":"Estudo X","rationale":"R","novelty_angle":"N","gap_score":0.6}}';
  const retrieve = async () => ({
    papers: [mk({ id: "p1", sources: ["arxiv"], arxivId: "a" }), mk({ id: "p2", sources: ["pubmed"] }), mk({ id: "p3", doi: "10.1/z" })],
    perSource: [], reachedMin: false,
  });

  it("monta sugestão + referências reais + termômetro do nível", async () => {
    const r = await generateSuggestion({ topic: "tema", level: "msc" }, { llm, retrieve });
    expect(r.suggestion.title).toBe("Estudo X");
    expect(r.references.length).toBe(3);
    expect(r.references[0].source).toBe("arXiv");
    expect(r.termometro.level).toBe("msc");
    expect(r.termometro.scholarship.monthlyValueBRL).toBe(2100);
    expect(r.termometro.gapScore).toBe(0.6);
  });

  it("falha de retrieve não derruba a sugestão", async () => {
    const r = await generateSuggestion({ topic: "tema", level: "phd" }, { llm, retrieve: async () => { throw new Error("offline"); } });
    expect(r.references).toEqual([]);
    expect(r.termometro.level).toBe("phd");
    expect(r.suggestion.title).toBe("Estudo X");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/scholar/suggest.test.ts`
Expected: FAIL — `Cannot find module './suggest'`.

- [ ] **Step 4: Write minimal implementation**

```ts
// lib/scholar/suggest.ts
import { getGeminiModel } from "./gemini";
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
  return result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/scholar/suggest.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/scholar/gemini.ts lib/scholar/suggest.ts lib/scholar/suggest.test.ts
git commit -m "feat(scholar): geração de sugestão em TS (Gemini + refs reais + termômetro)"
```

---

## Task 8: rota TS `app/api/ai/research-suggest/route.ts` (substitui proxy Python)

**Files:**
- Modify: `app/api/ai/research-suggest/route.ts`

- [ ] **Step 1: Reescrever a rota**

```ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { generateSuggestion } from "@/lib/scholar/suggest";
import { isLevel } from "@/lib/scholar/levels";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });

  // session.user não carrega id — checa existência por email (mesmo padrão das outras rotas).
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!dbUser) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const level = isLevel(body.level) ? body.level : "grad";
  const excludeTitles = Array.isArray(body.exclude_titles)
    ? body.exclude_titles.filter((t: unknown): t is string => typeof t === "string")
    : [];

  if (topic.length < 2) {
    return new Response(JSON.stringify({ error: "Tópico inválido (mínimo 2 caracteres)." }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await generateSuggestion({ topic, level, excludeTitles });
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "Falha ao gerar sugestão." }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/api/ai/research-suggest/route.ts
git commit -m "feat(api): research-suggest roda em TS (remove dependência do Python; funciona em prod)"
```

---

## Task 9: card de Termômetro em `ResearchSuggestionPanel.tsx`

**Files:**
- Modify: `components/research/ResearchSuggestionPanel.tsx`

- [ ] **Step 1: Estender o tipo de resposta com `termometro`**

No topo do arquivo, importar o tipo e adicioná-lo a `EngineResponse`:

```ts
import type { Termometro } from "@/lib/scholar/termometro";
```

Alterar a interface:

```ts
interface EngineResponse {
  suggestion: Suggestion;
  references: RefItem[];
  termometro?: Termometro;
  inline_citation?: { quote: string; source: string; doi?: string } | null;
}
```

- [ ] **Step 2: Adicionar o helper de moeda e o card do termômetro**

Acima do `return (` do componente, adicionar:

```tsx
  const brl = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
```

Inserir o bloco do termômetro logo **após** o fechamento do `{/* ── SUGGESTION CARD ── */}` e antes de `{/* ── REFERENCES ── */}`:

```tsx
      {/* ── TERMÔMETRO ── */}
      {result?.termometro && !loading && (
        <div className="mx-5 mb-3.5 grid grid-cols-2 gap-2">
          {/* Tempo médio */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
            <p className="text-[7px] font-black uppercase tracking-[.18em] text-white/25 mb-1">Tempo médio</p>
            <p className="text-[13px] font-extrabold text-cyan-300/90">{result.termometro.researchTime.label}</p>
          </div>
          {/* Bolsa */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
            <p className="text-[7px] font-black uppercase tracking-[.18em] text-white/25 mb-1">Bolsa · {result.termometro.scholarship.probability}</p>
            <p className="text-[13px] font-extrabold text-emerald-300/90">{brl(result.termometro.scholarship.monthlyValueBRL)}<span className="text-[8px] font-bold text-white/30">/mês</span></p>
            <p className="text-[7px] text-white/30 mt-0.5">até {brl(result.termometro.scholarship.monthlyValueRangeBRL[1])} · {result.termometro.scholarship.agencies.join(" · ")}</p>
          </div>
          {/* Gap / originalidade */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
            <p className="text-[7px] font-black uppercase tracking-[.18em] text-white/25 mb-1.5">Originalidade</p>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" style={{ width: `${Math.round(result.termometro.gapScore * 100)}%` }} />
            </div>
            <p className="text-[8px] text-white/35 mt-1">{result.termometro.gapLabel}</p>
          </div>
          {/* Alvo de publicação */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
            <p className="text-[7px] font-black uppercase tracking-[.18em] text-white/25 mb-1">Alvo publicação</p>
            <p className="text-[13px] font-extrabold text-violet-300/90">{result.termometro.publication.qualis}</p>
            <p className="text-[7px] text-white/30 mt-0.5">{result.termometro.publication.tier}</p>
          </div>
          {/* Nota do cenário */}
          <div className="col-span-2 p-2.5 rounded-xl bg-cyan-400/[0.04] border border-cyan-400/10">
            <p className="text-[8px] text-white/40 leading-snug">💡 {result.termometro.scholarship.note}</p>
          </div>
        </div>
      )}
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros nem novos warnings de lint no arquivo.

- [ ] **Step 4: Commit**

```bash
git add components/research/ResearchSuggestionPanel.tsx
git commit -m "feat(research): card de termômetro (tempo, bolsa R$, gap, Qualis) no painel de sugestão"
```

---

## Task 10: highlight de sugestão montado na aba Omega

**Files:**
- Create: `app/workstation/student/omega/OmegaSuggestionHighlight.tsx`
- Modify: `app/workstation/student/omega/OmegaScholarWorkspace.tsx`

- [ ] **Step 1: Criar o componente de highlight**

```tsx
// app/workstation/student/omega/OmegaSuggestionHighlight.tsx
"use client";
import ResearchSuggestionPanel from "@/components/research/ResearchSuggestionPanel";
import { useOmegaScholar } from "./OmegaScholarContext";

// Highlight de sugestão dentro da aba Omega, semeado pela query/draft atual do Omega.
export default function OmegaSuggestionHighlight() {
  const { query, draft, setDraft } = useOmegaScholar();
  const seed = (query || draft || "").trim();
  return (
    <div className="mb-6">
      <ResearchSuggestionPanel docTitle={seed} onSelectTitle={(t) => setDraft(t)} />
    </div>
  );
}
```

- [ ] **Step 2: Montar no workspace do Omega**

Em `OmegaScholarWorkspace.tsx`, adicionar o import e renderizar logo após `<ActivityThread />`:

```tsx
import OmegaSuggestionHighlight from "./OmegaSuggestionHighlight";
```

```tsx
      <ActivityThread />
      <OmegaSuggestionHighlight />
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/workstation/student/omega/OmegaSuggestionHighlight.tsx app/workstation/student/omega/OmegaScholarWorkspace.tsx
git commit -m "feat(omega): highlight de sugestão com termômetro na aba do agente Omega"
```

---

## Task 11: verificação final + PR para `main`

**Files:** nenhuma alteração de código.

- [ ] **Step 1: Suíte completa verde**

Run: `npm test`
Expected: todos os arquivos passam, incluindo os novos (`levels`, `bolsas-brasil`, `termometro`, `retrieve`, `prompts-suggest`, `suggest`) e os pré-existentes (`assemble`, `dedup`, etc.).

- [ ] **Step 2: Type-check + lint do projeto**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros de tipo; lint sem novos erros.

- [ ] **Step 3: Build (best-effort)**

Run: `npm run build`
Expected: build conclui. Se falhar **apenas** por falta de env (credenciais Vertex/DB em build estático), registrar o motivo; não é bloqueante para o merge, pois o deploy roda com env de produção. Falhas de tipo/sintaxe SÃO bloqueantes.

- [ ] **Step 4: Push da branch e abertura do PR**

```bash
git push -u origin claude/eloquent-shockley-78ba2f
gh pr create --base main --title "feat(omega): engine ≥12 papers + termômetro acadêmico (bolsa/tempo/gap/Qualis)" --body "<resumo + checklist de testes verdes>"
```

- [ ] **Step 5: Merge do PR (após suíte verde confirmada)**

```bash
gh pr merge --squash --delete-branch
```

(Deploy automático para www.zaeon.space ao integrar na `main`.)

---

## Notas de verificação manual (pós-deploy / smoke)

- Aba Omega → fazer uma pergunta → a aba **Referências** deve listar **≥12** itens; os citados mostram bloco "VERIFICADO".
- Highlight de sugestão na aba Omega → escolher nível → "Gerar ✦" → aparece o card de **Termômetro** (tempo, bolsa R$/mês + faixa + agências, barra de originalidade, alvo Qualis) e referências reais.
- Trocar o nível (grad→postdoc) muda valores de bolsa e tempo de forma coerente com o dataset.
