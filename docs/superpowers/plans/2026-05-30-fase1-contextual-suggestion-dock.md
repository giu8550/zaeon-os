# Fase 1 — Dock de Sugestão Contextual na Sala de Estudos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover `ResearchSuggestionPanel` da aba `pesquisa` para a `sala-de-estudos`, exibido como dock contextual que aparece quando o usuário digita um termo acadêmico no input que já existe (`OmegaScholarBar`).

**Architecture:** Um classificador puro client-side (`isAcademicTerm`) pontua o texto digitado contra um léxico extraído do repo. O input da `OmegaScholarBar` é elevado ao `OmegaScholarContext` (`draft`/`setDraft`); um wrapper observa esse draft (debounce 350 ms) e renderiza o `ContextualSuggestionDock`, que encapsula o `ResearchSuggestionPanel` **sem alterar sua API**. O painel é removido da aba `pesquisa`.

**Tech Stack:** Next.js App Router (client components), React, framer-motion (existente), Tailwind, Heroicons, **vitest** (`vitest run`, testes `.test.ts` co-localizados). Sem infra de teste de componente (jsdom/testing-library não instalados) — a unidade testável é o classificador.

**Spec:** `docs/superpowers/specs/2026-05-30-research-suggestion-relocation-and-past-research-chat-design.md`

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `lib/scholar/academic-lexicon.json` | Criar | Dados: termos acadêmicos por domínio + nomes de bases. Fonte: OMEGA_SCHOLAR.md §2/§6.3/§7, research-engine/prompts.py, ROOM_MAPPING. |
| `lib/scholar/academic-term-classifier.ts` | Criar | Função pura `isAcademicTerm()`. Sem rede. |
| `lib/scholar/academic-term-classifier.test.ts` | Criar | ≥25 positivos / ≥25 negativos (vitest). |
| `components/research/ContextualSuggestionDock.tsx` | Criar | Wrapper de UI: gate (academic + len≥3), sticky, colapso (localStorage), cooldown, mounted guard. Renderiza `ResearchSuggestionPanel`. |
| `app/workstation/student/omega/StudyRoomSuggestionDock.tsx` | Criar | Liga `OmegaScholarContext.draft` (debounce 350 ms) ao dock; vive dentro do provider. |
| `app/workstation/student/omega/OmegaScholarContext.tsx` | Modificar | Adicionar `draft` + `setDraft` ao contexto. |
| `app/workstation/student/omega/OmegaScholarBar.tsx` | Modificar | Input passa a usar `draft`/`setDraft` do contexto (em vez de `value` local). |
| `app/workstation/student/StudyRoomContent.tsx` | Modificar | Renderizar `<StudyRoomSuggestionDock/>` logo após `<OmegaScholarBar/>`. |
| `app/research-lab/page.tsx` | Modificar | Remover bloco do painel (1161–1167), o import dinâmico (19–22) e o handler órfão `handleSelectResearchTitle` (973–975). |

**Decisão registrada (vs spec original):** o dock NÃO recebe prop `level` — `ResearchSuggestionPanel` já gerencia o nível internamente (default `postdoc`), não expõe prop de nível. Mantemos apenas `topic` + `onSelectTitle` (YAGNI).

---

## Task 1: Léxico acadêmico (dados)

**Files:**
- Create: `lib/scholar/academic-lexicon.json`

- [ ] **Step 1: Criar o arquivo de léxico**

Termos em minúsculas, sem acento (o classificador normaliza ambos os lados via NFD). Bases curadas para evitar falsos positivos (removidos nomes que colidem com palavras comuns: "base", "core", "eric").

```json
{
  "bases": [
    "arxiv", "pubmed", "medline", "biorxiv", "medrxiv", "scielo", "scopus",
    "semantic scholar", "openalex", "crossref", "unpaywall", "europe pmc",
    "clinicaltrials", "cochrane", "ieee xplore", "acm", "chemrxiv", "pubchem",
    "inspire-hep", "nasa ads", "ncbi", "uniprot", "ensembl", "ssrn", "repec",
    "nber", "philpapers", "figshare", "doaj", "zenodo", "jstor", "osf",
    "web of science", "google scholar", "researchgate", "psyarxiv", "socarxiv"
  ],
  "domains": {
    "cs": [
      "deep learning", "machine learning", "aprendizado de maquina", "transformer",
      "llm", "rede neural", "neural network", "redes neurais", "reinforcement learning",
      "aprendizado por reforco", "federated learning", "graph neural network", "gnn",
      "computer vision", "visao computacional", "fine-tuning", "algoritmo", "algorithm",
      "inteligencia artificial", "ciencia de dados", "data science", "overfitting",
      "gradient descent", "backpropagation", "ciencia da computacao", "engenharia de software",
      "processamento de linguagem natural", "nlp", "embedding"
    ],
    "bio": [
      "crispr", "genoma", "genome", "gene", "proteina", "protein", "sequenciamento",
      "sequencing", "biotecnologia", "bioinformatica", "enzima", "enzyme", "celula",
      "cell", "microbioma", "microbiome", "ecologia", "fotossintese", "photosynthesis",
      "bioquimica", "rna", "dna", "mutacao", "mutation", "organismo", "bacteria",
      "biologia molecular"
    ],
    "med": [
      "ensaio clinico", "clinical trial", "diagnostico", "diagnosis", "terapia",
      "therapy", "paciente", "patient", "cancer", "tumor", "vacina", "vaccine",
      "farmaco", "drug", "epidemiologia", "epidemiology", "medicina", "enfermagem",
      "imunologia", "immunology", "biomarcador", "biomarker", "fmri", "cortex",
      "neuronio", "sinapse", "neurociencia", "neuroscience", "patologia", "comorbidade"
    ],
    "phys": [
      "quantico", "mecanica quantica", "quantum mechanics", "dft", "relatividade",
      "relativity", "particula", "particle", "fermion", "boson", "astrofisica",
      "astrophysics", "cosmologia", "cosmology", "termodinamica", "thermodynamics",
      "fisica", "supercondutor", "superconductor", "plasma", "fotonica", "photonics",
      "eletromagnetismo", "fluido"
    ],
    "chem": [
      "graphene", "grafeno", "oxido", "oxide", "synthesis", "sintese", "catalise",
      "catalysis", "polimero", "polymer", "molecula", "molecule", "reagente",
      "composto", "compound", "espectroscopia", "spectroscopy", "cromatografia",
      "chromatography", "nanomaterial", "quimica", "solvente", "reacao quimica"
    ],
    "eng": [
      "semicondutor", "semiconductor", "nanotubo", "nanotube", "fotovoltaico",
      "photovoltaic", "biorreator", "bioreactor", "materiais", "materials",
      "aerodinamica", "aerodynamics", "robotica", "robotics", "sensor", "atuador",
      "microfluidica", "microfluidics", "engenharia estrutural", "turbina"
    ],
    "human": [
      "filosofia", "philosophy", "epistemologia", "epistemology", "historiografia",
      "fenomenologia", "phenomenology", "hermeneutica", "linguistica", "linguistics",
      "semiotica", "etica", "ontologia", "narrativa", "literatura comparada",
      "metafisica", "estetica"
    ],
    "social": [
      "sociologia", "sociology", "antropologia", "anthropology", "econometria",
      "econometrics", "pib", "inflacao", "politica fiscal", "ciencia politica",
      "political science", "pedagogia", "curriculo", "educacao", "jurisprudencia",
      "legislacao", "direito", "desigualdade", "etnografia", "ethnography",
      "ensaio randomizado", "demografia"
    ],
    "multi": [
      "revisao sistematica", "systematic review", "meta-analise", "metanalise",
      "meta-analysis", "estudo de coorte", "cohort study", "hipotese", "hypothesis",
      "metodologia", "methodology", "interdisciplinar", "interdisciplinary",
      "framework", "teorema", "theorem", "corpus", "dataset", "empirico", "empirical",
      "qualitativo", "quantitativo", "amostragem", "sampling", "validade",
      "peer review", "revisao de literatura", "literature review", "in vitro",
      "in vivo", "in silico", "preprint", "estado da arte"
    ]
  }
}
```

- [ ] **Step 2: Validar JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('lib/scholar/academic-lexicon.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add lib/scholar/academic-lexicon.json
git commit -m "feat(scholar): léxico acadêmico para classificador de termos (Fase 1)"
```

---

## Task 2: Classificador de termo acadêmico (TDD)

**Files:**
- Create: `lib/scholar/academic-term-classifier.ts`
- Test: `lib/scholar/academic-term-classifier.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { isAcademicTerm } from "./academic-term-classifier";

const POSITIVES: string[] = [
  "graphene oxide synthesis",
  "deep learning for cancer diagnosis",
  "revisão sistemática sobre CRISPR",
  "ab initio DFT of graphene",
  "meta-análise de ensaio clínico",
  "transformer neural network architecture",
  "quantum mechanics of a particle",
  "CRISPR gene editing",
  "photovoltaic semiconductor materials",
  "econometria da inflação",
  "systematic review of cancer therapy",
  "fMRI study of the cortex",
  "fine-tuning a large language model LLM",
  "graph neural network and deep learning",
  "photosynthesis in algae cells",
  "spectroscopy of a polymer compound",
  "epidemiology of vaccine efficacy",
  "reinforcement learning algorithm",
  "synthesis of TiO2 nanoparticles",
  "in vitro study of an enzyme",
  "astrophysics and cosmology of black holes",
  "philosophy of epistemology",
  "arXiv:2103.14030",
  "doi:10.1038/s41586-020-2649-2 vaccine",
  "PubMed search for immunology biomarker",
];

const NEGATIVES: string[] = [
  "comprar pão na padaria",
  "qual o horário do ônibus para o centro",
  "receita de bolo de chocolate fácil",
  "jogo de futebol hoje à noite",
  "quanto custa o ingresso do cinema",
  "previsão do tempo para amanhã",
  "melhor restaurante de pizza perto de mim",
  "como trocar o pneu do carro",
  "letra da música nova",
  "promoção de tênis na loja",
  "agendar consulta no salão de beleza",
  "qual o placar do jogo",
  "dieta para emagrecer rápido",
  "piada engraçada para contar",
  "horóscopo de hoje",
  "como fazer compras online",
  "viagem barata para a praia",
  "presente de aniversário para minha mãe",
  "consertar a torneira que está pingando",
  "qual o melhor celular custo benefício",
  "treino de academia para iniciantes",
  "como economizar dinheiro no mês",
  "filme de comédia para assistir",
  "vaga de emprego em vendas",
  "decoração de festa infantil",
];

describe("isAcademicTerm", () => {
  it.each(POSITIVES)("classifica como acadêmico: %s", (input) => {
    const r = isAcademicTerm(input);
    expect(r.isAcademic).toBe(true);
    expect(r.confidence).toBeGreaterThanOrEqual(0.55);
    expect(r.matchedTerms.length).toBeGreaterThan(0);
  });

  it.each(NEGATIVES)("classifica como NÃO acadêmico: %s", (input) => {
    const r = isAcademicTerm(input);
    expect(r.isAcademic).toBe(false);
    expect(r.confidence).toBeLessThan(0.55);
  });

  it("identifica domínio de domínio único", () => {
    expect(isAcademicTerm("graphene oxide synthesis").domain).toBe("chem");
    expect(isAcademicTerm("philosophy of epistemology").domain).toBe("human");
    expect(isAcademicTerm("reinforcement learning algorithm").domain).toBe("cs");
  });

  it("trata entrada vazia/curta com segurança", () => {
    expect(isAcademicTerm("").isAcademic).toBe(false);
    expect(isAcademicTerm("ai").isAcademic).toBe(false);
    expect(isAcademicTerm("  ").confidence).toBe(0);
  });

  it("um único termo comum não cruza o threshold (anti-ruído)", () => {
    expect(isAcademicTerm("comprei materiais escolares").isAcademic).toBe(false);
    expect(isAcademicTerm("qual o melhor framework de javascript").isAcademic).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npm test -- academic-term-classifier`
Expected: FAIL — "Failed to resolve import \"./academic-term-classifier\"" (módulo ainda não existe).

- [ ] **Step 3: Implementar o classificador**

```ts
// lib/scholar/academic-term-classifier.ts
import lexiconData from "./academic-lexicon.json";

export type AcademicDomain =
  | "bio" | "med" | "cs" | "phys" | "chem" | "eng" | "human" | "social" | "multi";

export interface AcademicTermResult {
  isAcademic: boolean;
  confidence: number;       // 0..1, arredondado a 2 casas
  matchedTerms: string[];
  domain?: AcademicDomain;
}

const THRESHOLD = 0.55;
const DOMAIN_KEYS: AcademicDomain[] = [
  "bio", "med", "cs", "phys", "chem", "eng", "human", "social", "multi",
];

// Morfologia acadêmica produtiva (testada na string normalizada).
const MORPH: RegExp[] = [
  /[a-z]{2,}omics?\b/,    // genomics, proteomics, metabolomics
  /\bnano[a-z]{3,}/,      // nanoparticle, nanotube, nanomaterial
  /[a-z]{3,}genesis\b/,   // angiogenesis, carcinogenesis
  /\bab initio\b/,
  /\bquantum\b/,
];
const DOI_RE = /10\.\d{4,9}\/[-._;()/:a-z0-9]+/;          // na string normalizada (minúscula)
const ARXIV_RE = /\b(?:arxiv:\s*)?\d{4}\.\d{4,5}(?:v\d+)?\b/;
const CHEM_RE = /\b(?:[A-Z][a-z]?\d*){2,}\b/;             // na string CRUA; precisa conter dígito

function norm(s: string): string {
  // Remove acentos (combining diacritical marks U+0300–U+036F) e baixa caixa.
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

  // Multiword: fronteira à esquerda, livre à direita (tolera plural). Single: tolera "+s".
  const hasTerm = (term: string): boolean =>
    term.includes(" ")
      ? padded.includes(" " + term)
      : wordSet.has(term) || wordSet.has(term + "s");
  // Bases: correspondência exata (evita "core"→"cores" e afins).
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
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `npm test -- academic-term-classifier`
Expected: PASS — todos os casos (≥25 positivos, ≥25 negativos, domínio, edge, anti-ruído) verdes.

- [ ] **Step 5: Commit**

```bash
git add lib/scholar/academic-term-classifier.ts lib/scholar/academic-term-classifier.test.ts
git commit -m "feat(scholar): classificador puro isAcademicTerm + testes (Fase 1)"
```

---

## Task 3: ContextualSuggestionDock (UI wrapper)

**Files:**
- Create: `components/research/ContextualSuggestionDock.tsx`

> Sem teste unitário: o repo não tem infra de teste de componente (jsdom/testing-library ausentes). Verificação via `tsc` + lint + manual. A lógica testável (classificador) já está coberta.

- [ ] **Step 1: Criar o componente**

```tsx
// components/research/ContextualSuggestionDock.tsx
"use client";
import { useEffect, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, SparklesIcon } from "@heroicons/react/24/outline";
import ResearchSuggestionPanel from "./ResearchSuggestionPanel";
import { isAcademicTerm } from "@/lib/scholar/academic-term-classifier";

const LS_KEY = "zaeon:dock:collapsed";
const COOLDOWN_MS = 8000;

interface Props {
  topic: string;
  onSelectTitle?: (title: string) => void;
}

export default function ContextualSuggestionDock({ topic, onSelectTitle }: Props) {
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState(0);

  useEffect(() => {
    setMounted(true);
    try {
      setCollapsed(localStorage.getItem(LS_KEY) === "1");
    } catch {
      /* localStorage indisponível — segue não-colapsado */
    }
  }, []);

  const term = (topic ?? "").trim();
  const academic = term.length >= 3 && isAcademicTerm(term).isAcademic;
  const onCooldown = Date.now() < dismissedUntil;

  if (!mounted || !academic || onCooldown) return null;

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(LS_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  const dismiss = () => setDismissedUntil(Date.now() + COOLDOWN_MS);

  return (
    <div
      className="sticky top-0 z-30 px-6 pt-3"
      role="region"
      aria-label="Sugestão de pesquisa contextual"
    >
      <div className="rounded-[2rem] bg-[#030014]/95 backdrop-blur-xl border border-cyan-400/15 shadow-[0_8px_30px_rgba(0,0,0,0.45)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] font-black uppercase tracking-[.15em] text-cyan-400">
              Sugestão contextual
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggle}
              aria-label={collapsed ? "Expandir sugestão" : "Recolher sugestão"}
              className="p-1 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-cyan-400 transition-colors"
            >
              {collapsed ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
            </button>
            <button
              onClick={dismiss}
              aria-label="Dispensar sugestão"
              className="px-2 py-1 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 text-[11px] transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
        {!collapsed && (
          <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
            <ResearchSuggestionPanel docTitle={term} onSelectTitle={onSelectTitle} />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos referentes a `ContextualSuggestionDock.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/research/ContextualSuggestionDock.tsx
git commit -m "feat(research): ContextualSuggestionDock encapsula o painel de sugestão (Fase 1)"
```

---

## Task 4: Elevar o draft ao OmegaScholarContext

**Files:**
- Modify: `app/workstation/student/omega/OmegaScholarContext.tsx`

- [ ] **Step 1: Adicionar `draft`/`setDraft` à interface**

Encontre o bloco da interface `OmegaCtx` (logo após `interface OmegaState`):

```ts
interface OmegaCtx extends OmegaState {
  runQuery: (prompt: string) => Promise<void>;
  loadSession: (s: any) => void;
}
```

Substitua por:

```ts
interface OmegaCtx extends OmegaState {
  draft: string;
  setDraft: (v: string) => void;
  runQuery: (prompt: string) => Promise<void>;
  loadSession: (s: any) => void;
}
```

- [ ] **Step 2: Adicionar o estado `draft` no provider**

Encontre:

```ts
  const [state, setState] = useState<OmegaState>({
    status: "idle", query: "", phases: [], answer: "", session: null, error: null });
```

Logo abaixo, adicione:

```ts
  // Draft do input da barra, elevado ao contexto para o dock de sugestão observá-lo.
  const [draft, setDraft] = useState("");
```

- [ ] **Step 3: Expor no value do Provider**

Encontre:

```tsx
  return <Ctx.Provider value={{ ...state, runQuery, loadSession }}>{children}</Ctx.Provider>;
```

Substitua por:

```tsx
  return <Ctx.Provider value={{ ...state, draft, setDraft, runQuery, loadSession }}>{children}</Ctx.Provider>;
```

- [ ] **Step 4: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. (A barra ainda usa estado local — será migrada na Task 5.)

- [ ] **Step 5: Commit**

```bash
git add app/workstation/student/omega/OmegaScholarContext.tsx
git commit -m "feat(omega): elevar draft do input ao contexto (Fase 1)"
```

---

## Task 5: OmegaScholarBar usa o draft do contexto

**Files:**
- Modify: `app/workstation/student/omega/OmegaScholarBar.tsx`

- [ ] **Step 1: Consumir draft/setDraft e remover estado local**

Encontre:

```tsx
  const { runQuery, status, phases, error } = useOmegaScholar();
  const [value, setValue] = useState("");
  const busy = status === "running";
```

Substitua por:

```tsx
  const { runQuery, status, phases, error, draft, setDraft } = useOmegaScholar();
  const busy = status === "running";
```

- [ ] **Step 2: Atualizar `submit` para usar `draft`**

Encontre:

```tsx
  const submit = () => {
    if (value.trim() && !busy) {
      runQuery(value);
      setValue("");
    }
  };
```

Substitua por:

```tsx
  const submit = () => {
    if (draft.trim() && !busy) {
      runQuery(draft);
      setDraft("");
    }
  };
```

- [ ] **Step 3: Ligar o input ao draft**

Encontre:

```tsx
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              disabled={busy}
              placeholder="Pesquise, revise a literatura, peça citações…"
              className="flex-1 bg-black/10 dark:bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-violet-400/50 disabled:opacity-60"
            />
```

Substitua por (muda `value`/`onChange` e adiciona `data-academic-input`):

```tsx
            <input
              data-academic-input="true"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              disabled={busy}
              placeholder="Pesquise, revise a literatura, peça citações…"
              className="flex-1 bg-black/10 dark:bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-violet-400/50 disabled:opacity-60"
            />
```

- [ ] **Step 4: Remover import não usado `useState` (se aplicável)**

Verifique se `useState` ainda é usado no arquivo:

Run: `grep -n "useState" app/workstation/student/omega/OmegaScholarBar.tsx`
Expected: nenhuma outra ocorrência. Se a linha 2 importar `useState` e ele não for mais usado, ajuste o import.

Encontre (linha ~2):

```tsx
import { useState, useEffect, useRef } from "react";
```

Substitua por (mantém `useEffect`/`useRef`, que continuam em uso pelo timer):

```tsx
import { useEffect, useRef } from "react";
```

- [ ] **Step 5: Checar tipos + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros novos.

- [ ] **Step 6: Commit**

```bash
git add app/workstation/student/omega/OmegaScholarBar.tsx
git commit -m "feat(omega): barra usa draft do contexto + data-academic-input (Fase 1)"
```

---

## Task 6: Wrapper StudyRoomSuggestionDock + wiring na sala

**Files:**
- Create: `app/workstation/student/omega/StudyRoomSuggestionDock.tsx`
- Modify: `app/workstation/student/StudyRoomContent.tsx`

- [ ] **Step 1: Criar o wrapper (debounce + ponte de contexto)**

```tsx
// app/workstation/student/omega/StudyRoomSuggestionDock.tsx
"use client";
import { useEffect, useState } from "react";
import { useOmegaScholar } from "./OmegaScholarContext";
import ContextualSuggestionDock from "@/components/research/ContextualSuggestionDock";

export default function StudyRoomSuggestionDock() {
  const { draft, setDraft } = useOmegaScholar();
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(draft), 350);
    return () => clearTimeout(id);
  }, [draft]);

  // "Usar como título →" semeia a barra Omega (não há editor de doc nesta tela).
  return <ContextualSuggestionDock topic={debounced} onSelectTitle={(t) => setDraft(t)} />;
}
```

- [ ] **Step 2: Importar o wrapper no StudyRoomContent**

Encontre (linhas ~13-15):

```tsx
import { OmegaScholarProvider } from "./omega/OmegaScholarContext";
import OmegaScholarBar from "./omega/OmegaScholarBar";
import OmegaScholarWorkspace from "./omega/OmegaScholarWorkspace";
```

Substitua por:

```tsx
import { OmegaScholarProvider } from "./omega/OmegaScholarContext";
import OmegaScholarBar from "./omega/OmegaScholarBar";
import OmegaScholarWorkspace from "./omega/OmegaScholarWorkspace";
import StudyRoomSuggestionDock from "./omega/StudyRoomSuggestionDock";
```

- [ ] **Step 3: Renderizar o dock logo após a barra**

Encontre:

```tsx
            {/* ── OMEGA SCHOLAR BAR (replaces the old ROOM HEADER) ───── */}
            <OmegaScholarBar flushTop={flushTop} onOpenResults={() => setActiveTab("community")} />
```

Substitua por:

```tsx
            {/* ── OMEGA SCHOLAR BAR (replaces the old ROOM HEADER) ───── */}
            <OmegaScholarBar flushTop={flushTop} onOpenResults={() => setActiveTab("community")} />

            {/* ── DOCK DE SUGESTÃO CONTEXTUAL (aparece em termo acadêmico) ── */}
            <StudyRoomSuggestionDock />
```

- [ ] **Step 4: Checar tipos + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add app/workstation/student/omega/StudyRoomSuggestionDock.tsx app/workstation/student/StudyRoomContent.tsx
git commit -m "feat(omega): dock contextual ligado ao draft da sala de estudos (Fase 1)"
```

---

## Task 7: Remover o painel da aba `pesquisa` (research-lab)

**Files:**
- Modify: `app/research-lab/page.tsx`

- [ ] **Step 1: Remover o import dinâmico do painel**

Encontre (linhas ~19-22):

```tsx
const ResearchSuggestionPanel = dynamic(
  () => import("@/components/research/ResearchSuggestionPanel"),
  { ssr: false }
);
```

Remova esse bloco inteiro. (Mantenha a linha 18 `ResearchesPage` e a 23 `ResearchRoomTour`.)

- [ ] **Step 2: Remover o bloco JSX do painel na aba `pesquisa`**

Encontre (linhas ~1161-1167):

```tsx
                                {/* SUGESTÃO DE PESQUISA */}
                                <div className="bg-[#030014] rounded-[2rem] shrink-0">
                                  <ResearchSuggestionPanel
                                    docTitle={docTitle}
                                    onSelectTitle={handleSelectResearchTitle}
                                  />
                                </div>
```

Remova esse bloco inteiro. (O `<input type="file" .../>` logo acima e a `<section data-tour="pdf-upload" ...>` logo abaixo permanecem.)

- [ ] **Step 3: Remover o handler órfão**

Encontre (linhas ~973-975):

```tsx
    const handleSelectResearchTitle = (title: string) => {
        setDocTitle(title);
    };
```

Remova esse bloco. (`setDocTitle` e `docTitle` continuam usados em outros pontos — não os remova.)

- [ ] **Step 4: Confirmar que não restam referências órfãs**

Run: `grep -n "ResearchSuggestionPanel\|handleSelectResearchTitle" app/research-lab/page.tsx`
Expected: nenhuma saída (zero ocorrências).

- [ ] **Step 5: Checar tipos + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros (sem "is declared but never used", sem import órfão).

- [ ] **Step 6: Commit**

```bash
git add app/research-lab/page.tsx
git commit -m "refactor(research-lab): remover painel de sugestão da aba pesquisa (movido p/ sala de estudos) (Fase 1)"
```

---

## Task 8: Portão de verificação final (regra tests-before-PR)

**Files:** nenhum (apenas verificação).

- [ ] **Step 1: Tipagem**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 3: Suíte de testes completa**

Run: `npm test`
Expected: PASS — incluindo `academic-term-classifier` e todos os testes existentes de `lib/scholar` (abnt, assemble, bibtex, dedup, http, normalize, pdf, ssrf, verify).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build concluído sem erros. (PARE se falhar — não empurrar commits quebrados.)

- [ ] **Step 5: Smoke manual (anote evidências)**

1. `npm run dev`; subir `research-engine` na porta 8002 (`/health`).
2. Abrir a sala de estudos → digitar "graphene oxide synthesis" no input Omega → dock aparece em ≤ 500 ms.
3. Digitar "comprar pão" → dock NÃO aparece.
4. Colapsar o dock (chevron) → recarregar → permanece colapsado (localStorage).
5. Dispensar (✕) → dock some por ~8 s mesmo com termo acadêmico.
6. Aba `pesquisa` (research-lab) → painel de sugestão NÃO aparece mais.
7. Console sem warnings de hidratação.

---

## Self-Review (preenchido pelo autor do plano)

**1. Cobertura da spec (Fase 1):**
- Classificador puro + léxico de fontes do repo → Tasks 1-2 ✓
- ≥25/≥25 testes → Task 2 ✓
- Dock sticky, colapso+localStorage, cooldown 8 s, mounted guard, fallback engine → Task 3 ✓ (fallback de engine offline é herdado do `ResearchSuggestionPanel`, que já exibe `error` 503)
- Hook no input existente (draft no contexto) → Tasks 4-6 ✓
- "Usar como título" remapeado p/ semear a barra → Task 6 ✓
- Remoção do painel da aba `pesquisa` + limpeza de órfãos → Task 7 ✓
- Suíte verde antes de PR → Task 8 ✓

**2. Placeholders:** nenhum "TBD"/"add validation". Todo código está completo.

**3. Consistência de tipos:** `isAcademicTerm`/`AcademicTermResult`/`AcademicDomain` idênticos entre classificador e consumidores; `draft`/`setDraft` idênticos entre contexto, barra e wrapper; props do dock (`topic`, `onSelectTitle`) idênticas entre dock e wrapper.

**Limitação conhecida (documentada):** o casamento do léxico é por forma de superfície (tolera plural simples em palavra única e plural à direita em multiword). Termos flexionados/multiword pluralizados em ambas as palavras podem não casar → falso negativo. Modo de falha seguro: o dock apenas não aparece; o usuário ainda usa a barra normalmente. Expansível na Fase 5.
