# Fatia 1 · Fundação — resultado da execução (em andamento)

> Executor: Claude Code (Fable), 2026-10-07. Prompt: `docs/EXECUTOR_PROMPT_FATIA1_FUNDACAO.md`.
> Este doc cresce a cada PASSO; a §"Runbook" e as medidas (48h) entram no PASSO 6.

## PASSO 1 · PR-G1 (gateway) — PR #280
Verificado ao vivo (Docker local, `--profile gateway`): LiteLLM sobe com `infra/litellm.config.yaml`; 401 sem/com key errada; `/v1/models` = `zaeon-flash, zaeon-pro`; `/api/health` nos 3 estados (`off` · `on` · `degraded` · volta a `on`). **Bug achado e corrigido no gate:** o `fetch` do Next tem data cache (em disco no dev) e congelava o primeiro `on` → `cache:"no-store"` no health e no gateway.
**Não verificado localmente:** resposta real do Vertex via LiteLLM — a service account do `.env` local está revogada (`invalid_grant` também chamando o Google direto). Fecha em prod com o `GOOGLE_CREDENTIALS` do Actions.

## PASSO 2 · PR-A1 (TokenLedger) — esta PR
- `model TokenLedger` (C5) + `lib/llm/ledger.ts` (best-effort, `TOKEN_LEDGER=0` desliga) + `lib/ai/preco.ts` (ESTIMATIVA; cached a ~10%) + `lib/llm/medir.ts` (porta de 1 linha) + `lib/metrics/tokens.ts` (agregações puras).
- Wrappers finos: `geminiJson` e `geminiText` passam pelo envelope com assinatura intacta → **todos os ~30 call sites deles já medem** sem mudar uma linha.
- Harness: `HarnessOpts.ledger/rota/transformarSystem`; `phase` por call site (`plan`/`reason`/`draft`); `HarnessDeps.usoMedido` → `charge()` reconcilia e `overBudget()` frea com o maior entre estimado e medido.
- Call sites: `runChatTurn` (ledger com mentor/userId/surface/scopeId) · `agent-turn` (**único opt-in ao gateway**: `rota: gatewayLigado() ? "gateway" : "vertex"`) · chat legado (2 chamadas diretas via `medirVertex`).

### Não medido nesta PR (lista fechada — candidatos ao PR-A1b, 1 linha `medirVertex` cada)
`app/api/agentic/{biosim,codelab,quantum}` · `app/api/ai/{agent-search,generate-document,relate}` · `app/api/documents/abnt-export` · `app/api/onboarding-extract` · `app/api/research/chat/[researchId]` · `app/api/studio/diag` · `lib/ai/router.ts` (`generate`) · `lib/scholar/suggest.ts` · `lib/whatsapp/brain.ts` · TTS (`lib/studio/gemini-tts-request.ts`, `lib/studio/podcast-tts.ts`, `lib/voice/gemini-tts.ts` — sem `usageMetadata` útil).
Nota: o que já chamava `geminiJson`/`geminiText` **saiu** desta lista automaticamente pelos wrappers.

### Banco
`npx prisma generate` rodado; **`prisma db push` não rodado localmente** (o deploy roda `db_push`; Mongo só cria a coleção/índices no primeiro insert/push).
