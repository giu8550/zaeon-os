# PROMPT DE EXECUÇÃO — Claude Code (Opus) · Escritório Zaeon · **Fatia 1 · Fundação**

> **Você é o EXECUTOR.** Todo o projeto já foi decidido, pesquisado e contratado em código.
> Você NÃO redesenha, NÃO reabre decisão, NÃO re-deriva tipo, NÃO explora o repo além das
> âncoras dadas. Você integra, verifica e **para em cada gate**. Co-autorado pelo Fable em
> 2026-10-07 a partir de `docs/HANDOFF_ESCRITORIO_AGENTES_V2.md` (§4 contratos, §5 camada 0, §7
> flags, §8 guardrails) + `docs/PROSPECCAO_AGENTES_AUTONOMOS.md` (PR-A1/A2/A3, PR-S0).
>
> **Esta fatia = 5 PRs, nesta ordem: G1 → A1 → G2 → A3 → A2.** Ela nasce os contratos **C5**
> (envelope de LLM + `TokenLedger`) e **C6** (virtual key por agente). Nenhum PR desta fatia
> consome contrato que ainda não existe. **Toda âncora `arquivo:linha` abaixo foi verificada em
> `origin/main` = `5d3971d` (2026-10-07)** — se a linha andou, procure pelo símbolo, não garimpe.

---

## 0. Leia antes de codar (só isto, nesta ordem)

1. `docs/HANDOFF_ESCRITORIO_AGENTES_V2.md` — §1, §2 (estado verificado), **§4 (os 12 contratos — você cria C5 e C6, não toca nos outros)**, §5 "CAMADA 0" (G1, A1, G2, A3, A2 — só estes), §7 (flags), §8 (guardrails).
2. `docs/PROSPECCAO_AGENTES_AUTONOMOS.md` — só **PR-A1 (`:403-441`)**, **PR-A2 (`:443-469`)**, **PR-A3 (`:471-495`)** e **PR-S0 (`:1038-1060`)**. O resto é contexto, não tarefa.
3. `docs/HANDOFF_ESCRITORIO_COWORKING.md` — como o turno do canal chama o harness (é um dos pontos que você envelopa).
4. `docs/FONTES_BASE.md` — ao usar LiteLLM, acrescente a linha de atribuição (MIT) na seção de gateway (criar se não existir).

## 1. Guardrails invioláveis (violar = PR rejeitado)

- **Flag off por padrão; merge não muda comportamento.** `GATEWAY_URL` vazio = Vertex direto, byte a byte como hoje. `NEXT_PUBLIC_MENTORES_TAB` off = diff visual zero. O ledger escreve **sempre** (kill-switch `TOKEN_LEDGER=0`), mas **best-effort**: nunca derruba turno, chat ou busca.
- **Escopo rígido do gateway (handoff §5 G1):** só a **camada autônoma** passa pelo gateway. Nesta fatia a única rota que opta pelo gateway é o **turno do canal** (`lib/canal/agent-turn.ts`) e, mesmo ele, só com `GATEWAY_URL` setado. Pesquisa, estudos, mentores no chat, voz, deep thinking **continuam no Vertex direto** — não mude a `rota` deles.
- **Gemini continua a IA única nesta fatia.** O gateway roteia **só para Vertex Gemini** (mesma credencial). Cloudflare/Groq/GLM são **PR-G3 (fatia 7)** — nem configure. Guardrails §8.10 (dado de aluno nunca sai do Vertex) e §8.11 (uma conta por provedor) valem desde já.
- **Nenhum segredo no git.** `GATEWAY_MASTER_KEY`, `GATEWAY_KEY_*`, `LITELLM_SALT_KEY`, senha do Postgres → `.env` do VPS / secrets do Actions. `.env.example` recebe só o nome e o comentário.
- **Um envelope, não vinte.** A saída de LLM vira `lib/llm/envelope.ts` (`gerar()`), e os helpers existentes (`geminiJson`, `geminiText`) viram **wrappers finos** dele mantendo a assinatura. Quem não couber no envelope nesta fatia recebe `medir()` de 1 linha (lista fechada no PASSO 2) — nunca uma segunda implementação.
- **Não tocar:** `lib/plans.ts` · `lib/ai/contextCache.ts` · `model Plugin` (gate G9) · `/api/plugins` · o protocolo do cliente do chat (sentinelas `@@STUDIO_ACTION@@` etc.) · `lib/agent/trajectory.ts` além do que o PASSO 2.4 manda.
- **Erros via `messageForError`** (`lib/agent/errors.ts`). Nunca string de erro à mão para o usuário.
- **UI aditiva, vidro claro === escuro** (`lib/canal/vidro.ts` já tem os tokens). Sem lib de chart nova (A3 usa barras CSS).
- **Verificação:** `npx tsc --noEmit` limpo + `npx vitest run` verde a cada PR (o CI `build-test` roda os dois). `npx prisma generate` só quando o schema mudar; `npx prisma db push` (Mongo, sem migração). **Nunca `next build` no loop.** O mac **não tem `python`**.
- **1 PR por passo**, branch `escritorio/fatia1-<passo>-<slug>`, ≤ ~8 arquivos, descrição citando o contrato encarnado (C5/C6) e a flag. Nada mergeia com gate vermelho.

## 2. Importe, não reescreva (símbolo existente = import)

| O que | Onde (verificado) |
|---|---|
| Vertex: credencial + modelo + JSON | `lib/scholar/gemini.ts` — `makeVertex()`, `getGeminiModel()`, `extractText()`, `withTimeout()`, **`geminiJson()` (`:59`)** |
| Vertex: texto simples | `lib/ai/gemini-text.ts` — `geminiText()` |
| Modelos por env | `lib/ai/model.ts` — `GEMINI_MODEL_FLASH`, `GEMINI_MODEL_PRO` |
| Harness: onde o modelo é chamado | `lib/agent/aura-harness.ts` — `defaultGenJson` (`:50-53`), `HarnessOpts` (`:30-39`, tem `genJson?`), `buildHarnessDeps` (`:213`) |
| Harness: orçamento estimado | `lib/agent/trajectory.ts` — `COST` (`:84`), `charge()` (`:119-122`), `overBudget()` (`:124-126`), `HarnessDeps` (`:65-74`) |
| Turno do canal (o único que vai ao gateway) | `lib/canal/agent-turn.ts` — `genJson` injetado (`:126-127`), `buildHarnessDeps(hctx, {…, genJson})` (`:138`) |
| Chat principal (2 chamadas Vertex diretas) | `app/api/ai/chat/route.ts` — `sendMessageStream` (`:414`, loop `:420`) e `sendMessage` (`:465-466`) |
| Padrão best-effort de escrita | `lib/canal/usage.ts` — `registrarUso()` (try/catch, `console.warn`, devolve boolean) |
| Padrão de agregação pura testada | `lib/canal/usage.ts` — `agregarUso()` + `lib/canal/usage.test.ts` |
| Founder gate | `lib/admin/assertAdmin.ts` — `assertAdmin()`; flag `agentsAdmin()` em `lib/canal/flags.ts` |
| Admin de agentes (onde A3 entra) | `app/api/admin/agents/route.ts` (`GET :34`, `agregarUso :41`, `mergeProfiles :45`) · `app/workstation/admin/modules/AgentsModule.tsx` (tipo `uso :17`, totalizador `:75,81`, card `:151-157`) · `app/workstation/admin/page.tsx` (abas `:99-144`, render `:171-178`) |
| Loja (onde A2 entra) | `app/plugin-store/page.tsx` (416 linhas; card Zaeon Code `:50-58`; `categories :70`; mapeamento "Mentorias" `:108`; `MentoresGrid :208`) · `components/mentors/MentoresGrid.tsx` ("Contratar mentor" `:188`) · nav: `components/main/navbar.tsx:169`, `components/main/footer.tsx:19`, `components/study/MentorPill.tsx:97`, label admin `app/workstation/admin/page.tsx:119` |
| Health | `app/api/health/route.ts` (devolve `status/service/commit/harness/time`) |
| Compose/infra | `docker-compose.beta.yml` (serviços `web :21`, `redis :242` = `redis:7-alpine`, `caddy :275`; `web` usa `expose`, `env_file: [.env, .env.secrets]`) · `Caddyfile` (bloco `handle { reverse_proxy web:3000 }` `:31-38`) · `Dockerfile` (build-args `NEXT_PUBLIC_*` já cabeados — copie o padrão) · `.github/workflows/deploy.yml` (passa `NEXT_PUBLIC_*` das Variables do repo) |
| Fila/worker (molde) | `lib/canal/queue.ts` + `instrumentation-node.ts` |

## 3. Os dois contratos que esta fatia CRIA (texto final — copie, não reinterprete)

### C5 · Envelope de LLM + `TokenLedger`

```ts
// lib/llm/envelope.ts
export type Rota = "vertex" | "gateway";            // "gateway" só com GATEWAY_URL; senão cai em "vertex"
export type LedgerCtx = {
  agentKey: string;                                  // persona.id | mentor.slug | "sistema"
  surface: "estudos" | "pesquisa" | "canal" | "programa" | "aula" | "projetos" | "whatsapp" | "admin" | "outro";
  userId?: string | null; mentorSlug?: string | null; scopeId?: string | null;
  programId?: string | null; taskId?: string | null; phase?: string | null; // Phase do harness quando houver
};
export type GerarReq = {
  system?: string; user: string;                     // ou `messages` (histórico) — um dos dois
  messages?: { role: "user" | "model"; text: string }[];
  json?: boolean; model?: string; temperature?: number; timeoutMs?: number;
  rota?: Rota; ctx: LedgerCtx;
};
export type Usage = { prompt: number; completion: number; cached: number; total: number; reportado: boolean }; // reportado:false = provedor cego (zeros, NUNCA inventados)
export type GerarRes = { texto: string; usage: Usage; modelo: string; provedor: "vertex" | "litellm"; finishReason?: string };
export function gerar(req: GerarReq): Promise<GerarRes>;
export function gerarJson<T>(req: GerarReq): Promise<T>;   // = gerar({...json:true}) + parse com os mesmos erros diagnósticos do geminiJson atual
export type ClasseErroLlm = "auth" | "credito" | "rate_limit" | "cota_esgotada" | "teto" | "modelo_inexistente" | "timeout" | "provedor_fora" | "pool_esgotado" | "resposta_nao_json" | "outro";
export function classificarErroLlm(e: unknown): ClasseErroLlm;   // PURO — IMPORTADO de lib/llm/usage.ts (já especificado e testado, 31 testes: ver docs/VERIFICACAO_CHAVES_GATEWAY.md §4), não reimplementar
export function reenfileiravel(c: ClasseErroLlm): boolean;  // transitório → a fila tenta de novo (rate_limit, timeout, provedor_fora, pool_esgotado)
export function declaravel(c: ClasseErroLlm): boolean;      // o agente DECLARA ao humano (teto, cota_esgotada — lei 5); auth/credito são problema NOSSO, nunca recado pro aluno
```

```prisma
// prisma/schema.prisma (append) — contrato C5
model TokenLedger {
  id               String   @id @default(auto()) @map("_id") @db.ObjectId
  at               DateTime @default(now())
  userId           String?  @db.ObjectId
  agentKey         String
  mentorSlug       String?
  surface          String
  scopeId          String?
  programId        String?  @db.ObjectId
  taskId           String?  @db.ObjectId
  phase            String?
  model            String
  provedor         String                    // "vertex" | "litellm"
  rota             String                    // "vertex" | "gateway"
  promptTokens     Int      @default(0)
  completionTokens Int      @default(0)
  cachedTokens     Int      @default(0)
  totalTokens      Int      @default(0)
  estimatedCostUsd Float    @default(0)      // ESTIMATIVA (lib/ai/preco.ts), não fatura; cached cobrado à parte
  ok               Boolean  @default(true)
  erro             String?                   // classe do erro quando ok=false
  ms               Int      @default(0)

  @@index([agentKey, at])
  @@index([userId, at])
  @@index([programId, at])
  @@index([at])
  @@map("token_ledger")
}
```

**Regras do envelope:** (1) `usage` normalizado de `response.usageMetadata` (Vertex: `promptTokenCount`, `candidatesTokenCount`, `cachedContentTokenCount`, `totalTokenCount`) ou de `usage` OpenAI-compatible (`prompt_tokens`, `completion_tokens`, `total_tokens`, `prompt_tokens_details.cached_tokens`); ausente = zeros com `ok:true` (nunca inventar). (2) Escreve o ledger **depois** de devolver? Não — escreve em `void registrarTokens(...)` (fire-and-forget, try/catch) **antes** do `return`, para o turno nunca esperar o banco. (3) `rota:"gateway"` sem `GATEWAY_URL` ou com o gateway caído → **cai para `vertex` na mesma chamada** e grava `provedor:"vertex"` (é isso que o health chama de `degraded`). (4) Erro de LLM é relançado **classificado** (`classificarErroLlm`) e também gravado com `ok:false`. (5) **`cached` é contado à parte, nunca somado como token cheio:** o cache do Vertex cobra ~10% do prompt; `promptTokens` = `promptTokenCount − cachedContentTokenCount` (não-cacheado), `cachedTokens` = `cachedContentTokenCount`, `totalTokens` = `totalTokenCount` como o Vertex devolve. O custo usa as três colunas com preço próprio (`lib/ai/preco.ts`) — somar tudo como cheio inflaria justamente quando o `contextCache` está funcionando.

### C6 · Virtual key por agente

```ts
// lib/llm/chaves.ts (PURO + env) — re-exporta de lib/llm/usage.ts (chaveDoAgente/nomeEnvDaChave já existem lá com teste); não duplicar
export function nomeEnvDaChave(agentKey: string): string;      // "eng-computacao" → "GATEWAY_KEY_ENG_COMPUTACAO"
export function chaveDoAgente(agentKey: string, env = process.env): string | null; // GATEWAY_KEY_<AGENT> ?? GATEWAY_KEY_DEFAULT ?? null
export function gatewayLigado(env = process.env): boolean;      // !!GATEWAY_URL
```
Key = emitida pelo LiteLLM (`/key/generate`) com `key_alias = agent:<agentKey>:<ambiente>`, `max_budget` (USD/dia), `budget_duration: "1d"`, `models` (allowlist: só o Gemini da fatia), `duration` (TTL, ex.: `90d`). Estourou o budget → LiteLLM responde erro de budget → `classificarErroLlm` = `"teto"` → o chamador trata como **indisponibilidade declarada** (lei 5 do §3.1), nunca como erro genérico.

## 4. OS PASSOS (ordem executável; pare e reporte 1 linha em cada gate)

### PASSO 1 — PR-G1 · Gateway de pé (LiteLLM, interno, só Vertex)
Branch `escritorio/fatia1-g1-gateway`.
1. **Compose** (`docker-compose.beta.yml`): serviços `litellm` (`ghcr.io/berriai/litellm:main-stable`, `expose: ["4000"]`, `env_file: [.env, .env.secrets]`, `command: ["--config","/app/litellm.config.yaml","--port","4000"]`, volume do config, `depends_on: [litellm-db, redis]`, `mem_limit` via env no padrão `MEM_*` do arquivo) e `litellm-db` (`postgres:16-alpine`, volume nomeado `litellm_pg`, senha de env). **Redis = o serviço `redis` do compose (`redis://redis:6379`)**, não o Upstash REST (LiteLLM precisa de Redis TCP; ver "decisões assumidas"). Ambos **sem `ports`** — só a rede interna; o `web` fala `http://litellm:4000`. **Perfil opcional** `profiles: ["gateway"]` para o deploy enxuto (`SERVICES="redis caddy web"` do `deploy.yml`) não subir o gateway por acidente.
2. **`infra/litellm.config.yaml`** (novo, versionado): `model_list` com **um** alvo — `zaeon-flash` → `vertex_ai/${GEMINI_MODEL_FLASH}` (credencial via `GOOGLE_CREDENTIALS` já existente em `.env.secrets`; `vertex_project`/`vertex_location` de env) — e `zaeon-pro` → `vertex_ai/${GEMINI_MODEL_PRO}`. `general_settings: { master_key: os.environ/GATEWAY_MASTER_KEY, database_url: os.environ/LITELLM_DATABASE_URL }`; `litellm_settings: { drop_params: true, num_retries: 1, request_timeout: 45 }`; `router_settings: { redis_host: redis, redis_port: 6379 }`. **Nenhum outro provedor.** Auth obrigatória (sem `master_key` o LiteLLM não sobe).
3. **`lib/llm/envelope.ts`** (C5, assinatura da §3): **normalização de `usage` e classificação de erro vêm de `lib/llm/usage.ts`** (`usageDoVertex`, `usageDoOpenAI`, `classificarErroLlm`, `reenfileiravel`, `declaravel`, `lerRateLimit` — se o arquivo ainda não estiver no repo, ele é o PRIMEIRO arquivo deste PR, com os 31 testes de `usage.test.ts` conforme `docs/VERIFICACAO_CHAVES_GATEWAY.md` §4); transporte `vertex` = exatamente o que `geminiJson`/`geminiText` fazem hoje (reuse `makeVertex`/`getGeminiModel`/`extractText`/`withTimeout` de `lib/scholar/gemini.ts` — exporte o que faltar); transporte `gateway` = `fetch(`${GATEWAY_URL}/v1/chat/completions`)` com `Authorization: Bearer ${chaveDoAgente(ctx.agentKey) ?? GATEWAY_MASTER_KEY}` e `response_format: {type:"json_object"}` quando `json`. **Nesta PR o ledger ainda não existe:** `registrarTokens` é um no-op exportado de `lib/llm/ledger.ts` que o PASSO 2 preenche (assim o envelope nasce completo e testável). `lib/llm/chaves.ts` entra aqui (C6 nasce no PASSO 3, mas o nome da env é decidido agora).
4. **`lib/llm/saude.ts`**: `estadoGateway()` → `"off"` (sem `GATEWAY_URL`) · `"on"` (GET `${GATEWAY_URL}/health/liveliness` 200, cache 60s em memória) · `"degraded"` (configurado e falhando). **`app/api/health/route.ts`** ganha `gateway` e `provedor` (`"vertex-direct"` | `"litellm"`), sem tocar nos campos atuais.
5. **`.env.example`**: `GATEWAY_URL=""`, `GATEWAY_MASTER_KEY=""` (🔒), `LITELLM_DATABASE_URL=""` (🔒), `LITELLM_SALT_KEY=""` (🔒), `GATEWAY_KEY_DEFAULT=""` (🔒), `TOKEN_LEDGER=""` (`"0"` desliga), `AGENT_TETO_ENFORCE=""` (`"1"` = o teto por agente passa a desativar o trabalho autônomo; vazio = só avisa — PASSO 4). **`docs/FONTES_BASE.md`**: linha LiteLLM (MIT, "ADOTAR — gateway/virtual keys").
6. **Testes** (`lib/llm/envelope.test.ts`, `lib/llm/chaves.test.ts`, `lib/llm/saude.test.ts`; `fetch`/Vertex mockados): `rota:"gateway"` sem `GATEWAY_URL` → vertex; gateway 503 → vertex com `provedor:"vertex"`; usage normalizado nos dois formatos (incl. `cached`); `classificarErroLlm` cobre 429/401/402/budget/timeout; `nomeEnvDaChave("eng-computacao")`.
**Gate G1 (binário):** `node scripts/provar-chaves.mjs --gateway http://litellm:4000/v1 --key <master>` → `APTO` nas 4 provas (autentica · responde · tool · usage); `GATEWAY_URL` vazio → `tsc`+`vitest` verdes e **zero** diff de comportamento (nenhum call site mudou ainda); `GATEWAY_URL` apontado para o container e `docker compose --profile gateway up litellm` → `/api/health` devolve `gateway:"on"`; parar o container → `gateway:"degraded"` e `gerar({rota:"gateway"})` responde pelo Vertex. **Reporte:** `PASSO 1: verde/vermelho + saída do /api/health nos 3 estados`.

### PASSO 2 — PR-A1 · Telemetria real de tokens (nasce C5 por inteiro)
Branch `escritorio/fatia1-a1-token-ledger`.
1. **Schema:** `TokenLedger` (bloco da §3) → `npx prisma generate` → `npx prisma db push`.
2. **`lib/llm/ledger.ts`:** `registrarTokens(prisma, linha)` no molde de `registrarUso` (try/catch, `console.warn`, boolean; respeita `TOKEN_LEDGER="0"`; `userId` só se for ObjectId válido). **`lib/ai/preco.ts`** (ao lado de `model.ts`, fonte única e editável): tabela `USD_POR_MILHAO[model] = {prompt, completion, cached}` com os Gemini 2.5/3.x (cached ≈ 10% do prompt), comentário **"ESTIMATIVA — editar aqui; não é fatura"**; `custoEstimadoUsd(model, usage)` puro, cobrando `prompt`, `completion` e `cached` cada um pelo seu preço. **`lib/llm/medir.ts`:** `medirVertex(result, ctx, {model, ms, ok})` — extrai `usageMetadata` de um `GenerateContentResult`/`StreamGenerateContentResult.response` e chama `registrarTokens` (é a porta de 1 linha para quem não passa pelo envelope).
3. **Wrappers finos (assinaturas intactas):** `geminiJson(system, user, opts)` em `lib/scholar/gemini.ts` → `gerarJson({..., rota:"vertex", ctx: opts?.ctx ?? {agentKey:"aura", surface:"pesquisa"}})` (`opts` ganha `ctx?: LedgerCtx` opcional); `geminiText(opts)` em `lib/ai/gemini-text.ts` → `gerar({...})` idem (`ctx` opcional, default `{agentKey:"sistema", surface:"outro"}`). Zero mudança para quem já chama.
4. **Harness (`lib/agent/aura-harness.ts` + `lib/agent/trajectory.ts`, mínimo):** `HarnessOpts` ganha `ledger?: LedgerCtx`; `defaultGenJson` repassa `{...opts, ctx: {...ledger, phase}}` — o `phase` vem do call site (`plan`→`"plan"`, `reason`→`"reason"`, `draft`→`"draft"`; os três já são distinguíveis nos métodos de `buildHarnessDeps`). **Reconciliação:** `HarnessDeps` ganha **opcional** `usoMedido?(): number`; `buildHarnessDeps` acumula `usage.total` de cada `genJson` num contador e expõe por ele; em `trajectory.ts`, **só** isto: ao fim de `charge()`, `if (d.usoMedido) st.spent.tokens = Math.max(st.spent.tokens, d.usoMedido())` — `COST` continua a estimativa de pré-voo, `overBudget()` passa a frear com o maior entre estimado e medido. Sem `usoMedido` (testes antigos, outros adaptadores) nada muda. **Preencha `ledger`** em quem chama `buildHarnessDeps`: `app/api/ai/chat/route.ts` (via `runChatTurn` em `lib/agent/runChatTurn.ts`: `{agentKey: mentor?.slug ?? "aura", mentorSlug, userId, surface, scopeId: ac.cartolinaScopeId}`) e `lib/canal/agent-turn.ts` (`{agentKey: agente.agentKey, surface:"canal", scopeId: canal.id, userId}`, e **`rota: gatewayLigado() ? "gateway" : "vertex"`** no `genJson` injetado — este é o único opt-in ao gateway da fatia).
5. **Chat legado (as 2 chamadas diretas):** `app/api/ai/chat/route.ts` — após o `for await` do stream (`:420`), `const final = await streamResult.response; void medirVertex(final, ctx, {...})`; e em `:465-466` `void medirVertex(result, ctx, {...})`. `ctx = {agentKey, mentorSlug: activeMentor?.slug, userId, surface: surface ?? "estudos"}`. **Lista fechada do que fica SEM medir nesta PR** (documentar em `docs/HANDOFF_FATIA1_RESULTADO.md`, seção "não medido"): `app/api/agentic/{biosim,codelab,quantum}`, `app/api/ai/{agent-search,generate-document,relate}`, `app/api/documents/abnt-export`, `app/api/onboarding-extract`, `app/api/research/chat/[researchId]`, `app/api/studio/diag`, `lib/ai/router.ts` (`generate`), `lib/scholar/suggest.ts`, `lib/whatsapp/brain.ts`, e os 3 de TTS (`lib/studio/gemini-tts-request.ts`, `lib/studio/podcast-tts.ts`, `lib/voice/gemini-tts.ts` — TTS não tem `usageMetadata` útil). Se sobrar orçamento, **PR-A1b** separado: `medirVertex` de 1 linha em cada um dos 12 primeiros.
6. **`lib/metrics/tokens.ts`** (PURO): `porAgente(rows, range)`, `porUsuario`, `porPrograma`, `porDia(rows, dias)`, `topN(rows, by, n)`, `totalizador(rows, agora)` → `{hoje, mes}`; `range` = `"7d" | "30d" | "all"` com `desde(range, agora)`. Fixture em `lib/metrics/tokens.test.ts`.
**Gate A1:** um turno no escritório (`@aura …`) e uma pergunta na Sala de Pesquisa gravam linhas em `token_ledger` com `totalTokens > 0`, `agentKey`/`surface`/`phase` certos; teste com `prisma.tokenLedger.create` **lançando** → o turno responde igual; `overBudget` com `usoMedido` maior que o estimado para a trajetória (teste no `trajectory.test.ts` existente, caso novo); `tsc`+`vitest` verdes. **Reporte:** `PASSO 2: verde/vermelho + 2 linhas reais do ledger (JSON)`.

### PASSO 3 — PR-G2 · Virtual key por agente (nasce C6)
Branch `escritorio/fatia1-g2-virtual-keys`.
1. **`scripts/gateway-keys.mjs`** (Node, lê `.env`): para cada `agentKey` de `rosterBase()`+mentores do banco (ou lista passada por `--agents`), **idempotente por `key_alias`** (`GET /key/info` por alias → existe = `POST /key/update`, senão `POST /key/generate`) com `max_budget` (USD/dia, default `0.50`, override `--budget`), `budget_duration:"1d"`, `models:["zaeon-flash","zaeon-pro"]`, `duration:"90d"`, `metadata:{agentKey, ambiente}`. Saída: tabela `agentKey → GATEWAY_KEY_<NOME>=<key>` para colar no `.env` do VPS (**nunca grava o .env sozinho; nunca imprime a master key**). `--revoke <agentKey>` chama `POST /key/delete`.
2. **Envelope:** `gerar()` com `rota:"gateway"` usa `chaveDoAgente(ctx.agentKey)`; sem key do agente **e** sem `GATEWAY_KEY_DEFAULT` → `rota` cai para `vertex` com `console.warn` 1× por processo por agente (não por chamada).
3. **Teto no turno do canal (lei 5):** em `lib/canal/agent-turn.ts`, `catch` do `gerar` com `classificarErroLlm(e) === "teto"` → mensagem **efêmera** do agente (padrão já existente no `executarTurno`: `efemera:true`) com texto de `messageForError("agent_budget_exhausted")` — **adicione essa chave em `lib/agent/errors.ts`** (texto: "Meu limite diário de uso acabou. Volto amanhã — ou peça pra outro mentor."). O humano vê que é teto, não ignorância.
4. **`.env.example`:** comentário com o padrão `GATEWAY_KEY_<AGENTKEY>` e 2 exemplos (`GATEWAY_KEY_AURA`, `GATEWAY_KEY_ENG_COMPUTACAO`).
5. **Testes:** `chaves.test.ts` (precedência agente > default > null); `envelope.test.ts` (header `Authorization` certo por agente; budget error → `"teto"`); `agent-turn.test.ts` (caso novo: `gerar` lança budget → mensagem efêmera com o texto do catálogo, nada persistido).
**Gate G2:** 3 keys geradas (`aura`, `medicina`, `enfermagem`) com `--budget 0.01`; estourar a da `medicina` com um loop de chamadas → **só a Osler** responde "limite diário"; `aura` segue; `scripts/gateway-keys.mjs --revoke medicina` + nova chamada → vertex direto com warn. **Reporte:** `PASSO 3: verde/vermelho + tabela das 3 keys (sem os valores)`.

### PASSO 4 — PR-A3 · Admin: gasto por agente (painel fundido, leitura ligada, ação atrás de flag)
Branch `escritorio/fatia1-a3-admin-gasto`. Dentro de `NEXT_PUBLIC_AGENTS_ADMIN` (já existe, já é build-arg, **já está on em prod**): o painel é **leitura → entra visível por default, sem toggle**; só o **teto** (que age) leva flag.
1. **`GET /api/admin/agents/tokens?range=7d|30d|all&groupBy=agente|usuario|programa`** (`app/api/admin/agents/tokens/route.ts`): `agentsAdmin()` + `assertAdmin()` (404/401/403 como `app/api/admin/agents/route.ts`); lê `tokenLedger.findMany({where:{at:{gte: desde(range)}}})` (teto `take: 50_000`, `at desc`) e devolve `{grupos: porX(...), serie14d: porDia(rows,14), totais: totalizador(rows), medindoDesde: <at da PRIMEIRA linha do ledger, qualquer agente, ou null>}` via `lib/metrics/tokens.ts`. `groupBy=usuario` resolve nome/e-mail como o GET existente faz com `top`. Cada grupo traz `promptTokens`, `completionTokens`, `cachedTokens`, `totalTokens`, `custoEstimadoUsd`, `chamadas`, `tokensPorChamada`.
2. **Fundir, não acrescentar** (`AgentsModule.tsx`): o bloco **USO** que já existe (`:151-157`: `uso.total`, `usuarios`, `ultimoUso`, top-5) **ganha colunas** — `tokens in` (prompt não-cacheado) · `tokens out` · `cached` · `total` · `custo est.` · `tokens/turno` — **na mesma linha do agente**; um painel só, **ordenável por qualquer coluna** (uso, in, out, cached, total, custo, tokens/turno), seletor `7d/30d/all` no topo do módulo, barras CSS de 14 dias no `title`/tooltip. Nada de bloco "Gasto" separado, nada de lib de chart.
3. **Datar e declarar o vazio:** cabeçalho do painel = **"medindo desde <data da primeira linha do TokenLedger>"**. Ledger vazio → **"sem dados de consumo ainda — a medição começa no próximo turno"**, nunca um zero silencioso. Agente **sem linha no período** → colunas de token em **"—"**, não `0` (o `0` fica reservado a linha existente com zero tokens, ex.: `ok:false`).
4. **Custo = estimativa, dito na cara:** rótulo da coluna "custo est." com tooltip "estimativa pela tabela em `lib/ai/preco.ts`; não é fatura"; `cached` **exibido à parte** e cobrado pelo preço de cache (regra (5) da §3).
5. **Teto — separar ler de agir.** `AgentProfile.tetoTokensDia Int?` (`generate` + `db push`); `PATCH /api/admin/agents/[agentKey]` aceita `tetoTokensDia` (inteiro ≥ 0 ou `null`). **`lib/llm/teto.ts`:** `foraPorTeto(prisma, agentKey, agora)` → `{fora, usado, teto}` somando `totalTokens` de hoje. **Flag `AGENT_TETO_ENFORCE=""`** (server): **off** = o admin mostra o aviso **"estouraria o teto hoje (usado/teto)"** no card e **nada é desativado**; **on** = `executarTurno` com `input.origem === "autonomo"` consulta `foraPorTeto` e, se fora, devolve `{ok:false, motivo:"teto"}` + mensagem efêmera "fora por teto". `origem` default = `"humano"` — turno pedido por humano **nunca** é barrado, com flag on ou off (handoff §5 A3). Nesta fatia ninguém dispara `"autonomo"` ainda: o freio nasce testado e dormente, e a flag deixa o Martinez **calibrar o número vendo-o ser atingido** antes de desligar mentor em produção.
6. **`scripts/conferir-tokens.mjs`:** soma crua do `token_ledger` por agente nos últimos 7d (in/out/cached/total/custo) ao lado do que a rota devolve — diferença **0** em todas as colunas.
7. **Testes:** rota `tokens` (401/403/404 por flag; `range` inválido → 400; agregação bate com fixture; `medindoDesde` null com ledger vazio); `lib/metrics/tokens.test.ts` (agente sem linha no período **não aparece com zeros**: ausente do grupo → UI mostra "—"); `teto.test.ts` (sem teto → nunca fora; teto 100 e 100 usados → fora; vira à meia-noite local); `agent-turn.test.ts` (flag off + autônomo + fora → responde normal; flag on + autônomo + fora → `motivo:"teto"` e `gerar` não chamado; humano + fora + flag on → responde normal).
**Gate A3:** admin mostra números que **batem** com `scripts/conferir-tokens.mjs` (diferença 0, coluna a coluna); ledger vazio mostra a frase do vazio e nenhum `0`; agente sem linha mostra "—"; `AGENT_TETO_ENFORCE` off só avisa, on freia só `origem:"autonomo"`; `7d`/`30d` conferem; claro e escuro legíveis. **Reporte:** `PASSO 4: verde/vermelho + saída do conferir-tokens`.

### PASSO 5 — PR-A2 · Aba Plugins → Mentores
Branch `escritorio/fatia1-a2-mentores`. Flag **`NEXT_PUBLIC_MENTORES_TAB`** — **cabear como build-arg** em `Dockerfile` + `docker-compose.beta.yml` (copie o bloco das 3 flags do escritório) **e** em `.github/workflows/deploy.yml` (lista `envs` + o laço `for k in …` que exporta só o que veio preenchido). Sem isso a flag não chega ao cliente em prod (lição registrada no handoff §7).
1. **Extrair** o corpo de `app/plugin-store/page.tsx` para `components/mentors/LojaMentores.tsx` **sem mudar lógica** (props: `initialCategory?`); `app/plugin-store/page.tsx` vira `return <LojaMentores initialCategory="Todos" />` (flag off) e, com flag on, `redirect("/mentores")` preservando a query (`?from=`). **`app/mentores/page.tsx`** novo: `<LojaMentores initialCategory="Mentores" />`.
2. **Categorias:** com a flag on, `categories` (`:70`) vira `["Mentores","Todos","Essencial","Agentes"]` e o default `"Mentores"`; off = ordem atual. O mapeamento "Mentorias"→"Mentores" (`:108`) não muda. `MentoresGrid` (`:208`) e "Contratar mentor" (`MentoresGrid.tsx:188`) e o teto (`lib/mentors/limite.ts`) **intactos**.
3. **Rótulos (só com flag on):** `components/main/navbar.tsx:169` e `components/main/footer.tsx:19` → "Mentores" / `href="/mentores"`; `components/study/MentorPill.tsx:97` → `/mentores?from=…`; `app/workstation/admin/page.tsx:119` label `plugins` → "Mentores · catálogo" (o módulo `PluginsModule` e a key `plugins` ficam). Helper `lib/mentores/rota.ts`: `lojaHref(from?)` e `lojaLabel()` lendo a flag — para os 4 pontos não repetirem o `if`.
4. **Deep-links** (`?tab=projetos` no card `:50-58`, links antigos `/plugin-store?from=…`) continuam válidos nos dois estados (o redirect preserva a query).
5. **Testes:** `lib/mentores/rota.test.ts` (flag on/off → href/label); teste de componente **não** é necessário (sem jsdom no CI por padrão) — cubra o redirect com um teste da função pura que decide o destino (`destinoDaLoja(flag, search)`).
**Gate A2:** flag off → `git diff` renderizado zero (navegar `/plugin-store`, navbar, footer, admin = iguais); flag on → `/mentores` abre a loja com "Mentores" primeiro, `/plugin-store?from=x` redireciona para `/mentores?from=x`, "Contratar mentor" e o saldo `n/limite` funcionam; `model Plugin` e `/api/plugins` sem diff. **Reporte:** `PASSO 5: verde/vermelho + os 2 estados`.

### PASSO 6 — Verificação final da fatia (não pule)
1. `npx tsc --noEmit` limpo · `npx vitest run` verde · CI `build-test` verde nos 5 PRs.
2. **Flags todas vazias** → `git diff` de comportamento zero: health sem `gateway:on`, loja igual, teto só avisa. Única mudança visível sem flag nova: as colunas de consumo no painel USO do admin (decisão do Martinez: leitura entra ligada, por default, sem toggle) — e o ledger escrevendo.
3. **Runbook de ligar em prod** em `docs/HANDOFF_FATIA1_RESULTADO.md`: ordem = subir `litellm`+`litellm-db` (`--profile gateway`) → `scripts/gateway-keys.mjs` → colar keys no `.env` do VPS → `GATEWAY_URL=http://litellm:4000` → redeploy → `/api/health` `gateway:"on"` → ligar `NEXT_PUBLIC_MENTORES_TAB` nas Variables do repo → redeploy com `rebuild=true`. Rollback = esvaziar `GATEWAY_URL` (turno do canal volta ao Vertex direto na hora, sem rebuild) e Variable `0` + rebuild para a loja.
4. **Medidas (handoff §9):** anexe no mesmo doc 48h de `porDia` do ledger após ligar: tokens/dia por agente e por `surface`, taxa de `ok:false` por classe de erro, e quantas chamadas do canal saíram por `provedor:"litellm"` vs `"vertex"`.
**Gate:** os 4 itens, binários.

## 5. Decisões assumidas pelo Fable (valem até o Martinez vetar — leia antes do PASSO 1)

1. **Gateway = LiteLLM** (handoff §5 G1; pendência §10.4 em aberto). Bifrost ficaria sem Postgres, mas a virtual key com budget/alias que o C6 exige é o caminho batido do LiteLLM. Se o Martinez escolher Bifrost, **só o PASSO 1.1-1.2 e o `scripts/gateway-keys.mjs` mudam** — o envelope, o ledger e os call sites são iguais.
2. **Gateway interno, não atrás do Caddy.** O handoff diz "atrás do Caddy, auth obrigatória"; como nesta fatia só o `web` fala com ele, expor rota pública é superfície a mais sem consumidor. A UI do LiteLLM (`/ui`) fica acessível só por `ssh -L`. Se quiser pública: `handle_path /gateway/* { basic_auth … reverse_proxy litellm:4000 }` no `Caddyfile` — 6 linhas, PR separado.
3. **Redis do gateway = serviço `redis` do compose**, não Upstash (REST ≠ protocolo Redis que o LiteLLM usa). O Upstash segue para `src/lib/ratelimit.ts`.
4. **Gate do G1 ajustado para a fatia:** o handoff pede "derrubar o Vertex e a esteira seguir pelo fallback" — isso exige o pool do **G3** (fatia 7). Nesta fatia o fallback é **gateway↔Vertex direto**: derrubar o `litellm` e o turno do canal seguir pelo Vertex, com `degraded` no health. O gate original passa a ser o gate do G3.
5. **Ledger sempre ligado** (`TOKEN_LEDGER=0` desliga) — como a prospecção A1 decidiu ("sempre on, write best-effort"). É a única coisa da fatia que escreve no banco sem flag, e é só métrica.
6. **Chave do ledger por `agentKey`**, com mentor em `mentorSlug` **e** em `agentKey` quando o turno é de mentor (mesma convenção do `registrarUso`: `activeMentor?.slug ?? agentKey`). Assim o admin agrupa mentor e persona na mesma coluna que o "Uso" já usa.
7. **Teto por agente: ler ≠ agir** (decisão do Martinez, 2026-10-07). O painel de consumo entra ligado (é leitura). O freio só age com `AGENT_TETO_ENFORCE=1` e só sobre `origem:"autonomo"` — com a flag off, o admin avisa "estouraria o teto hoje" e não desativa nada. Nesta fatia ninguém dispara `"autonomo"`; o freio nasce testado e dormente (handoff §5 A3: "turno pedido por humano continua").

## 6. Economia de execução (pedido do Martinez — leve a sério)

Agrupe edições por arquivo; não abra exploração (a §2 tem TODAS as âncoras, verificadas em `5d3971d`); não re-explique contratos — a §3 é o texto final; pare em cada gate e reporte em 1 linha (`PASSO N: verde/vermelho + evidência`); se um gate ficar vermelho 2 tentativas, **PARE e pergunte ao Martinez** em vez de iterar às cegas. Um PR por passo, ≤ ~8 arquivos. Se o PASSO 2.5 (lista "não medido") tentar virar vinte arquivos, é sinal de que você está espalhando o envelope — volte ao `medirVertex` de 1 linha ou deixe para o PR-A1b. O valor está em cada gate verde, não em volume de código.
