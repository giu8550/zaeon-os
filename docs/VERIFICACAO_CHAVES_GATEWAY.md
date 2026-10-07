# Verificação de chaves e gateway — mecanismo, provas e ferramentas

> **2026-10-07.** Investigação do mecanismo de chave do OmniRoute (lendo o código, não o README)
> + as ferramentas de verificação. Complementa o `PR-G3` do handoff
> (`docs/HANDOFF_ESCRITORIO_AGENTES_V2.md`) e os prompts das Fatias 1 e 7.
>
> **Estado no repo (Fable, 2026-10-07, main `d0cc34e`):** este documento chegou pronto; os dois
> entregáveis que ele descreve — `scripts/provar-chaves.mjs` e `lib/llm/usage.ts` +
> `lib/llm/usage.test.ts` ("31 testes passando") — **ainda não estão no repositório** (nem em
> main, nem em branch remota). Até entrarem, a §3 e a §4 valem como **especificação executável**:
> o executor da Fatia 1 (`docs/EXECUTOR_PROMPT_FATIA1_FUNDACAO.md`, PASSO 1.3) cria `usage.ts`
> como primeiro arquivo do PR-G1 e o envelope importa daí. `docs/GATEWAY_AUTONOMO.md`, citado
> abaixo, também não existe no repo.

## 1. O mecanismo de chave do OmniRoute, lido no código

Baixei o pacote (`npm pack omniroute`, v3.8.48 — 163 MB comprimido, **770 MB extraído**) e li os
fontes. O que importa:

**A cifra das chaves de provedor** — `src/lib/db/encryption.ts`:
- **AES-256-GCM** com IV de 12 bytes e authTag; chave derivada com **`scryptSync`** e salt estático
  `"omniroute-field-encryption-v1"`. Existe derivação legada com salt dinâmico
  (`sha256(secret).slice(0,16)`) e migração automática na primeira leitura.
- **O achado que decide a configuração** (linha 125, verbatim):
  > `"[Encryption] STORAGE_ENCRYPTION_KEY not set. Storing plaintext (passthrough mode)."`

  Ou seja: **sem a env, as chaves dos provedores ficam em texto puro no SQLite** — e o único
  sinal é um `warn` no log. `isEnabled()` é literalmente `!!process.env.STORAGE_ENCRYPTION_KEY`.
  Não é erro de boot, não é aviso na UI. Se o gateway subir sem essa env, está tudo em claro.
- Perder a chave = perder os dados (sem recovery). Em plaintext ficam nomes de provider, modelos,
  regras de routing e os registros de uso — só os campos de credencial são cifrados
  (`api_key`, `access_token`, `refresh_token`, `id_token` na tabela `provider_connections`).

**Correção de uma coisa que eu havia dito antes:** o `postinstall` **não** gera `.env`. Lendo
`scripts/build/postinstall.mjs`, ele só copia binários nativos (`better-sqlite3`, `wreq-js`) do
`node_modules` raiz para o `dist/` standalone. Minha informação anterior vinha de um terceiro e
estava errada. (Vale notar o que é o `wreq-js`: o próprio comentário o descreve como *"TLS client
for OAuth providers"* — é a peça do "TLS fingerprint stealth".)

**Pool e rotação** — e aqui a doc de terceiros também estava imprecisa:
- **Quota-Share é fair-share work-conserving**, não DRR+P2C. Dois modos decididos por
  `globalUsedPercent` vs `QUOTA_SATURATION_THRESHOLD` (0.5): *generous* (empresta cota ociosa) e
  *strict* (`poolLimit × allocationWeight/100`). Políticas por alocação: `hard` (bloqueia → 429),
  `soft` (penaliza o score por `QUOTA_SOFT_DEPRIORITIZE_FACTOR`, default 0.7), `burst`.
- **P2C é outra coisa**, e fica na seleção de credencial: escolhe 2 contas aleatórias e pega a mais
  saudável, pontuando headroom de cota + penalidade de erro/recência/uso consecutivo.
- Contador de cota = **sliding window de 2 buckets** (`prev × (1 - elapsed/window) + curr`), em
  SQLite (`quota_consumption`) ou Redis (Lua atômico).
- **São 14 estratégias, não 19.** Não existe `reset-window` nem estratégia `headroom` —
  `reset-aware` prioriza por tempo de reset, e `headroom` é um fator de score no Auto-Combo.
- **Fail-open em tudo:** se o enforcement de cota lançar, a request **passa** com um warn.

**Circuit breaker — os limiares conferem, mas o gatilho não é o que se imagina:**
- OAuth abre em **8** falhas (reset 60s) · API-key em **12** (reset 30s) · local em **2** (15s).
- **Trip codes: só `[408, 500, 502, 503, 504]`.** **401, 403 e 429 NÃO abrem o breaker.** Quem trata
  429 é o *connection cooldown* (base 3s para API-key, backoff `base × 2^n`), que prefere o
  `Retry-After` upstream. Estados **terminais** (não saem com cooldown): `banned`, `expired`,
  `credits_exhausted`.

**Como saber se uma chave está viva, na API dele:** `POST /api/providers/[id]/test` (e
`POST /api/providers/validate`). **Não existe endpoint de "lease"** — isso era imprecisão da
pesquisa anterior. Estado morto/em cooldown aparece em `testStatus`, `rateLimitedUntil`,
`lastErrorType`, `backoffLevel`, e em `GET /api/resilience/model-cooldowns` /
`GET /api/monitoring/health` / `GET /api/rate-limits`.

**Webhooks:** eventos reais são `request.completed`, `request.failed`, `provider.error`,
`provider.recovered`, **`quota.exceeded`**, `combo.switched`, `test.ping`. **Não existe evento de
"key rotation"** (outra imprecisão corrigida). Headers de entrega são `X-Webhook-*` com
`X-Webhook-Signature: sha256=<HMAC>`, não `X-OmniRoute-*`.

**Se o OmniRoute entrar, a configuração mínima é:** `STORAGE_ENCRYPTION_KEY` setado (gerar com
`openssl rand -base64 32`), `INITIAL_PASSWORD` trocado, nunca publicado no Caddy sem auth, os 13
provedores marcados "avoid" desligados, e `QUOTA_STORE_DRIVER=redis` para o contador de cota ser
atômico entre workers.

## 2. Cota restante: quem dá número e quem só dá 429

Isto decide se o gateway pode *prever* o esgotamento ou só *reagir* a ele.

| Provedor | Dá número antes de estourar? | Como |
|---|---|---|
| **Groq** | ✅ o melhor | headers `x-ratelimit-remaining-requests`, `-remaining-tokens`, `-reset-requests`, `-reset-tokens`; `retry-after` só no 429 |
| **OpenRouter** | ✅ | `GET /api/v1/key` → `limit`, `limit_remaining`, `usage`, `is_free_tier`, `free_model_daily_requests{used,limit,remaining}` |
| **Gemini (AI Studio)** | ❌ | sem header e sem endpoint; o Google tirou a tabela da doc e manda olhar o dashboard logado. Só resta observar o `429 RESOURCE_EXHAUSTED` |
| **Cloudflare Workers AI** | ⚠️ só por GraphQL Analytics, e **o contador não é confiável** — há queixa atual de cota presa após o reset 00:00 UTC com dashboard em 0/10k e API devolvendo **code 4006**. Trate o 4006 como o sinal |
| **Z.ai / GLM** | ⚠️ existe `GET /api/monitor/usage/quota/limit`, **não oficial**, auth divergente entre clientes |
| **Mistral** | ❌ não emite header de rate limit (confirmado por issue upstream) |
| **GitHub Models** | ❌ sem header e sem endpoint |

**Consequência de arquitetura:** o orçamento não pode depender de "perguntar quanto resta". Ele tem
de vir do **nosso** contador (`TokenLedger`), com os headers do Groq e o `/key` do OpenRouter como
conferência. É o oposto de confiar no provedor.

## 3. `scripts/provar-chaves.mjs` — a prova de vida

Zero dependências (Node 18+). Nunca imprime a chave (mascara `gsk_12…ab34`). Exit code 1 se algo
com chave configurada falhou — serve em CI.

```bash
node scripts/provar-chaves.mjs                       # tudo que tiver chave no ambiente
node scripts/provar-chaves.mjs groq openrouter       # só estes
node scripts/provar-chaves.mjs --json                # para CI / dashboard
node scripts/provar-chaves.mjs --gateway http://litellm:4000/v1 --key sk-...
```

**As quatro provas, por chave:** `autentica` (distingue 401 de 429 de 402) · `responde` (texto útil
**e** obedeceu a instrução de idioma) · **`tool`** (emite `tool_calls` com schema obrigatório **e
enum** — se inventar valor fora do enum, reprova; é aqui que o grátis quebra) · `usage` (reporta
tokens — sem isso o ledger fica cego e o orçamento não freia).

**Vereditos:** `APTO` · `SEM_CHAVE` · `SEM_CONFIG` · `FALHOU:<classe>` · `RESPOSTA_VAZIA` ·
`SEM_TOOL_CALLING` · `SEM_USAGE` · `RESPOSTA_NAO_JSON`.

O último nasceu de um teste real: rodando aqui, um provedor devolveu **HTTP 200 com corpo `OK\r\n`
em texto puro** — era o proxy de saída respondendo, não o provedor. A primeira versão do script
classificou como "resposta vazia", o que mandaria você conferir a chave quando o problema era a
allowlist de egress. Agora o script separa os dois e aponta o conserto certo. Vale para a VPS, que
também tem proxy no caminho.

No modo `--gateway` ele ainda lê a telemetria por header (`x-litellm-response-cost`,
`x-litellm-attempted-fallbacks`, `x-omniroute-model`, …) e reconhece a mensagem
**`"No deployments available for selected model"`** — o estado "tudo em cooldown", que precisa
virar reenfileiramento e não erro na cara do aluno. Nota: o LiteLLM **não** manda `Retry-After`
nesse 429 (issue #27823), então o backoff é nosso.

## 4. `lib/llm/usage.ts` + `usage.test.ts` — o contrato C5 amarrado

Funções puras, sem rede, sem Prisma, sem env — o CI prova o comportamento sem chave e sem gateway
de pé. **31 testes, todos passando.**

- `usageDoVertex` / `usageDoOpenAI` → `{promptTokens, completionTokens, cachedTokens, totalTokens,
  reportado}`. O teste central: com `promptTokenCount: 1000` e `cachedContentTokenCount: 800`, o
  resultado tem de ser `promptTokens: 200` e `cachedTokens: 800`, e as três colunas têm de fechar
  com o total do provedor. Somar tudo como token cheio infla o custo exatamente quando o
  `contextCache` está funcionando.
- Sem bloco de usage → `reportado: false` com zeros. **Nunca inventar número** — e o
  `reportado: false` é o que torna visível que aquele provedor é cego.
- `classificarErroLlm` cobre `auth`, `credito`, `rate_limit`, `cota_esgotada`, `teto`,
  `modelo_inexistente`, `timeout`, `provedor_fora`, `pool_esgotado`, `resposta_nao_json`. Há teste
  para a **mensagem literal do LiteLLM** — se ela mudar numa versão futura, o teste avisa antes da
  produção.
- `reenfileiravel()` vs `declaravel()`: separa o que a fila tenta de novo (transitório) do que o
  agente **declara** ao humano (teto, cota esgotada — a lei 5 do §3.1 do handoff). `auth` não é
  recado para o aluno: é problema nosso.
- `lerRateLimit` devolve `null` (não `0`) quando o provedor não expõe — *não sabemos* é diferente de
  *acabou*.
- `chaveDoAgente` / `nomeEnvDaChave`: precedência agente > default > nenhuma, com chave vazia caindo
  para o default (contrato C6).

**Para o executor da Fatia 1:** estes dois arquivos são a especificação executável do C5/C6. O
`lib/llm/envelope.ts` deve importar daqui em vez de reimplementar, e os 31 testes têm de continuar
verdes no fim do PASSO 2.

## 5. A sequência de verificação quando a Fatia 1 subir

1. `node scripts/provar-chaves.mjs --gateway http://litellm:4000/v1 --key <master>` → `APTO`.
2. `curl /api/health` nos três estados (`off` sem env · `on` com container · `degraded` com
   container parado, **e a sala continua respondendo pelo Vertex**).
3. Um turno no escritório → `TokenLedger` com `totalTokens > 0` e `rota`/`provedor` corretos.
4. `cachedTokens > 0` em pelo menos um turno longo (prova que o `contextCache` entra na conta).
5. Estourar o budget de uma virtual key → mensagem efêmera de teto, não erro genérico.

Só depois disso, na Fatia 7, as chaves de provedor grátis entram — e aí o `provar-chaves.mjs` roda
sem `--gateway`, uma linha por provedor, e o que decide é a coluna **`tool`**.
