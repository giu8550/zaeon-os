# PR-W1 · `AgentChannel` + provider `bridge` — desenho

> 2026-10-07. Primeira fatia do `docs/HANDOFF_AGENTE_MENSAGEIRO_V3.md` (ver §3 e o adendo de
> verificação). Escopo decidido com o Martinez: **só envio**, sobre o código real do warmer e do
> adapter. Diretório de chips, UI de bind, inbound, governança e outbox ficam pros PRs W2–W4.

## Objetivo

Um agente da Zaeon (`agentKey` do roster) passa a ter um **canal WhatsApp** que referencia um chip
da frota da ChipFlow pelo `chipflowId` (= `WarmerInstance.id`), e o `sender.ts` ganha o provider
`bridge`, que publica `send_text` em `wa:cmd:{shard}` e espera o evento terminal em
`wa:evt:{shard}`. Nada muda sem canal e sem `WHATSAPP_PROVIDER=bridge`.

**Gate:** canal vinculado a um chip real (via rota admin), envio por ele chega no celular, os
providers `evolution | disparos | log` continuam iguais, `tsc` 0 erros, vitest verde.

## Contrato que o código assume (verificado em 2026-10-07)

- `shard = chipflowId % NUM_SHARDS`; `NUM_SHARDS<=1 → "0"`. Prod = 1.
- XADD em `wa:cmd:{shard}` com campos `command_id`, `instance_id` (string decimal), `operation`,
  `idempotency_key`, `v` = JSON compacto de
  `{command_id, instance_id:int, operation, payload, requested_at (RFC3339 Z), idempotency_key}`.
  O adapter lê só `v`.
- `send_text`: `payload = { jid: "55…@s.whatsapp.net", text, delay_ms }`.
- Evento em `wa:evt:{shard}`: campo `v` = JSON de `{event_id, command_id, instance_id, status,
  latency_ms, error_class, error_detail, emitted_at, kind?, result?}`. Terminal =
  `sent | failed | timeout | ignored_duplicate`. No replay de duplicado o adapter reemite o
  `status` do original com o `command_id` do duplicado; se vier literalmente
  `ignored_duplicate`, é terminal com `ok:false`, `error:"duplicado ignorado"`.
- Redis do bridge: `CHIPFLOW_BRIDGE_REDIS_URL` → `BRIDGE_REDIS_URL` → **null**. Nunca `REDIS_URL`.

## Componentes

### 1. Prisma — `model AgentChannel` (`agent_channels`)

```prisma
model AgentChannel {
  id                   String    @id @default(auto()) @map("_id") @db.ObjectId
  agentKey             String                       // → AgentProfile.agentKey / roster
  tipo                 String                       // "whatsapp" | "email"
  origem               String    @default("chipflow") // "chipflow" | "proprio" | "log"
  chipflowId           Int?                         // WarmerInstance.id — define o shard; referência externa, não chave
  chipflowToken        String?                      // 🔒 evo_token (não usado no bridge; guardado pro diretório/HTTP)
  tokenAtualizadoEm    DateTime?
  numero               String?                      // E.164 informativo — a ChipFlow é dona do número
  ownerEmail           String?
  pool                 String?                      // "operator" | "owner"
  tierReportado        String?
  mensagensReportadas  Int?
  apiVersion           String?
  proxyInfo            Json?
  estado               String    @default("nao_vinculado") // nao_vinculado | vinculado | pausado_na_origem | restrito | erro
  limiteDia            Int       @default(20)      // teto local; tier critical
  enviadosHoje         Int       @default(0)
  diaContagem          String?                     // YYYY-MM-DD (BRT) a que enviadosHoje se refere
  ultimoEnvioEm        DateTime?
  ultimoErro           String?
  sincronizadoEm       DateTime?
  email                String?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  @@unique([agentKey, tipo])
  @@index([estado])
  @@index([chipflowId])
  @@map("agent_channels")
}
```

Pendência do dono: `npx prisma db push` no Atlas depois do merge.

### 2. `lib/chipflow/bridge-request.ts` (PURO)

- `shardOf(instanceId, n): string` · `commandStream(id, n)` · `eventStream(id, n)`.
- `buildCommand({ instanceId, operation, payload, idempotencyKey, commandId?, requestedAt? })`.
- `xaddFields(cmd): string[]` — pares chave/valor na ordem `command_id, instance_id, operation,
  idempotency_key, v`, com `v = JSON.stringify(cmd)` (compacto por padrão, UTF-8 cru).
- `sendTextPayload(phoneE164, text, delayMs=1000)` → `{ jid, text, delay_ms }` com
  `jid = jidNumber(phone) + "@s.whatsapp.net"`.
- `parseEvent(fields)` → objeto ou `null` (sem `v` / JSON inválido).
- `isTerminal(status)`; `terminalToResult(evt)` → `{ ok, status, error }` (`error` =
  `error_detail || error_class || status`).
- `resolveBridgeRedisUrl(env)` → string | null.
- `numShards(env)` → `max(1, int(NUM_SHARDS))`, default 1.
- `idemKeyPadrao(instanceId, jid, text)` → `zaeon:send_text:{id}:{sha1(jid|text).slice(0,16)}`
  (determinística pro mesmo texto ao mesmo destino; o chamador pode passar a dele).

### 3. `lib/chipflow/bridge.ts` (IO, ioredis)

- Conexão **própria** por URL (cache em módulo), `maxRetriesPerRequest: 2`, `lazyConnect`.
  Não reusa `getRedisConnection()` do BullMQ (outro Redis).
- `sendTextViaBridge({ instanceId, phone, text, idemKey?, timeoutMs?, env? })`:
  1. `lastId = XREVRANGE evt + - COUNT 1` → id ou `"0-0"` (falha → `"0-0"`);
  2. `XADD cmd * …xaddFields`;
  3. laço `XREAD COUNT 50 BLOCK min(500, restante) STREAMS evt lastId` até o deadline, avançando
     `lastId`, ignorando eventos de outro `command_id`;
  4. terminal → `terminalToResult`; deadline → `{ ok:false, status:"timeout", error:"sem evento
     terminal no prazo" }`; exceção → `{ ok:false, status:"error", error }`.
  Nunca lança. Timeout default `BRIDGE_TIMEOUT_MS` (30 000).
- `BridgeResult = { ok: boolean; status: "sent"|"failed"|"timeout"|"error"|string; error?: string;
  commandId: string; event?: unknown }`.

### 4. `lib/chipflow/canal.ts` (IO, Prisma por import dinâmico)

- `resolverCanalEnvio(agentKey, env)` → `{ fonte:"canal", canalId, chipflowId } |
  { fonte:"env", chipflowId } | null`: canal `tipo="whatsapp"` com `estado="vinculado"` e
  `chipflowId` → usa; senão `BRIDGE_INSTANCE_ID` da env; senão null.
- `registrarEnvio(canalId, r: BridgeResult, hojeBRT)` — `ok` → `ultimoEnvioEm=now`, `ultimoErro=null`,
  `enviadosHoje` (+1, zera se `diaContagem !== hoje`), `diaContagem=hoje`; falha → `ultimoErro`.
  Best-effort (try/catch, log).
- `hojeBRT(now)` puro em `bridge-request.ts` (reusa `localParts` de `lib/whatsapp/policy.ts`).

### 5. `lib/whatsapp/sender.ts`

- `Provider = "evolution" | "disparos" | "log" | "bridge"`.
- `resolveProvider`: `WHATSAPP_PROVIDER=bridge` explícito, ou inferido por
  `CHIPFLOW_BRIDGE_REDIS_URL`/`BRIDGE_REDIS_URL` quando nada mais estiver setado (ordem de
  inferência: evolution → bridge → disparos → log).
- `buildSendRequest("bridge", …)` → `null` (não é HTTP).
- `sendWhatsAppText(phone, text, env?, opts?: { agentKey?: string; idemKey?: string })`:
  - `bridge`: `resolverCanalEnvio(opts.agentKey ?? "aura")`; null → `{ ok:false, provider,
    error:"provider_misconfigured" }` + log; senão `sendTextViaBridge` → `SendResult` com
    `status` numérico ausente e `error` do bridge; `registrarEnvio` se veio do canal.
  - Demais providers: inalterados.
- `SendResult` ganha `commandId?: string`.

### 6. Chamadores (`lib/whatsapp/service.ts`)

- `reply()` recebe `agentKey?` e passa adiante; `handleInbound` passa `brain.mentor ?? "aura"`
  no ramo de resposta do mentor, `"aura"` nos ramos de sistema (código inválido, PARE/VOLTAR).
- `notifyInVoice` passa `mentor?.slug ?? "aura"`; `notifyWhatsApp` aceita `agentKey?` no input
  (default `"aura"`).
- Sem mudança de comportamento nos providers antigos.

### 7. Rota admin mínima — `app/api/admin/agents/[agentKey]/canal/route.ts`

- Gate idêntico ao de `/api/admin/agents` (`agentsAdmin()` → 404; `assertAdmin()`).
- `GET` → `{ canais: AgentChannel[] }` do agente (token mascarado: só os 4 últimos).
- `PUT { tipo="whatsapp", chipflowId:int>0, chipflowToken?, numero?, limiteDia?, ownerEmail?,
  pool?, tierReportado?, mensagensReportadas?, apiVersion? }` → upsert por `[agentKey, tipo]`,
  `estado="vinculado"`, `origem="chipflow"`, `tokenAtualizadoEm` quando token muda,
  `sincronizadoEm=now`. `agentKey` tem de existir no roster/profile (mesma checagem do PATCH).
  Validação: `chipflowId` inteiro positivo; `numero` via `toE164` (400 se inválido).
- `DELETE ?tipo=whatsapp` → `estado="nao_vinculado"`, `chipflowId=null`, `chipflowToken=null`
  (mantém o documento pra histórico).
- UI não entra (W5). O dono bind pelo `curl`/painel de rotas por enquanto.

### 8. Envs (`.env.example`, bloco WhatsApp)

```
WHATSAPP_PROVIDER="log"          # log | bridge | evolution | disparos
CHIPFLOW_BRIDGE_REDIS_URL=""     # 🔒 Redis dos streams wa:cmd/wa:evt do adapter da ChipFlow
BRIDGE_REDIS_URL=""              # alternativa (bridge próprio); nunca cai no REDIS_URL
NUM_SHARDS="1"                   # igual ao warmer e ao adapter
BRIDGE_INSTANCE_ID=""            # fallback: chipflowId único quando o agente não tem canal
BRIDGE_TIMEOUT_MS="30000"
```

### 9. Docs

- `docs/HANDOFF_AGENTE_MENSAGEIRO_V3.md` (salvo, com adendo).
- `docs/FONTES_BASE.md`: linha "Agente mensageiro · bridge Redis" → `zenith-warmer
  app/bridge/producer.py + whatsapp-adapter internal/bridge/contracts.go` (ADOTAR), e
  `axtral-store backend/core/bridge.py` (REFERÊNCIA: poll por chamada). Motivo dos números fica
  pro W3/W4.
- `docs/WHATSAPP_MENTOR.md`: parágrafo do provider `bridge`.

## Testes (vitest)

- `lib/chipflow/bridge-request.test.ts`: `shardOf` (n≤1 → "0"; 7%4 → "3"); nomes de stream;
  `buildCommand` com `commandId`/`requestedAt` injetados → `v` **byte a byte** igual ao
  `producer.py` (`{"command_id":"…","instance_id":42,"operation":"send_text","payload":{…},
  "requested_at":"…Z","idempotency_key":"…"}`), campo indexado `instance_id` = `"42"`;
  `sendTextPayload` (jid certo, `delay_ms`); `parseEvent` (sem `v`, JSON ruim, ok);
  `terminalToResult` (sent / failed com `error_detail` / timeout / ignored_duplicate → ok:false);
  `resolveBridgeRedisUrl` (prioridade e **não** cair em `REDIS_URL`); `numShards` inválido → 1;
  `idemKeyPadrao` determinística.
- `lib/chipflow/bridge.test.ts` (ioredis falso injetado): `last_id` lido **antes** do XADD;
  sent → ok; failed → ok:false com detalhe; evento de outro `command_id` ignorado e o certo
  depois casa; deadline → timeout; `xrevrange` lançando → `"0-0"` e segue; `xadd` lançando →
  status `error`.
- `lib/chipflow/canal.test.ts` (Prisma mockado): canal vinculado → fonte canal; sem canal e com
  `BRIDGE_INSTANCE_ID` → fonte env; nada → null; `registrarEnvio` zera contagem em dia novo.
- `lib/whatsapp/sender.test.ts`: `resolveProvider` bridge (explícito e inferido; `evolution`
  ganha); `buildSendRequest("bridge")` null; `sendWhatsAppText` bridge com `sendTextViaBridge` e
  `resolverCanalEnvio` mockados: misconfigured, ok, falha; testes antigos intactos.
- `app/api/admin/agents/[agentKey]/canal/route.test.ts` (molde `prancha-routes.test.ts`): 404 com
  flag off; 403 sem admin; PUT valida `chipflowId`; upsert vira `vinculado`; GET mascara token;
  DELETE desvincula.

## Fora deste PR

Cliente do `chip-directory`, botão `[conectar chip]`, `lib/chipflow/inbound.ts`, governança
(pausa, consumo somado, piso 60 s, janela), outbox, e-mail, remoção do provider `disparos`,
`send_presence`.

## Riscos e decisões

- **Redis do bridge é da ChipFlow** (🔒): sem a URL, o provider `bridge` é "não configurado" e o
  caminho `log` continua. Nenhum envio pro vazio.
- **Instância errada** (`chipflowId` de outro dono): o adapter executa do mesmo jeito — por isso o
  bind é admin-only e o W3 põe a governança. No W1 o dono é o único que vincula.
- **`ignored_duplicate`**: o adapter reemite o desfecho do original com o `command_id` do
  duplicado; tratamos como terminal.
- **Prisma Mongo**: sem migration; `db push` pelo dono.
