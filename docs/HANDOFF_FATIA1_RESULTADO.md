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

## PASSO 5 · PR-A2 (aba Mentores) — PR stacked
Corpo da loja extraído para `components/mentors/LojaMentores.tsx`; `/mentores`; `/plugin-store` (e `/assistentes`, alias já existente em main) redirecionam com a flag preservando a query; rótulos via `lib/mentores/rota.ts`. Build-arg nos 3 arquivos. **Não verificado no browser** nesta máquina (sem build).

## PASSO 6 · Verificação final da fatia
1. **`tsc`** 0 erros fora de `server/colyseus/` (os 22 de lá são pré-existentes: deps do Colyseus não instaladas neste worktree) · **`vitest`** 2070 passed, 1 falha pré-existente (`salaColyseus.int.test.ts`, mesma causa) · CI `build-test` roda nos 5 PRs empilhados: #280 → #284 → #285 → #286 → #287.
2. **Flags vazias → comportamento zero-diff:** health sem `gateway:"on"` (lido ao vivo: `off`), loja igual (flag off renderiza `LojaMentores` com "Todos"), teto só avisa. Únicas mudanças sem flag nova: o ledger escrevendo (best-effort) e as colunas de consumo no painel USO (decisão do Martinez: leitura ligada por default).
3. **Runbook de ligar em prod (ordem):**
   1. No `.env` do VPS: `GATEWAY_MASTER_KEY` (`openssl rand -hex 32`), `LITELLM_PG_PASSWORD`, `LITELLM_DATABASE_URL=postgresql://litellm:<senha>@litellm-db:5432/litellm`, `LITELLM_SALT_KEY` (gerar 1×; trocar = perder as keys). **Pinar a imagem** do `litellm` numa tag `main-vX.Y.Z-stable` recente (a `main-stable` de 2026-10-07 quebra `/key/generate`).
   2. `docker compose -f docker-compose.beta.yml --profile gateway up -d litellm` → `curl http://litellm:4000/health/readiness` (de dentro da rede) tem de mostrar `"db":"connected"`.
   3. `node scripts/provar-chaves.mjs --gateway http://127.0.0.1:4000 --key <master>` (com `ports` temporário ou via `docker exec`) → `APTO` nas 4 provas — **é o gate G1 que faltou aqui** (SA local revogada).
   4. `node scripts/gateway-keys.mjs --agents aura,medicina,enfermagem --budget 0.01` → colar as `GATEWAY_KEY_*` no `.env` → estourar a da `medicina` → só a Osler diz "limite diário" (gate G2).
   5. `GATEWAY_URL=http://litellm:4000` no `.env` → redeploy → `/api/health` `gateway:"on"`, `provedor:"litellm"`; parar o container → `degraded` e o turno do canal segue pelo Vertex.
   6. Um `@aura …` no escritório + uma pergunta na Sala de Pesquisa → `token_ledger` com `totalTokens > 0`, `surface` certo, `phase` por fase; `cachedTokens > 0` em pelo menos um turno longo (gate A1). `node scripts/conferir-tokens.mjs --url https://zaeon.com.br --cookie "<sessão admin>"` → diferença 0 (gate A3).
   7. Variable `NEXT_PUBLIC_MENTORES_TAB=1` → redeploy com `rebuild=true` → `/mentores` abre com "Mentores" primeiro; `/plugin-store?from=x` → `/mentores?from=x` (gate A2).
   **Rollback:** `GATEWAY_URL=""` + redeploy (turno volta ao Vertex direto na hora, sem rebuild) · Variable `NEXT_PUBLIC_MENTORES_TAB=0` + rebuild · `TOKEN_LEDGER=0` desliga a escrita · `AGENT_TETO_ENFORCE=""` (default) mantém o teto só avisando.
4. **Medidas (handoff §9), 48h após ligar — preencher aqui:** tokens/dia por agente e por `surface` (`porDia`/`porSurface`), taxa de `ok:false` por classe de erro, chamadas do canal por `provedor:"litellm"` vs `"vertex"`, `cachedTokens`/`promptTokens` (prova de que o `contextCache` entra na conta).

## O que NÃO foi verificado nesta máquina (e por quê)
- **Resposta real do Vertex via LiteLLM** e **estouro de budget**: a service account do `.env` local está revogada (`invalid_grant` chamando o Google direto) e a imagem `main-stable` do LiteLLM quebrou `/key/generate` hoje.
- **Linhas reais do ledger / painel com números / conferir-tokens**: sem Mongo nem Vertex válidos aqui.
- **Estados visuais da loja**: sem `next build`.
- O teste do gateway encheu o disco do Mac (Docker.raw chegou a 11 GB; 119 MB livres) — containers e imagens de teste removidos, `.env.secrets` vazio criado localmente (gitignored) só para o compose subir.
