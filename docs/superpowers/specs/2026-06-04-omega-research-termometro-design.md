# Design — Engine de Pesquisa Omega (≥12 papers) + Termômetro Acadêmico

- **Data:** 2026-06-04
- **Status:** Design aprovado pelo usuário — aguardando revisão do spec
- **Branch alvo de prod:** `main` → deploy automático → www.zaeon.space

## 1. Objetivo

Tornar a página de pesquisa plenamente funcional na **aba do agente Omega**:

1. **Engine de busca** nas nossas fontes científicas retornando **≥ 12 pesquisas** por assunto que o usuário perguntar/adicionar.
2. **Highlight de sugestão de pesquisa** baseado na lógica já existente, porém com um **termômetro mais afiado**: tempo médio de pesquisa, possibilidade/valor de bolsa (cenário nacional brasileiro atual) e métricas acadêmicas de apoio, **por nível acadêmico** (graduação → doutorado+).
3. Suíte de testes verde → PR para `main` → merge (deploy em produção).

## 2. Decisões de design (brainstorming)

| Pergunta | Decisão |
|---|---|
| Eixo das métricas | **Nível acadêmico** (4 níveis): `grad` / `msc` / `phd` / `postdoc` |
| Origem dos dados de bolsa | **Dataset curado e versionado**, valores 2025/2026 **verificados na web**, função de score determinística |
| Escopo de métricas | **Recomendado**: tempo médio + bolsa (prob. + R$/mês) + score de lacuna/originalidade (gap) + alvo de publicação (Qualis/estrato) |
| Integração com prod | **PR para `main` e merge** (suíte verde obrigatória antes do PR) |

## 3. Estado atual (verificado no código)

- **Aba Omega:** `app/workstation/student/omega/OmegaScholarBar.tsx` (busca) + `OmegaScholarWorkspace.tsx` (resultados em abas: Referências/Insights/Arquivos/Lacunas). Contexto em `OmegaScholarContext.tsx` (`runQuery` → `POST /api/ai/scholar`, streaming NDJSON).
- **Engine de busca:** `app/api/ai/scholar/route.ts` usa fontes reais (`lib/scholar/sources/*`: arXiv, PubMed, Semantic Scholar, CrossRef, OpenAlex). **Limita a `unique.slice(0,10)`** (linha 66) e as referências saem apenas do subconjunto verificado → pode entregar **< 12**.
- **Sugestão:** `components/research/ResearchSuggestionPanel.tsx` (4 níveis) → `app/api/ai/research-suggest/route.ts` → **engine Python (Flask, porta 8002)**. `RESEARCH_ENGINE_URL` só tem o default `http://localhost:8002`; `vercel.json` só publica a rota `scholar`. → **Sugestão está morta em produção** (retorna 503). Referências do Python são **geradas pela IA** (risco de alucinação).
- **Lógica por nível já existente** (em `research-engine/prompts.py`): prazos (`6-12 meses` → `3-4 anos`), alvo de publicação (Qualis/Q1), `gap_score`. É a matéria-prima do termômetro, hoje escondida no prompt.
- **Bolsa / termômetro / tempo estruturado:** não existe em lugar nenhum.
- **Gemini wrapper (TS):** `lib/scholar/gemini.ts` (`geminiJson<T>()`, Vertex, `gemini-2.0-flash-001`, JSON mode).
- **Testes:** Vitest, padrão `lib/**/*.test.ts`. Lógica determinística testável vive em `lib/` (ex.: `lib/scholar/assemble.ts` — "deterministic; unit-tested"). Rotas/componentes não são cobertos pela config atual.

## 4. Arquitetura proposta

Abordagem escolhida: **portar a engine de sugestão para TypeScript** (roda no Vercel, testável), aterrar as referências nas fontes reais e adicionar um **módulo de termômetro determinístico**. (Alternativas rejeitadas: hospedar o Python — mais infra/auth divergente; híbrido — complexidade à toa, YAGNI.)

### 4.1 Parte A — Engine garante ≥ 12 papers na aba Omega

Novo módulo puro **`lib/scholar/retrieve.ts`**:
- Orquestra `searchAll` pelas fontes de `basesForDomain(domain)` em ≥ 1 query, deduplica (`dedupePapers`), e **garante `minResults` (default 12)** via *top-up*: se após dedup vier `< 12`, dispara query/fonte adicional antes de desistir.
- Retorna a lista deduplicada + telemetria por fonte + flag `reachedMin`.

`app/api/ai/scholar/route.ts` passa a **desacoplar**:
- **Descoberta:** `retrievePapers()` produz a lista (≥ 12) que vira **Referências** na aba Omega.
- **Síntese profunda:** o top-N (mantido em ~10) continua indo a full-text + síntese + verificação de citações (qualidade/velocidade preservadas).
- **Referências exibidas = citações verificadas ∪ demais descobertas**, cada item marcado como `verified: true` (citado/verificado) ou `verified: false` (relacionado). O badge `Referências (n)` da aba Omega passa a mostrar `n ≥ 12`.

### 4.2 Parte B — Termômetro afiado na sugestão

Três módulos novos em `lib/scholar/`:

1. **`bolsas-brasil.ts`** — dataset curado/versionado dos valores e cenário **atuais (2025/2026)** de bolsa por nível e agência (CAPES/CNPq/FAPESP), com `sourceUrl` e `asOf` em cada entrada. Valores **verificados na web** no momento da implementação.
2. **`termometro.ts`** — funções puras: `estimateResearchTime(level)`, `scholarshipOutlook(level)`, `publicationTarget(level)`, `buildTermometro(level, gapScore)`.
3. **`suggest.ts`** — assembla a sugestão: em paralelo (a) chamada Gemini via `geminiJson` com prompt portado (`prompts-suggest.ts`, preservando a calibração por nível de `prompts.py`), (b) referências reais via `retrievePapers`/`searchAll`. Anexa `termometro`.

`app/api/ai/research-suggest/route.ts` vira **rota TS** que chama `suggest.generateSuggestion()` (substitui o proxy Python). Resposta = `EngineResponse` **estendida** (retrocompatível) com campo `termometro`.

### 4.3 Onde aparece (aba Omega)

- `ResearchSuggestionPanel.tsx` ganha um **card de Termômetro** (tempo médio · bolsa prob.+R$ · barra de gap · alvo Qualis), e o tipo `EngineResponse` passa a incluir `termometro?`.
- O **highlight de sugestão é montado na aba Omega**, alimentado pela query/draft do Omega (`OmegaScholarContext.draft`/`query`). Reaproveita o `ResearchSuggestionPanel`/dock já existente, agora exibido dentro do workspace do Omega (provável ponto de montagem: `OmegaScholarWorkspace.tsx`, no estado idle e/ao lado dos resultados — ponto exato fixado no plano).

## 5. Contratos (interfaces TypeScript)

```ts
// lib/scholar/termometro.ts
export type Level = "grad" | "msc" | "phd" | "postdoc";

export interface ResearchTime {
  minMonths: number; maxMonths: number; typicalMonths: number;
  label: string; // "18–24 meses"
}
export interface ScholarshipOutlook {
  probability: "baixa" | "média" | "alta";
  probabilityScore: number;            // 0..1
  monthlyValueBRL: number;             // referência (CAPES/CNPq DS)
  monthlyValueRangeBRL: [number, number]; // min..max entre agências (FAPESP > federais)
  agencies: string[];                  // ["CAPES","CNPq","FAPESP"]
  competitiveness: "baixa" | "média" | "alta";
  note: string;                        // contexto do cenário nacional
}
export interface PublicationTarget { qualis: string; tier: string; note: string; }
export interface Termometro {
  level: Level;
  researchTime: ResearchTime;
  scholarship: ScholarshipOutlook;
  publication: PublicationTarget;
  gapScore: number;   // 0..1 (vindo da sugestão)
  gapLabel: string;   // banda de originalidade
}
export function buildTermometro(level: Level, gapScore: number): Termometro;
```

```ts
// lib/scholar/bolsas-brasil.ts
export interface BolsaAgencyValue {
  name: "CAPES" | "CNPq" | "FAPESP";
  monthlyBRL: number; sourceUrl: string; asOf: string; // "2025"
}
export interface BolsaInfo {
  level: Level; programLabel: string;            // "Iniciação Científica (PIBIC)" ...
  agencies: BolsaAgencyValue[];
  availabilityNote: string;                       // nº de bolsas / reajustes / clima
  competitiveness: "baixa" | "média" | "alta";
}
export const BOLSAS_BRASIL: Record<Level, BolsaInfo>;
```

```ts
// lib/scholar/retrieve.ts
export interface RetrieveOptions { minResults?: number; } // default 12
export interface RetrieveResult {
  papers: Paper[];                       // deduplicado, >= minResults quando as fontes permitem
  perSource: { source: SourceName; count: number; status: "ok"|"rate_limited"|"error" }[];
  reachedMin: boolean;
}
export async function retrievePapers(query: string, domain?: string, opts?: RetrieveOptions): Promise<RetrieveResult>;
```

```ts
// lib/scholar/suggest.ts
export interface SuggestInput { topic: string; level: Level; excludeTitles?: string[]; }
export interface Suggestion {
  type: "Exploratória" | "Experimental" | "Pioneira";
  title: string; rationale: string; novelty_angle: string; gap_score: number;
}
export interface SuggestResult {
  suggestion: Suggestion;
  references: RefItem[];   // aterradas em fontes reais
  termometro: Termometro;
}
export async function generateSuggestion(input: SuggestInput): Promise<SuggestResult>;
```

## 6. Fluxo de dados

**Engine (A):** query Omega → `/api/ai/scholar` → `retrievePapers()` (searchAll + dedup + top-up ≥12) → lista ≥12 (Referências); top-N → full-text → `synthesize` → `assembleResults` (citações verificadas) → merge anotado (verified vs related) → aba Referências mostra ≥12.

**Sugestão (B):** tópico/draft Omega + nível → `/api/ai/research-suggest` (TS) → paralelo: Gemini (sugestão) + `retrievePapers` (referências) → `buildTermometro(level, gap_score)` → `{ suggestion, references, termometro }` → render no `ResearchSuggestionPanel` + highlight na aba Omega.

## 7. Dados de bolsa — metodologia do cenário nacional

Durante a implementação: **WebSearch** dos valores/contexto atuais (reajustes CAPES/CNPq 2024–2025; valores FAPESP, em geral maiores; nº de bolsas/clima de financiamento) e gravação em `bolsas-brasil.ts` com `sourceUrl` + `asOf` por entrada, para permitir atualização futura sem retrabalho. O `scholarshipOutlook` deriva probabilidade/competitividade de forma determinística a partir desse dataset.

## 8. Estratégia de testes (Vitest, `lib/**/*.test.ts`)

- `lib/scholar/termometro.test.ts` — tempo por nível; outlook (valores/probabilidade/competitividade) por nível; alvo de publicação; clamping de `gapScore`; `buildTermometro` completo.
- `lib/scholar/bolsas-brasil.test.ts` — integridade do dataset (4 níveis presentes, valores > 0, agências válidas, `asOf` preenchido).
- `lib/scholar/retrieve.test.ts` — dedup + **garantia ≥12** (top-up) com fontes mockadas; `reachedMin`; ordenação estável.
- `lib/scholar/suggest.test.ts` — parse do JSON do Gemini (mockado) + anexa termômetro + referências; trata JSON malformado.
- Toda a lógica testável vive em `lib/` (puro); rotas/componentes ficam finos. **Suíte inteira (`npm test`) verde** antes do PR.

## 9. Fora de escopo (YAGNI)

- Sem integração com finanças do professor; sem sistema de gestão de bolsas.
- Sem mudança de schema Prisma (sugestão é stateless; `ScholarSession.references` já é `Json`).
- Sem novas salas/agentes. O engine Python (`research-engine/`) vira legado dev-only; sem removê-lo neste escopo.

## 10. Arquivos

**Criar:** `lib/scholar/bolsas-brasil.ts` (+test), `lib/scholar/termometro.ts` (+test), `lib/scholar/retrieve.ts` (+test), `lib/scholar/suggest.ts` (+test), `lib/scholar/prompts-suggest.ts`. Possível `app/workstation/student/omega/OmegaSuggestionHighlight.tsx`.

**Modificar:** `app/api/ai/research-suggest/route.ts` (proxy Python → TS), `app/api/ai/scholar/route.ts` (usa `retrievePapers`, garante ≥12 refs anotadas), `components/research/ResearchSuggestionPanel.tsx` (card termômetro + tipo estendido), `app/workstation/student/omega/OmegaScholarWorkspace.tsx` (montar highlight). Possível ajuste em `ReferencesModule` (Omega) p/ distinguir verificada × relacionada.

## 11. Riscos & mitigação

| Risco | Mitigação |
|---|---|
| Fonte rate-limited devolve < 12 | Top-up com fonte/query extra; `reachedMin=false` é degradação graciosa, não erro |
| Valores de bolsa desatualizam | `asOf` + `sourceUrl` por entrada; dataset isolado e versionado |
| Latência (síntese de muitos papers) | Síntese profunda fica no top-N (~10); descoberta ≥12 é barata (sem full-text) |
| Quebra de retrocompat na resposta da sugestão | `termometro` é campo aditivo opcional; UI antiga continua funcionando |
| Gemini retorna JSON inválido | `suggest.ts` reaproveita parsing tolerante (fences) + fallback testado |

## 12. Plano de merge

Branch de feature → implementação TDD → `npm test` verde → PR para `main` com resumo → merge → deploy automático (www.zaeon.space).
