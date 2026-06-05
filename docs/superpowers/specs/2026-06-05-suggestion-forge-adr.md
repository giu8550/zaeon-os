# ADR-001: Suggestion Forge — engine FastAPI (porta 8003)

**Status:** Accepted (design) — pronto para implementação
**Date:** 2026-06-05
**Deciders:** Don (owner) · sessão de implementação Omega
**Contrato fechado:** [`suggestion-forge/engine_spec.md`](../../../suggestion-forge/engine_spec.md)
**Prompt mestre:** `CLAUDE_CODE_PROMPT_omega_suggestion_forge.md`

## Context

O Omega Scholar entrega **referências verificadas** de qualidade. Falta a parte **especulativa**: a partir
dessas referências, propor *trabalhos derivados* (pós-lacunas) classificados por dificuldade/relevância/
inovação/tempo e um **tier de qualidade**. Hoje o workspace tem as abas `Arquivos` e `Lacunas/RQ` — que
serão substituídas por uma aba `Sugestão` alimentada por uma engine nova.

Forças em jogo:
- O monorepo já tem **dois engines FastAPI** (`research-engine` 8002, `abnt-service` 8001). Padrão estabelecido.
- LLMs (Gemini) **superestimam** novidade/qualidade → tier não pode confiar só no modelo.
- A engine é **subordinada** ao Omega Scholar (`OMEGA_SCHOLAR.md`), não um agente concorrente.
- O lado Next usa **Vertex**; os engines Python usam **`google-generativeai` + API key**. Não misturar.
- Restrição de ambiente: sem `GEMINI_API_KEY` local → testes precisam ser **determinísticos com mock**.

## Decision

Criar **`suggestion-forge/`** — terceiro engine FastAPI (porta 8003), **stateless**, espelhando
`research-engine/`. Endpoints `/health`, `/forge`, `/reforge`. Auth/persistência ficam no proxy Next
(`/api/ai/suggestion-forge`), não na engine. O **tier é determinístico** (`classifier.py`), recalculado
após o parse do LLM. Contrato Pydantic v2 conforme `engine_spec.md §2`.

## Options Considered

### Decisão 1 — Onde mora a lógica de forja

#### Opção A: Engine FastAPI separada (porta 8003) ✅ ESCOLHIDA
| Dimensão | Avaliação |
|----------|-----------|
| Complexidade | Média (novo serviço, mas há 2 blueprints) |
| Custo | Baixo (mesmo padrão de deploy dos irmãos) |
| Escalabilidade | Boa (isolável, cacheável, mockável) |
| Familiaridade | Alta (espelha research-engine 1:1) |

**Pros:** isolamento de deps Python pesadas; reuso do padrão CORS/health/retry; testável com pytest
independente do Next; classifier determinístico em Python puro.
**Cons:** mais um processo para subir em dev; precisa de `SUGGESTION_FORGE_URL`.

#### Opção B: Rota Next + Vertex (sem engine Python)
**Pros:** um processo a menos.
**Cons:** duplica o padrão de prompt/loop que já vive em Python; quebra a simetria com research-engine;
classifier determinístico e Monte Carlo ficam menos naturais em TS; contradiz o `engine_spec.md`.

→ **A**: o contrato já está fechado para FastAPI 8003 e a simetria com os irmãos reduz risco.

### Decisão 2 — Fonte de verdade do `quality_tier`

#### Opção A: Determinístico em `classifier.py`, sobrescreve o LLM ✅ ESCOLHIDA
Fórmula ponderada (`engine_spec.md §4`): `0.30·relevance + 0.30·innovation + 0.25·gap_score + 0.15·w[difficulty]`,
com limiares `0.85/0.70/0.55`. + invariantes **I-1..I-10** (re-prompt até passar, depois rebaixa/clampa).
**Pros:** reprodutível, auditável, imune ao viés "tudo é excepcional"; testável sem rede.
**Cons:** precisa calibração (Monte Carlo) para a distribuição sair sã.

#### Opção B: Confiar no `quality_tier` do LLM
**Cons:** não reprodutível; Gemini enviesa para cima; impossível auditar. **Rejeitada.**

### Decisão 3 — Loader de seções do `OMEGA_SCHOLAR.md`

`engine_spec.md §7` chama `_load_omega_section("§1")`, `"§4.2 F3-F5"`, `"§6"`. Mas o doc real tem
**numeração com drift**: as regras de citação estão em **§10.2** (não §6), e há **dois `## 7`**.

#### Opção A: Match por **título de header** (resiliente) ✅ ESCOLHIDA
`_load_omega_section("identity"|"loop"|"citation")` busca o header cujo título contém
`IDENTIDADE` / `AGENTIC LOOP` / `INTEGRIDADE DE CITAÇÕES`. Cache TTL 60s.
**Pros:** sobrevive a renumeração; injeta o conteúdo *certo* independentemente do número.
**Cons:** acoplado a títulos (mitigado: fallback + teste que falha se a seção sumir).

#### Opção B: Match literal por `§N`
**Cons:** quebra hoje (carregaria "ativação por linguagem natural" como "citação"). **Rejeitada.**

### Decisão 4 — Vocabulário de lacunas

#### Opção A: Embutir literal o bloco "FASE 1: VARREDURA DE LACUNAS" ✅ ESCOLHIDA
Copiar o texto canônico de `research-engine/prompts.py:74-114` para uma constante no `prompts.py` da Forge.
**Pros:** sem import cross-serviço frágil; engine auto-contida; vocabulário idêntico.
**Cons:** duplicação textual (mitigado: comentário apontando a origem canônica + teste de presença dos 5 tipos).

#### Opção B: `import` do módulo do research-engine
**Cons:** acopla dois serviços no runtime/sys.path; quebra empacotamento isolado. **Rejeitada.**

### Decisão 5 — Gate de calibração

**Monte Carlo 10k no CI** (`test_monte_carlo_distribution`): 10 000 amostras uniformes nos eixos; falhar o
build se a distribuição de tiers sair de `regular 32±3% · muito_bom 38±3% · excelente 22±3% · excepcional 8±2%`.
Garante que a fórmula não colapsa em um único tier.

**RESOLVIDO (2026-06-05, aprovado pelo owner):** a fórmula §4 original era inconsistente com sua própria
distribuição-alvo — limiares `0.85/0.70/0.55` entregavam `58/30/11/1%`, não `32/38/22/8%` (nunca foi simulada).
Decisão: **manter os pesos** `0.30/0.30/0.25/0.15` e **recalibrar apenas os cut-points** para
`0.45 / 0.60 / 0.73` (quantis empíricos 0.32/0.70/0.92 do score sob amostragem uniforme), reproduzindo a
distribuição-alvo com exatidão. `engine_spec.md §4` atualizado com nota de calibração. Pesos = composição
auditável inalterada; só os limiares mudaram.

## Trade-off Analysis

O eixo central é **determinismo vs. confiança no LLM**. Escolhemos determinismo no que precisa ser auditável
(tier, invariantes, índices de evidência) e deixamos o LLM no que é criativo (títulos, rationale, desdobramentos),
sempre **validado** por código. O custo é a calibração estatística — pago uma vez no CI. A engine separada custa
um processo a mais em dev, compensado por isolamento, testabilidade e simetria com os irmãos.

## Consequences

**Fica mais fácil:** auditar por que uma proposta é "excelente"; testar sem chave Gemini (mock + classifier puro);
evoluir o prompt sem mexer no scoring; cachear por `sha1(topic|level|dois|count)` depois.
**Fica mais difícil:** dev local precisa subir 3 engines; mudanças no `OMEGA_SCHOLAR.md` podem exigir ajuste do
loader (coberto por teste).
**Revisitar:** pesos da fórmula se a distribuição real divergir do Monte Carlo; hard cap de custo Gemini (P2);
streaming progressivo do `/forge` (P2).

## Action Items

1. [ ] Scaffold `suggestion-forge/` espelhando `research-engine/` (+ venv py3.12 já criado)
2. [ ] `models.py` → `classifier.py` (I-1..I-10 + Monte Carlo) → `prompts.py` → `engine.py` → `main.py` (TDD)
3. [ ] `tests/` cobrindo §6/§8 do spec; `pytest --cov ≥ 85%`
4. [ ] Boot `uvicorn :8003` + `curl /health`
5. [ ] **GATE A** → seguir para integração Next (Etapa B)
