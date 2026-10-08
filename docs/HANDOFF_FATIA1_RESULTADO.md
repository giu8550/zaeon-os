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

## PASSO 3 · PR-G2 (virtual keys) — PR #285
`scripts/gateway-keys.mjs` (idempotente por `key_alias`, budget USD/dia, TTL, `--revoke`), teto da key → `agent_budget_exhausted` (lei 5) no turno do canal. **Achados do gate local, já corrigidos no compose:** LiteLLM subia antes do Postgres e ficava `db: disconnected` (sem DB não há virtual key) → `depends_on: service_healthy` + `DATABASE_URL` explícito; `LITELLM_PG_PASSWORD` com `:?` quebrava a interpolação do compose **mesmo sem o perfil** → `:-`.
**Não verificado:** a imagem `ghcr.io/berriai/litellm:main-stable` (2026-10-07) devolve `401 No module named 'litellm.proxy.guardrails.guardrail_helpers'` em `/key/generate` — regressão da imagem; **pinar uma tag `main-vX.Y.Z-stable`** no VPS ao ligar. O teste local também esgotou o disco do Mac (Docker.raw 11 GB); containers/imagens de teste removidos.

## PASSO 4 · PR-A3 (admin: gasto por agente) — esta PR
- `GET /api/admin/agents/tokens?range&groupBy` (founder; `medindoDesde`, `hoje`, `tetos`, `truncado`); `AgentProfile.tetoTokensDia` + `PATCH`; `lib/llm/teto.ts` (`foraPorTeto`, dia **local**); `scripts/conferir-tokens.mjs` (soma crua × rota, diferença 0).
- `AgentsModule`: bloco USO **fundido** com in/out/cached/total/custo est./tokens-por-turno, seletor 7d/30d/tudo, ordenação por qualquer coluna, barras CSS 14d, cabeçalho "medindo desde …" / frase do vazio, "—" para agente sem linha, campo teto/dia + aviso "estouraria o teto hoje (usado/teto)". Leitura ligada por default (decisão do Martinez).
- Freio: `TurnoInput.origem` (`"humano"` default · `"autonomo"`); `AGENT_TETO_ENFORCE=1` barra **só** o autônomo (3 testes: off+autônomo responde · on+autônomo `motivo:"teto"` sem `gerar` · on+humano responde). Nesta fatia ninguém dispara `"autonomo"`: nasce testado e dormente.
**Não verificado ao vivo:** painel com números reais (sem Mongo/Vertex válidos nesta máquina); `conferir-tokens.mjs` roda no VPS após o merge.
