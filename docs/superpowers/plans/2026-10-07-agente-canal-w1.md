# PR-W1 · AgentChannel + provider `bridge` — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um agente da Zaeon ganha um canal WhatsApp que referencia um chip da ChipFlow (`chipflowId`), e o `sender.ts` ganha o provider `bridge`, que publica `send_text` em `wa:cmd:{shard}` e espera o evento terminal em `wa:evt:{shard}`.

**Architecture:** Model Prisma `AgentChannel` (Mongo) guarda o vínculo agente→chip. `lib/chipflow/bridge-request.ts` é puro (envelope byte-compatível com o `producer.py` do warmer); `lib/chipflow/bridge.ts` faz o XADD/XREAD com ioredis numa conexão própria; `lib/chipflow/canal.ts` resolve qual `chipflowId` usar (canal ou env). O `sender.ts` só ganha um ramo novo; os providers antigos não mudam. Uma rota admin mínima vincula o chip pro gate.

**Tech Stack:** Next.js 14 (App Router, rotas `nodejs`), Prisma + MongoDB Atlas, ioredis 5, vitest, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-10-07-agente-canal-w1-design.md` (e o contrato em `docs/HANDOFF_AGENTE_MENSAGEIRO_V3.md`, adendo).

## Global Constraints

- Redis do bridge: `CHIPFLOW_BRIDGE_REDIS_URL` → `BRIDGE_REDIS_URL` → **null**. **Nunca** cair no `REDIS_URL`.
- Envelope do Command: campos `command_id`, `instance_id` (string decimal), `operation`, `idempotency_key`, `v` (JSON compacto de `{command_id, instance_id:int, operation, payload, requested_at, idempotency_key}`). `requested_at` RFC3339 com `Z`.
- `send_text` payload: `{ jid: "<dígitos>@s.whatsapp.net", text, delay_ms }`. Presença (não entra neste PR) usa a chave `presence`, nunca `state`.
- `shard = instanceId % NUM_SHARDS`; `NUM_SHARDS <= 1 → "0"`. Default `NUM_SHARDS=1`.
- Terminal: `sent | failed | timeout | ignored_duplicate`. Resultado de envio é objeto com `.ok` explícito — nunca truthiness.
- `providers evolution | disparos | log` intactos; `lib/whatsapp/sender.test.ts` existente continua passando sem edição nos casos antigos.
- Nenhum arquivo puro importa Prisma/ioredis no topo; IO fica em `bridge.ts` e `canal.ts`.
- Comentários e mensagens em português, no estilo dos arquivos vizinhos (cabeçalho `/** lib/x.ts — … */`).
- Commits terminam com `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Ao fim: `npx tsc --noEmit` = 0 erros; `npx vitest run lib/chipflow lib/whatsapp app/api/admin` verde.

## Review Focus

1. Telefone com máscara (`"+55 (11) 99999-9999"`) → `jid` tem só dígitos + `@s.whatsapp.net` (Task 2).
2. Evento com o `command_id` certo mas status **não terminal** (`accepted`/`running`) → continua esperando; só o terminal retorna (Task 3).
3. `BRIDGE_INSTANCE_ID` não numérico (`"abc"`, `"0"`, `"-3"`) → tratado como ausente, resultado `provider_misconfigured`, nenhum XADD (Task 4).
4. `REDIS_URL` setado e nenhuma URL de bridge → provider `bridge` explícito dá `provider_misconfigured`, e `resolveProvider` **não** infere `bridge` (Tasks 2 e 5).
5. `PUT` com `chipflowId` em string numérica (`"42"`) aceita; `"42abc"`, `0`, `-1`, `1.5` → 400 (Task 7).

---

## Estrutura de arquivos

| Arquivo | Papel |
|---|---|
| `prisma/schema.prisma` (modificar) | `model AgentChannel` |
| `.env.example` (modificar, bloco WhatsApp) | envs do bridge |
| `lib/chipflow/bridge-request.ts` (criar) | puro: shard, streams, envelope, parse de evento, URL, idemKey |
| `lib/chipflow/bridge-request.test.ts` (criar) | testes do puro |
| `lib/chipflow/bridge.ts` (criar) | IO ioredis: `sendTextViaBridge` |
| `lib/chipflow/bridge.test.ts` (criar) | ioredis falso injetado |
| `lib/chipflow/canal.ts` (criar) | resolver canal/env + registrar envio (Prisma dinâmico) |
| `lib/chipflow/canal.test.ts` (criar) | Prisma mockado |
| `lib/whatsapp/sender.ts` (modificar) | provider `bridge` |
| `lib/whatsapp/sender.test.ts` (modificar: acrescentar) | casos do bridge |
| `lib/whatsapp/service.ts` (modificar) | passar `agentKey` |
| `app/api/admin/agents/[agentKey]/canal/route.ts` (criar) | GET/PUT/DELETE do canal |
| `app/api/admin/agents/[agentKey]/canal/route.test.ts` (criar) | testes da rota |
| `docs/FONTES_BASE.md`, `docs/WHATSAPP_MENTOR.md` (modificar) | origem + runbook |

---

### Task 1: Model `AgentChannel` + envs

**Files:**
- Modify: `prisma/schema.prisma` (logo após `model AgentProfile`, ~linha 1045)
- Modify: `.env.example:131-137`

**Interfaces:**
- Produces: `prisma.agentChannel` com os campos abaixo (usado nas Tasks 4 e 7).

- [ ] **Step 1: Adicionar o model**

Depois do bloco `model AgentProfile { … @@map("agent_profiles") }` em `prisma/schema.prisma`, inserir:

```prisma
/// Canal de saída de um agente (WhatsApp hoje; e-mail no PR-W5). O chip é da ChipFlow:
/// `chipflowId` = WarmerInstance.id (define o shard do bridge). Referência externa, não chave.
/// Spec: docs/HANDOFF_AGENTE_MENSAGEIRO_V3.md §3 PR-W1.
model AgentChannel {
  id                  String    @id @default(auto()) @map("_id") @db.ObjectId
  agentKey            String                          // → AgentProfile.agentKey / roster
  tipo                String                          // "whatsapp" | "email"
  origem              String    @default("chipflow")  // "chipflow" | "proprio" | "log"
  chipflowId          Int?                            // WarmerInstance.id na ChipFlow
  chipflowToken       String?                         // 🔒 evo_token (não usado no bridge; guardado pro diretório/HTTP)
  tokenAtualizadoEm   DateTime?
  numero              String?                         // E.164 informativo — a ChipFlow é dona do número
  ownerEmail          String?
  pool                String?                         // "operator" | "owner"
  tierReportado       String?
  mensagensReportadas Int?
  apiVersion          String?
  proxyInfo           Json?
  estado              String    @default("nao_vinculado") // nao_vinculado | vinculado | pausado_na_origem | restrito | erro
  limiteDia           Int       @default(20)          // teto local (tier critical); governança real no PR-W3
  enviadosHoje        Int       @default(0)
  diaContagem         String?                         // YYYY-MM-DD (BRT) a que enviadosHoje se refere
  ultimoEnvioEm       DateTime?
  ultimoErro          String?
  sincronizadoEm      DateTime?
  email               String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@unique([agentKey, tipo])
  @@index([estado])
  @@index([chipflowId])
  @@map("agent_channels")
}
```

- [ ] **Step 2: Gerar o client e checar**

Run: `npx prisma generate 2>&1 | tail -2 && npx prisma validate`
Expected: `Generated Prisma Client` e `The schema … is valid`.

- [ ] **Step 3: Envs no `.env.example`**

Substituir a linha `# Sender de saída: "evolution" (instância única no Evolution API) | "disparos" (repo ChipFlow) | "log".` e `WHATSAPP_PROVIDER="log"` por:

```
# Sender de saída: "bridge" (chip da ChipFlow via Redis Streams wa:cmd/wa:evt) | "evolution"
# (instância única no Evolution API) | "disparos" (legado, ver handoff v3 §8) | "log".
WHATSAPP_PROVIDER="log"
# Bridge (handoff v3 §1.2). NUNCA cai no REDIS_URL — ele é o broker do BullMQ e não tem wa:evt.
CHIPFLOW_BRIDGE_REDIS_URL=""     # 🔒 Redis do adapter da ChipFlow (dono das sessões aquecidas)
BRIDGE_REDIS_URL=""              # alternativa: bridge próprio
NUM_SHARDS="1"                   # tem de bater com warmer e adapter
BRIDGE_INSTANCE_ID=""            # fallback: chipflowId único quando o agente não tem AgentChannel
BRIDGE_TIMEOUT_MS="30000"        # espera pelo evento terminal
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma .env.example
git commit -m "feat(agentes): model AgentChannel + envs do bridge (PR-W1)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `lib/chipflow/bridge-request.ts` (puro)

**Files:**
- Create: `lib/chipflow/bridge-request.ts`
- Test: `lib/chipflow/bridge-request.test.ts`

**Interfaces:**
- Consumes: `jidNumber` de `@/lib/whatsapp/phone`.
- Produces:
  - `shardOf(instanceId: number, n: number): string`
  - `numShards(env: Env): number`
  - `commandStream(instanceId, n): string` · `eventStream(instanceId, n): string`
  - `resolveBridgeRedisUrl(env: Env): string | null`
  - `buildCommand(input: { instanceId: number; operation: string; payload: Record<string, unknown>; idempotencyKey: string; commandId?: string; requestedAt?: string }): BridgeCommand`
  - `xaddFields(cmd: BridgeCommand): string[]`
  - `sendTextPayload(phone: string, text: string, delayMs = 1000): { jid: string; text: string; delay_ms: number }`
  - `fieldsToObject(flat: string[]): Record<string, string>`
  - `parseEvent(fields: Record<string, string>): BridgeEvent | null`
  - `isTerminal(status: unknown): boolean`
  - `terminalToResult(evt: BridgeEvent): { ok: boolean; status: string; error?: string }`
  - `idemKeyPadrao(instanceId: number, jid: string, text: string): string`
  - tipos `BridgeCommand`, `BridgeEvent`, `Env = Record<string, string | undefined>`

- [ ] **Step 1: Escrever os testes**

```ts
// lib/chipflow/bridge-request.test.ts
import { describe, it, expect } from "vitest";
import {
  buildCommand, commandStream, eventStream, fieldsToObject, idemKeyPadrao, isTerminal, numShards,
  parseEvent, resolveBridgeRedisUrl, sendTextPayload, shardOf, terminalToResult, xaddFields,
} from "./bridge-request";

describe("shard e streams (espelha shard.py / producer.py do warmer)", () => {
  it("n<=1 → '0'; senão id % n como label decimal", () => {
    expect(shardOf(42, 1)).toBe("0");
    expect(shardOf(42, 0)).toBe("0");
    expect(shardOf(7, 4)).toBe("3");
    expect(shardOf(8, 4)).toBe("0");
  });
  it("nomes dos streams", () => {
    expect(commandStream(7, 4)).toBe("wa:cmd:3");
    expect(eventStream(7, 4)).toBe("wa:evt:3");
    expect(commandStream(7, 1)).toBe("wa:cmd:0");
  });
  it("NUM_SHARDS inválido/ausente → 1", () => {
    expect(numShards({})).toBe(1);
    expect(numShards({ NUM_SHARDS: "potato" })).toBe(1);
    expect(numShards({ NUM_SHARDS: "0" })).toBe(1);
    expect(numShards({ NUM_SHARDS: "4" })).toBe(4);
  });
});

describe("resolveBridgeRedisUrl — nunca cai no REDIS_URL", () => {
  it("prioridade CHIPFLOW_BRIDGE_REDIS_URL > BRIDGE_REDIS_URL > null", () => {
    expect(resolveBridgeRedisUrl({ CHIPFLOW_BRIDGE_REDIS_URL: "redis://a", BRIDGE_REDIS_URL: "redis://b", REDIS_URL: "redis://c" })).toBe("redis://a");
    expect(resolveBridgeRedisUrl({ BRIDGE_REDIS_URL: "redis://b", REDIS_URL: "redis://c" })).toBe("redis://b");
    expect(resolveBridgeRedisUrl({ REDIS_URL: "redis://c" })).toBeNull();
    expect(resolveBridgeRedisUrl({ CHIPFLOW_BRIDGE_REDIS_URL: "  " })).toBeNull();
  });
});

describe("buildCommand / xaddFields — byte a byte com producer.py", () => {
  const cmd = buildCommand({
    instanceId: 42, operation: "send_text", payload: { jid: "5511999999999@s.whatsapp.net", text: "oi ✨", delay_ms: 1000 },
    idempotencyKey: "k1", commandId: "11111111-1111-4111-8111-111111111111", requestedAt: "2026-10-07T12:00:00.000Z",
  });
  it("envelope com as chaves na ordem do struct Command", () => {
    expect(Object.keys(cmd)).toEqual(["command_id", "instance_id", "operation", "payload", "requested_at", "idempotency_key"]);
    expect(cmd.instance_id).toBe(42);
  });
  it("campos do XADD: indexados + v compacto; instance_id string no indexado, número no v", () => {
    const f = xaddFields(cmd);
    expect(f).toEqual([
      "command_id", "11111111-1111-4111-8111-111111111111",
      "instance_id", "42",
      "operation", "send_text",
      "idempotency_key", "k1",
      "v", '{"command_id":"11111111-1111-4111-8111-111111111111","instance_id":42,"operation":"send_text","payload":{"jid":"5511999999999@s.whatsapp.net","text":"oi ✨","delay_ms":1000},"requested_at":"2026-10-07T12:00:00.000Z","idempotency_key":"k1"}',
    ]);
  });
  it("gera command_id uuid v4 e requested_at RFC3339 Z quando não injetados", () => {
    const c = buildCommand({ instanceId: 1, operation: "send_text", payload: {}, idempotencyKey: "k" });
    expect(c.command_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(c.requested_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe("sendTextPayload", () => {
  it("jid só com dígitos + @s.whatsapp.net; delay_ms default 1000", () => {
    expect(sendTextPayload("+55 (11) 99999-9999", "oi")).toEqual({ jid: "5511999999999@s.whatsapp.net", text: "oi", delay_ms: 1000 });
    expect(sendTextPayload("+5511999999999", "oi", 250).delay_ms).toBe(250);
  });
});

describe("parseEvent / isTerminal / terminalToResult", () => {
  const evt = (over: Record<string, unknown>) => ({
    event_id: "e1", command_id: "c1", instance_id: 42, status: "sent", latency_ms: 10,
    error_class: null, error_detail: null, emitted_at: "2026-10-07T12:00:01Z", ...over,
  });
  it("fieldsToObject + parseEvent lê só o v; sem v ou JSON ruim → null", () => {
    const flat = ["event_id", "e1", "command_id", "c1", "status", "sent", "v", JSON.stringify(evt({}))];
    expect(parseEvent(fieldsToObject(flat))?.command_id).toBe("c1");
    expect(parseEvent({ event_id: "e1" })).toBeNull();
    expect(parseEvent({ v: "{nope" })).toBeNull();
  });
  it("terminal: sent/failed/timeout/ignored_duplicate; accepted/running não", () => {
    expect(["sent", "failed", "timeout", "ignored_duplicate"].map(isTerminal)).toEqual([true, true, true, true]);
    expect(["accepted", "running", undefined, ""].map(isTerminal)).toEqual([false, false, false, false]);
  });
  it("sent → ok; failed → detalhe > classe; timeout; ignored_duplicate → ok:false", () => {
    expect(terminalToResult(evt({}) as any)).toEqual({ ok: true, status: "sent" });
    expect(terminalToResult(evt({ status: "failed", error_class: "wa_error", error_detail: "info query returned status 463: account_reachout_restricted" }) as any))
      .toEqual({ ok: false, status: "failed", error: "info query returned status 463: account_reachout_restricted" });
    expect(terminalToResult(evt({ status: "failed", error_class: "wa_error" }) as any)).toEqual({ ok: false, status: "failed", error: "wa_error" });
    expect(terminalToResult(evt({ status: "timeout" }) as any)).toEqual({ ok: false, status: "timeout", error: "timeout" });
    expect(terminalToResult(evt({ status: "ignored_duplicate" }) as any)).toEqual({ ok: false, status: "ignored_duplicate", error: "duplicado ignorado" });
  });
});

describe("idemKeyPadrao", () => {
  it("determinística pro mesmo destino+texto, diferente se muda o texto", () => {
    const a = idemKeyPadrao(42, "5511999999999@s.whatsapp.net", "oi");
    expect(a).toBe(idemKeyPadrao(42, "5511999999999@s.whatsapp.net", "oi"));
    expect(a).toMatch(/^zaeon:send_text:42:[0-9a-f]{16}$/);
    expect(a).not.toBe(idemKeyPadrao(42, "5511999999999@s.whatsapp.net", "oi!"));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/chipflow/bridge-request.test.ts`
Expected: FAIL — `Failed to resolve import "./bridge-request"`.

- [ ] **Step 3: Implementar**

```ts
// lib/chipflow/bridge-request.ts
/**
 * lib/chipflow/bridge-request.ts — montadores/parsers PUROS do bridge Redis do whatsapp-adapter
 * (wa:cmd:{shard} / wa:evt:{shard}). Sem rede — o IO fica em lib/chipflow/bridge.ts.
 *
 * Espelha byte a byte o `producer.py`/`shard.py` do zenith-warmer e o `contracts.go` do adapter
 * (ver docs/HANDOFF_AGENTE_MENSAGEIRO_V3.md, adendo): o adapter lê SÓ o campo `v` (JSON do
 * Command); os campos indexados existem por paridade (inspeção via redis-cli).
 */
import { createHash, randomUUID } from "crypto";
import { jidNumber } from "@/lib/whatsapp/phone";

export type Env = Record<string, string | undefined>;

export type BridgeCommand = {
  command_id: string;
  instance_id: number;
  operation: string;
  payload: Record<string, unknown>;
  requested_at: string;
  idempotency_key: string;
};

export type BridgeEvent = {
  event_id?: string;
  command_id?: string;
  instance_id?: number;
  status?: string;
  latency_ms?: number;
  error_class?: string | null;
  error_detail?: string | null;
  emitted_at?: string;
  kind?: string;
  result?: Record<string, unknown> | null;
};

const TERMINAL = new Set(["sent", "failed", "timeout", "ignored_duplicate"]);

/** shard = instance_id % n (label decimal); n<=1 → "0". Igual a bridge.ShardFor (Go). */
export function shardOf(instanceId: number, n: number): string {
  if (!Number.isFinite(n) || n <= 1) return "0";
  return String(((instanceId % n) + n) % n);
}

export function numShards(env: Env): number {
  const n = Number.parseInt(env.NUM_SHARDS ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export const commandStream = (instanceId: number, n: number) => `wa:cmd:${shardOf(instanceId, n)}`;
export const eventStream = (instanceId: number, n: number) => `wa:evt:${shardOf(instanceId, n)}`;

/**
 * Redis dos streams. CHIPFLOW_BRIDGE_REDIS_URL (adapter da ChipFlow, dono das sessões) →
 * BRIDGE_REDIS_URL (bridge próprio) → null. NUNCA o REDIS_URL: é o broker do BullMQ, não tem
 * wa:evt, e cair nele reproduz o bug silencioso do FlowShot (consumer lendo stream vazio).
 */
export function resolveBridgeRedisUrl(env: Env): string | null {
  const a = (env.CHIPFLOW_BRIDGE_REDIS_URL ?? "").trim();
  if (a) return a;
  const b = (env.BRIDGE_REDIS_URL ?? "").trim();
  return b || null;
}

export function buildCommand(input: {
  instanceId: number;
  operation: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  commandId?: string;
  requestedAt?: string;
}): BridgeCommand {
  // Ordem das chaves = struct Command (json tags) — deixa o `v` parecido com o json.Marshal do Go.
  return {
    command_id: input.commandId ?? randomUUID(),
    instance_id: input.instanceId,
    operation: input.operation,
    payload: { ...input.payload },
    requested_at: input.requestedAt ?? new Date().toISOString(),
    idempotency_key: input.idempotencyKey,
  };
}

/** Pares chave/valor do XADD: indexados + `v` (JSON compacto). instance_id vira string decimal. */
export function xaddFields(cmd: BridgeCommand): string[] {
  return [
    "command_id", cmd.command_id,
    "instance_id", String(cmd.instance_id),
    "operation", cmd.operation,
    "idempotency_key", cmd.idempotency_key,
    "v", JSON.stringify(cmd),
  ];
}

/** Payload do send_text: jid = dígitos@s.whatsapp.net (o adapter não aceita E.164 com "+"). */
export function sendTextPayload(phone: string, text: string, delayMs = 1000) {
  return { jid: `${jidNumber(phone)}@s.whatsapp.net`, text, delay_ms: delayMs };
}

/** [k1, v1, k2, v2, …] (forma do ioredis) → objeto. */
export function fieldsToObject(flat: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i + 1 < flat.length; i += 2) out[flat[i]] = flat[i + 1];
  return out;
}

/** Lê o Event do campo `v`. null sem `v` ou JSON inválido (o chamador ignora a entry). */
export function parseEvent(fields: Record<string, string>): BridgeEvent | null {
  const raw = fields.v;
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    return j && typeof j === "object" ? (j as BridgeEvent) : null;
  } catch {
    return null;
  }
}

export function isTerminal(status: unknown): boolean {
  return typeof status === "string" && TERMINAL.has(status);
}

export function terminalToResult(evt: BridgeEvent): { ok: boolean; status: string; error?: string } {
  const status = String(evt.status ?? "");
  if (status === "sent") return { ok: true, status };
  if (status === "ignored_duplicate") return { ok: false, status, error: "duplicado ignorado" };
  return { ok: false, status, error: evt.error_detail || evt.error_class || status || "bridge_error" };
}

/** Chave de idempotência determinística (o adapter dedupa a redelivery do MESMO comando). */
export function idemKeyPadrao(instanceId: number, jid: string, text: string): string {
  const h = createHash("sha1").update(`${jid}|${text}`).digest("hex").slice(0, 16);
  return `zaeon:send_text:${instanceId}:${h}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/chipflow/bridge-request.test.ts`
Expected: PASS (todos os `it`).

- [ ] **Step 5: Commit**

```bash
git add lib/chipflow/bridge-request.ts lib/chipflow/bridge-request.test.ts
git commit -m "feat(chipflow): montadores puros do bridge Redis (envelope byte-compatível com o warmer)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `lib/chipflow/bridge.ts` — publicar e esperar o terminal

**Files:**
- Create: `lib/chipflow/bridge.ts`
- Test: `lib/chipflow/bridge.test.ts`

**Interfaces:**
- Consumes: tudo da Task 2.
- Produces:
  - `type BridgeRedis = { xrevrange(...args: (string|number)[]): Promise<[string, string[]][]>; xadd(...args: (string|number)[]): Promise<string | null>; xread(...args: (string|number)[]): Promise<[string, [string, string[]][]][] | null> }`
  - `type BridgeResult = { ok: boolean; status: string; error?: string; commandId: string; event?: BridgeEvent }`
  - `sendTextViaBridge(input: { instanceId: number; phone: string; text: string; idemKey?: string; timeoutMs?: number; env?: Env; redis?: BridgeRedis }): Promise<BridgeResult>`
  - `bridgeConfigurado(env?: Env): boolean`

- [ ] **Step 1: Escrever os testes (ioredis falso)**

```ts
// lib/chipflow/bridge.test.ts
import { describe, it, expect, vi } from "vitest";
import { sendTextViaBridge, bridgeConfigurado, type BridgeRedis } from "./bridge";

const ENV = { CHIPFLOW_BRIDGE_REDIS_URL: "redis://fake", NUM_SHARDS: "1" };

/** Redis falso: registra chamadas; `eventos` é a fila que o xread devolve, uma entry por chamada. */
function fakeRedis(opts: { tail?: string | null; eventos?: (cmdId: string) => Array<[string, string[]]>; xrevrangeThrows?: boolean; xaddThrows?: boolean } = {}) {
  const calls: { xrevrange: any[][]; xadd: any[][]; xread: any[][] } = { xrevrange: [], xadd: [], xread: [] };
  let publicado: string | null = null;
  let fila: Array<[string, string[]]> | null = null;
  const r: BridgeRedis = {
    async xrevrange(...a) { calls.xrevrange.push(a); if (opts.xrevrangeThrows) throw new Error("boom"); return opts.tail === null ? [] : [[opts.tail ?? "1700-0", ["v", "{}"]]]; },
    async xadd(...a) {
      calls.xadd.push(a);
      if (opts.xaddThrows) throw new Error("xadd caiu");
      const i = a.indexOf("command_id"); publicado = String(a[i + 1]);
      fila = opts.eventos ? opts.eventos(publicado) : [];
      return "1700-1";
    },
    async xread(...a) {
      calls.xread.push(a);
      if (!fila || !fila.length) return null;
      const entry = fila.shift()!;
      return [["wa:evt:0", [entry]]];
    },
  };
  return { r, calls, get publicado() { return publicado; } };
}
const evt = (cmdId: string, over: Record<string, unknown> = {}) => ["v", JSON.stringify({ event_id: "e", command_id: cmdId, instance_id: 42, status: "sent", ...over })];

describe("bridgeConfigurado", () => {
  it("true só com URL de bridge; REDIS_URL sozinho não conta", () => {
    expect(bridgeConfigurado(ENV)).toBe(true);
    expect(bridgeConfigurado({ REDIS_URL: "redis://x" })).toBe(false);
  });
});

describe("sendTextViaBridge", () => {
  it("lê o last_id ANTES do XADD e publica no wa:cmd:0 com o payload send_text", async () => {
    const f = fakeRedis({ eventos: (id) => [["1700-2", evt(id)]] });
    const r = await sendTextViaBridge({ instanceId: 42, phone: "+5511999999999", text: "oi", env: ENV, redis: f.r, timeoutMs: 2000 });
    expect(r.ok).toBe(true);
    expect(r.status).toBe("sent");
    expect(f.calls.xrevrange[0].slice(0, 3)).toEqual(["wa:evt:0", "+", "-"]);
    expect(f.calls.xadd[0][0]).toBe("wa:cmd:0");
    expect(f.calls.xadd[0][1]).toBe("*");
    const v = JSON.parse(String(f.calls.xadd[0][f.calls.xadd[0].indexOf("v") + 1]));
    expect(v.payload).toEqual({ jid: "5511999999999@s.whatsapp.net", text: "oi", delay_ms: 1000 });
    expect(v.instance_id).toBe(42);
    // xread parte do last_id lido no xrevrange
    expect(f.calls.xread[0].slice(-2)).toEqual(["wa:evt:0", "1700-0"]);
    expect(r.commandId).toBe(f.publicado);
  });
  it("stream vazio → last_id '0-0'; xrevrange lançando também → '0-0' e segue", async () => {
    const a = fakeRedis({ tail: null, eventos: (id) => [["1-0", evt(id)]] });
    expect((await sendTextViaBridge({ instanceId: 1, phone: "+5511999999999", text: "x", env: ENV, redis: a.r })).ok).toBe(true);
    expect(a.calls.xread[0].slice(-1)[0]).toBe("0-0");
    const b = fakeRedis({ xrevrangeThrows: true, eventos: (id) => [["1-0", evt(id)]] });
    expect((await sendTextViaBridge({ instanceId: 1, phone: "+5511999999999", text: "x", env: ENV, redis: b.r })).ok).toBe(true);
  });
  it("failed → ok:false com error_detail", async () => {
    const f = fakeRedis({ eventos: (id) => [["1-0", evt(id, { status: "failed", error_class: "wa_error", error_detail: "server returned error 463" })]] });
    const r = await sendTextViaBridge({ instanceId: 42, phone: "+5511999999999", text: "oi", env: ENV, redis: f.r });
    expect(r).toMatchObject({ ok: false, status: "failed", error: "server returned error 463" });
  });
  it("ignora evento de OUTRO command_id e status não-terminal do nosso; casa o terminal depois", async () => {
    const f = fakeRedis({ eventos: (id) => [
      ["1-0", evt("outro")],
      ["1-1", evt(id, { status: "accepted" })],
      ["1-2", evt(id, { status: "running" })],
      ["1-3", evt(id)],
    ] });
    const r = await sendTextViaBridge({ instanceId: 42, phone: "+5511999999999", text: "oi", env: ENV, redis: f.r });
    expect(r.ok).toBe(true);
    expect(f.calls.xread.length).toBe(4);
    // avança o cursor a cada entry lida
    expect(f.calls.xread[3].slice(-1)[0]).toBe("1-2");
  });
  it("sem evento até o prazo → timeout (timeout curto não trava)", async () => {
    const f = fakeRedis({ eventos: () => [] });
    const t0 = Date.now();
    const r = await sendTextViaBridge({ instanceId: 42, phone: "+5511999999999", text: "oi", env: ENV, redis: f.r, timeoutMs: 50 });
    expect(r).toMatchObject({ ok: false, status: "timeout" });
    expect(Date.now() - t0).toBeLessThan(1500);
  });
  it("xadd lançando → status 'error', nunca exceção", async () => {
    const f = fakeRedis({ xaddThrows: true });
    const r = await sendTextViaBridge({ instanceId: 42, phone: "+5511999999999", text: "oi", env: ENV, redis: f.r });
    expect(r).toMatchObject({ ok: false, status: "error", error: "xadd caiu" });
  });
  it("sem URL de bridge e sem redis injetado → error 'bridge não configurado'", async () => {
    const r = await sendTextViaBridge({ instanceId: 42, phone: "+5511999999999", text: "oi", env: { REDIS_URL: "redis://x" } });
    expect(r).toMatchObject({ ok: false, status: "error", error: "bridge não configurado" });
  });
  it("idemKey do chamador vai no envelope; sem ela usa a padrão determinística", async () => {
    const f = fakeRedis({ eventos: (id) => [["1-0", evt(id)]] });
    await sendTextViaBridge({ instanceId: 42, phone: "+5511999999999", text: "oi", idemKey: "reply:c1:m1", env: ENV, redis: f.r });
    expect(f.calls.xadd[0][f.calls.xadd[0].indexOf("idempotency_key") + 1]).toBe("reply:c1:m1");
    const g = fakeRedis({ eventos: (id) => [["1-0", evt(id)]] });
    await sendTextViaBridge({ instanceId: 42, phone: "+5511999999999", text: "oi", env: ENV, redis: g.r });
    expect(g.calls.xadd[0][g.calls.xadd[0].indexOf("idempotency_key") + 1]).toMatch(/^zaeon:send_text:42:[0-9a-f]{16}$/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/chipflow/bridge.test.ts`
Expected: FAIL — `Failed to resolve import "./bridge"`.

- [ ] **Step 3: Implementar**

```ts
// lib/chipflow/bridge.ts
/**
 * lib/chipflow/bridge.ts — envio pelo bridge Redis do whatsapp-adapter (IO, server-only).
 *
 * Modelo POR-CHAMADA (igual ao bridge.py do FlowShot): registra o last_id de wa:evt:{shard}
 * ANTES do XADD em wa:cmd:{shard}, publica, e faz XREAD BLOCK a partir dali até o evento
 * terminal do MESMO command_id (sent/failed/timeout/ignored_duplicate). Eventos de outros
 * comandos e status intermediários (accepted/running) são ignorados.
 *
 * Conexão PRÓPRIA (não a do BullMQ): o Redis do bridge é o da ChipFlow. Nunca lança — devolve
 * { ok:false, status:"error"|"timeout" } e o chamador decide. Montadores puros em bridge-request.ts.
 */
import {
  buildCommand, commandStream, eventStream, fieldsToObject, idemKeyPadrao, isTerminal, numShards,
  parseEvent, resolveBridgeRedisUrl, sendTextPayload, terminalToResult, xaddFields,
  type BridgeEvent, type Env,
} from "./bridge-request";

export type BridgeRedis = {
  xrevrange(...args: (string | number)[]): Promise<[string, string[]][]>;
  xadd(...args: (string | number)[]): Promise<string | null>;
  xread(...args: (string | number)[]): Promise<[string, [string, string[]][]][] | null>;
};

export type BridgeResult = { ok: boolean; status: string; error?: string; commandId: string; event?: BridgeEvent };

const DEFAULT_TIMEOUT_MS = 30_000;

export function bridgeConfigurado(env: Env = process.env): boolean {
  return resolveBridgeRedisUrl(env) !== null;
}

const conexoes = new Map<string, BridgeRedis>();
async function redisPara(url: string): Promise<BridgeRedis> {
  const existente = conexoes.get(url);
  if (existente) return existente;
  const { default: IORedis } = await import("ioredis");
  const r = new IORedis(url, { maxRetriesPerRequest: 2, lazyConnect: true, enableOfflineQueue: false });
  r.on("error", (e: Error) => console.warn("[bridge] redis:", e.message));
  await r.connect();
  conexoes.set(url, r as unknown as BridgeRedis);
  return r as unknown as BridgeRedis;
}

function timeoutMsDe(env: Env, pedido?: number): number {
  if (pedido && pedido > 0) return pedido;
  const n = Number.parseInt(env.BRIDGE_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

export async function sendTextViaBridge(input: {
  instanceId: number;
  phone: string;
  text: string;
  idemKey?: string;
  timeoutMs?: number;
  env?: Env;
  redis?: BridgeRedis;
}): Promise<BridgeResult> {
  const env = input.env ?? process.env;
  const n = numShards(env);
  const payload = sendTextPayload(input.phone, input.text);
  const cmd = buildCommand({
    instanceId: input.instanceId,
    operation: "send_text",
    payload,
    idempotencyKey: input.idemKey || idemKeyPadrao(input.instanceId, payload.jid, input.text),
  });
  const commandId = cmd.command_id;
  const evtStream = eventStream(input.instanceId, n);
  const timeoutMs = timeoutMsDe(env, input.timeoutMs);

  try {
    let r = input.redis;
    if (!r) {
      const url = resolveBridgeRedisUrl(env);
      if (!url) return { ok: false, status: "error", error: "bridge não configurado", commandId };
      r = await redisPara(url);
    }

    // last_id ANTES de publicar — um evento que chegue rápido não se perde.
    let lastId = "0-0";
    try {
      const tail = await r.xrevrange(evtStream, "+", "-", "COUNT", 1);
      if (tail.length) lastId = tail[0][0];
    } catch { /* stream inexistente / redis instável → lê desde o início */ }

    await r.xadd(commandStream(input.instanceId, n), "*", ...xaddFields(cmd));

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const block = Math.min(500, Math.max(1, deadline - Date.now()));
      const resp = await r.xread("COUNT", 50, "BLOCK", block, "STREAMS", evtStream, lastId);
      if (!resp) continue;
      for (const [, entries] of resp) {
        for (const [entryId, flat] of entries) {
          lastId = entryId;
          const evt = parseEvent(fieldsToObject(flat));
          if (!evt || evt.command_id !== commandId || !isTerminal(evt.status)) continue;
          return { ...terminalToResult(evt), commandId, event: evt };
        }
      }
    }
    return { ok: false, status: "timeout", error: "sem evento terminal no prazo", commandId };
  } catch (e) {
    return { ok: false, status: "error", error: String((e as Error)?.message ?? e), commandId };
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/chipflow/bridge.test.ts`
Expected: PASS. Se o teste de timeout demorar >1,5 s, o `block` não está limitado pelo `deadline` — conferir `Math.min(500, …)`.

- [ ] **Step 5: Commit**

```bash
git add lib/chipflow/bridge.ts lib/chipflow/bridge.test.ts
git commit -m "feat(chipflow): sendTextViaBridge — XADD em wa:cmd e espera do terminal em wa:evt

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `lib/chipflow/canal.ts` — qual chip usar + registro do envio

**Files:**
- Create: `lib/chipflow/canal.ts`
- Test: `lib/chipflow/canal.test.ts`

**Interfaces:**
- Consumes: `prisma.agentChannel` (Task 1), `BridgeResult` (Task 3), `localParts` de `@/lib/whatsapp/policy`.
- Produces:
  - `type DestinoEnvio = { fonte: "canal"; canalId: string; chipflowId: number } | { fonte: "env"; chipflowId: number }`
  - `instanceIdDaEnv(env: Env): number | null` (puro)
  - `resolverCanalEnvio(agentKey: string, env?: Env): Promise<DestinoEnvio | null>`
  - `registrarEnvio(canalId: string, r: { ok: boolean; error?: string }, now?: Date): Promise<void>`

- [ ] **Step 1: Escrever os testes**

```ts
// lib/chipflow/canal.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn() }));
vi.mock("@/src/lib/prisma", () => ({ prisma: { agentChannel: { findUnique: m.findUnique, update: m.update } } }));

import { instanceIdDaEnv, registrarEnvio, resolverCanalEnvio } from "./canal";

beforeEach(() => { m.findUnique.mockReset(); m.update.mockReset(); m.update.mockResolvedValue({}); });

describe("instanceIdDaEnv", () => {
  it("inteiro positivo; lixo/zero/negativo/decimal → null", () => {
    expect(instanceIdDaEnv({ BRIDGE_INSTANCE_ID: "42" })).toBe(42);
    expect(instanceIdDaEnv({ BRIDGE_INSTANCE_ID: " 7 " })).toBe(7);
    for (const v of ["abc", "0", "-3", "1.5", "", undefined]) expect(instanceIdDaEnv({ BRIDGE_INSTANCE_ID: v })).toBeNull();
  });
});

describe("resolverCanalEnvio", () => {
  it("canal whatsapp vinculado com chipflowId → fonte canal", async () => {
    m.findUnique.mockResolvedValue({ id: "c1", estado: "vinculado", chipflowId: 42 });
    expect(await resolverCanalEnvio("medicina", {})).toEqual({ fonte: "canal", canalId: "c1", chipflowId: 42 });
    expect(m.findUnique).toHaveBeenCalledWith({ where: { agentKey_tipo: { agentKey: "medicina", tipo: "whatsapp" } } });
  });
  it("canal não vinculado / sem chipflowId → cai na env; sem env → null", async () => {
    m.findUnique.mockResolvedValue({ id: "c1", estado: "pausado_na_origem", chipflowId: 42 });
    expect(await resolverCanalEnvio("aura", { BRIDGE_INSTANCE_ID: "9" })).toEqual({ fonte: "env", chipflowId: 9 });
    m.findUnique.mockResolvedValue({ id: "c1", estado: "vinculado", chipflowId: null });
    expect(await resolverCanalEnvio("aura", {})).toBeNull();
    m.findUnique.mockResolvedValue(null);
    expect(await resolverCanalEnvio("aura", { BRIDGE_INSTANCE_ID: "abc" })).toBeNull();
  });
  it("Prisma lançando (coleção ainda sem db push) → usa a env, não derruba", async () => {
    m.findUnique.mockRejectedValue(new Error("no collection"));
    expect(await resolverCanalEnvio("aura", { BRIDGE_INSTANCE_ID: "9" })).toEqual({ fonte: "env", chipflowId: 9 });
  });
});

describe("registrarEnvio", () => {
  const now = new Date("2026-10-07T15:00:00-03:00");
  it("ok em dia novo → zera e conta 1, grava diaContagem e ultimoEnvioEm, limpa ultimoErro", async () => {
    m.findUnique.mockResolvedValue({ id: "c1", enviadosHoje: 17, diaContagem: "2026-10-06" });
    await registrarEnvio("c1", { ok: true }, now);
    expect(m.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { enviadosHoje: 1, diaContagem: "2026-10-07", ultimoEnvioEm: now, ultimoErro: null },
    });
  });
  it("ok no mesmo dia → incrementa", async () => {
    m.findUnique.mockResolvedValue({ id: "c1", enviadosHoje: 3, diaContagem: "2026-10-07" });
    await registrarEnvio("c1", { ok: true }, now);
    expect(m.update.mock.calls[0][0].data.enviadosHoje).toBe(4);
  });
  it("falha → só ultimoErro (truncado em 300), sem contar", async () => {
    m.findUnique.mockResolvedValue({ id: "c1", enviadosHoje: 3, diaContagem: "2026-10-07" });
    await registrarEnvio("c1", { ok: false, error: "x".repeat(400) }, now);
    expect(m.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { ultimoErro: "x".repeat(300) } });
  });
  it("Prisma lançando → engole (best-effort)", async () => {
    m.findUnique.mockRejectedValue(new Error("down"));
    await expect(registrarEnvio("c1", { ok: true }, now)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/chipflow/canal.test.ts`
Expected: FAIL — `Failed to resolve import "./canal"`.

- [ ] **Step 3: Implementar**

```ts
// lib/chipflow/canal.ts
/**
 * lib/chipflow/canal.ts — qual chip um agente usa pra mandar WhatsApp, e o registro do envio.
 *
 * Ordem: AgentChannel (tipo whatsapp, estado vinculado, com chipflowId) → BRIDGE_INSTANCE_ID da
 * env → null (= provider não configurado). Prisma entra por import dinâmico: o sender puro e
 * os testes não carregam o client. Falha de banco nunca derruba o envio (cai na env / engole).
 */
import { localParts } from "@/lib/whatsapp/policy";
import type { Env } from "./bridge-request";

export type DestinoEnvio =
  | { fonte: "canal"; canalId: string; chipflowId: number }
  | { fonte: "env"; chipflowId: number };

/** BRIDGE_INSTANCE_ID como inteiro positivo; qualquer outra coisa é "ausente". */
export function instanceIdDaEnv(env: Env): number | null {
  const raw = (env.BRIDGE_INSTANCE_ID ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

async function db() {
  const { prisma } = await import("@/src/lib/prisma");
  return prisma;
}

export async function resolverCanalEnvio(agentKey: string, env: Env = process.env): Promise<DestinoEnvio | null> {
  try {
    const prisma = await db();
    const canal = await prisma.agentChannel.findUnique({ where: { agentKey_tipo: { agentKey, tipo: "whatsapp" } } });
    if (canal?.estado === "vinculado" && typeof canal.chipflowId === "number" && canal.chipflowId > 0) {
      return { fonte: "canal", canalId: canal.id, chipflowId: canal.chipflowId };
    }
  } catch (e) {
    console.warn("[chipflow:canal] leitura falhou, usando env:", (e as Error)?.message ?? e);
  }
  const envId = instanceIdDaEnv(env);
  return envId ? { fonte: "env", chipflowId: envId } : null;
}

/** Contagem do dia (BRT) + último envio/erro no canal. Best-effort: nunca lança. */
export async function registrarEnvio(canalId: string, r: { ok: boolean; error?: string }, now: Date = new Date()): Promise<void> {
  try {
    const prisma = await db();
    if (!r.ok) {
      await prisma.agentChannel.update({ where: { id: canalId }, data: { ultimoErro: (r.error ?? "falha").slice(0, 300) } });
      return;
    }
    const atual = await prisma.agentChannel.findUnique({ where: { id: canalId } });
    const hoje = localParts(now).dateKey;
    const base = atual?.diaContagem === hoje ? atual.enviadosHoje ?? 0 : 0;
    await prisma.agentChannel.update({
      where: { id: canalId },
      data: { enviadosHoje: base + 1, diaContagem: hoje, ultimoEnvioEm: now, ultimoErro: null },
    });
  } catch (e) {
    console.warn("[chipflow:canal] registro falhou:", (e as Error)?.message ?? e);
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/chipflow/canal.test.ts`
Expected: PASS. Se o `findUnique` da falha reclamar de `where: { id }` vs `agentKey_tipo`, confira que o teste de falha mocka `findUnique` antes do `update`.

- [ ] **Step 5: Commit**

```bash
git add lib/chipflow/canal.ts lib/chipflow/canal.test.ts
git commit -m "feat(chipflow): resolver canal do agente (AgentChannel → BRIDGE_INSTANCE_ID) e registrar envio

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: provider `bridge` no `sender.ts`

**Files:**
- Modify: `lib/whatsapp/sender.ts`
- Modify: `lib/whatsapp/sender.test.ts` (acrescentar um `describe`)

**Interfaces:**
- Consumes: `sendTextViaBridge`, `bridgeConfigurado` (Task 3); `resolverCanalEnvio`, `registrarEnvio` (Task 4).
- Produces:
  - `type Provider = "evolution" | "disparos" | "log" | "bridge"`
  - `type SendOpts = { agentKey?: string; idemKey?: string }`
  - `type SendResult = { ok: boolean; provider: Provider; status?: number; error?: string; commandId?: string }`
  - `sendWhatsAppText(phone: string, text: string, env?: SenderEnv, opts?: SendOpts): Promise<SendResult>`

- [ ] **Step 1: Acrescentar os testes** (no fim de `lib/whatsapp/sender.test.ts`, mantendo os existentes)

```ts
import { vi } from "vitest";

const mb = vi.hoisted(() => ({ send: vi.fn(), resolver: vi.fn(), registrar: vi.fn() }));
vi.mock("@/lib/chipflow/bridge", async (o) => ({ ...(await o<any>()), sendTextViaBridge: mb.send }));
vi.mock("@/lib/chipflow/canal", () => ({ resolverCanalEnvio: mb.resolver, registrarEnvio: mb.registrar }));

describe("whatsapp · sender bridge (chip da ChipFlow)", () => {
  const BR = { WHATSAPP_PROVIDER: "bridge", CHIPFLOW_BRIDGE_REDIS_URL: "redis://cf" };
  beforeEach(() => { mb.send.mockReset(); mb.resolver.mockReset(); mb.registrar.mockReset(); mb.registrar.mockResolvedValue(undefined); });

  it("resolveProvider: explícito, ou inferido pela URL do bridge; evolution ganha; REDIS_URL não infere", () => {
    expect(resolveProvider({ WHATSAPP_PROVIDER: "bridge" })).toBe("bridge");
    expect(resolveProvider({ CHIPFLOW_BRIDGE_REDIS_URL: "redis://cf" })).toBe("bridge");
    expect(resolveProvider({ BRIDGE_REDIS_URL: "redis://b" })).toBe("bridge");
    expect(resolveProvider({ EVOLUTION_URL: "x", CHIPFLOW_BRIDGE_REDIS_URL: "redis://cf" })).toBe("evolution");
    expect(resolveProvider({ REDIS_URL: "redis://x" })).toBe("log");
  });
  it("buildSendRequest('bridge') é null — não é HTTP", () => {
    expect(buildSendRequest("bridge", BR, "+5511999999999", "oi")).toBeNull();
  });
  it("sem canal e sem BRIDGE_INSTANCE_ID → provider_misconfigured, nada publicado", async () => {
    mb.resolver.mockResolvedValue(null);
    const r = await sendWhatsAppText("+5511999999999", "oi", BR, { agentKey: "medicina" });
    expect(r).toEqual({ ok: false, provider: "bridge", error: "provider_misconfigured" });
    expect(mb.send).not.toHaveBeenCalled();
  });
  it("canal vinculado → publica com o chipflowId do canal, repassa idemKey, registra o envio", async () => {
    mb.resolver.mockResolvedValue({ fonte: "canal", canalId: "c1", chipflowId: 42 });
    mb.send.mockResolvedValue({ ok: true, status: "sent", commandId: "cmd-1" });
    const r = await sendWhatsAppText("+5511999999999", "oi", BR, { agentKey: "medicina", idemKey: "reply:c1:m1" });
    expect(r).toEqual({ ok: true, provider: "bridge", commandId: "cmd-1" });
    expect(mb.resolver).toHaveBeenCalledWith("medicina", BR);
    expect(mb.send).toHaveBeenCalledWith(expect.objectContaining({ instanceId: 42, phone: "+5511999999999", text: "oi", idemKey: "reply:c1:m1", env: BR }));
    expect(mb.registrar).toHaveBeenCalledWith("c1", expect.objectContaining({ ok: true }));
  });
  it("agentKey default 'aura'; fonte env não registra no canal; falha vira ok:false com o erro do bridge", async () => {
    mb.resolver.mockResolvedValue({ fonte: "env", chipflowId: 9 });
    mb.send.mockResolvedValue({ ok: false, status: "failed", error: "server returned error 463", commandId: "cmd-2" });
    const r = await sendWhatsAppText("+5511999999999", "oi", BR);
    expect(mb.resolver).toHaveBeenCalledWith("aura", BR);
    expect(r).toEqual({ ok: false, provider: "bridge", error: "server returned error 463", commandId: "cmd-2" });
    expect(mb.registrar).not.toHaveBeenCalled();
  });
});
```

Ajustar o `import` do topo do arquivo pra `import { describe, it, expect, beforeEach, vi } from "vitest";` e `import { buildSendRequest, resolveProvider, sendWhatsAppText } from "./sender";` (apagar o `import { vi }` solto do trecho acima).

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run lib/whatsapp/sender.test.ts`
Expected: FAIL nos casos novos (`resolveProvider` devolve `log` pra `bridge`; `sendWhatsAppText` não aceita `opts`). Os 5 casos antigos continuam PASS.

- [ ] **Step 3: Implementar**

Substituir o conteúdo de `lib/whatsapp/sender.ts` por:

```ts
/**
 * lib/whatsapp/sender.ts — transporte de SAÍDA, provider-agnóstico.
 *
 *   bridge    → chip da ChipFlow via Redis Streams (lib/chipflow/bridge.ts): AgentChannel do agente
 *               (ou BRIDGE_INSTANCE_ID) define a instância. Handoff v3 §1.2.
 *   evolution → instância única da plataforma no Evolution API (POST /message/sendText/{instance})
 *   disparos  → legado (repo de disparos); rota não confirmada — remoção prevista no PR-W2 (§8).
 *   log       → sem provider configurado: só loga (dev/CI). Nunca derruba a rota.
 *
 * `buildSendRequest` é puro (testável) pros providers HTTP; `sendWhatsAppText` faz o IO.
 * Resultado é objeto com `.ok` explícito — nunca truthiness.
 */
import { jidNumber } from "./phone";
import { resolveBridgeRedisUrl } from "@/lib/chipflow/bridge-request";

export type Provider = "evolution" | "disparos" | "log" | "bridge";
export type SenderEnv = Record<string, string | undefined>;
export type SendRequest = { url: string; init: RequestInit };
export type SendOpts = { agentKey?: string; idemKey?: string };

const trimSlash = (u: string) => u.replace(/\/+$/, "");

export function resolveProvider(env: SenderEnv = process.env): Provider {
  const p = (env.WHATSAPP_PROVIDER ?? "").toLowerCase();
  if (p === "evolution" || p === "disparos" || p === "log" || p === "bridge") return p;
  if (env.EVOLUTION_URL) return "evolution";
  if (resolveBridgeRedisUrl(env)) return "bridge";
  if (env.DISPAROS_URL) return "disparos";
  return "log";
}

export function buildSendRequest(provider: Provider, env: SenderEnv, phone: string, text: string): SendRequest | null {
  const number = jidNumber(phone);
  if (provider === "evolution") {
    if (!env.EVOLUTION_URL || !env.EVOLUTION_INSTANCE) return null;
    return {
      url: `${trimSlash(env.EVOLUTION_URL)}/message/sendText/${encodeURIComponent(env.EVOLUTION_INSTANCE)}`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: env.EVOLUTION_API_KEY ?? "" },
        body: JSON.stringify({ number, text }),
      },
    };
  }
  if (provider === "disparos") {
    if (!env.DISPAROS_URL) return null;
    const path = env.DISPAROS_SEND_PATH || "/api/send";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (env.DISPAROS_API_KEY) headers.Authorization = `Bearer ${env.DISPAROS_API_KEY}`;
    return {
      url: `${trimSlash(env.DISPAROS_URL)}${path.startsWith("/") ? path : `/${path}`}`,
      init: { method: "POST", headers, body: JSON.stringify({ phone, number, text }) },
    };
  }
  return null; // log e bridge não são HTTP
}

export type SendResult = { ok: boolean; provider: Provider; status?: number; error?: string; commandId?: string };

async function sendViaBridge(phone: string, text: string, env: SenderEnv, opts: SendOpts): Promise<SendResult> {
  const [{ resolverCanalEnvio, registrarEnvio }, { sendTextViaBridge }] = await Promise.all([
    import("@/lib/chipflow/canal"),
    import("@/lib/chipflow/bridge"),
  ]);
  const destino = await resolverCanalEnvio(opts.agentKey ?? "aura", env);
  if (!destino) {
    console.log(`[whatsapp:bridge] sem canal/BRIDGE_INSTANCE_ID pra ${opts.agentKey ?? "aura"} → ${phone}: ${text.slice(0, 200)}`);
    return { ok: false, provider: "bridge", error: "provider_misconfigured" };
  }
  const r = await sendTextViaBridge({ instanceId: destino.chipflowId, phone, text, idemKey: opts.idemKey, env });
  if (destino.fonte === "canal") await registrarEnvio(destino.canalId, r);
  return r.ok
    ? { ok: true, provider: "bridge", commandId: r.commandId }
    : { ok: false, provider: "bridge", error: r.error ?? r.status, commandId: r.commandId };
}

export async function sendWhatsAppText(phone: string, text: string, env: SenderEnv = process.env, opts: SendOpts = {}): Promise<SendResult> {
  const provider = resolveProvider(env);
  if (provider === "bridge") return sendViaBridge(phone, text, env, opts);

  const req = buildSendRequest(provider, env, phone, text);
  if (!req) {
    console.log(`[whatsapp:${provider}] → ${phone}: ${text.slice(0, 200)}`);
    return { ok: provider === "log", provider, error: provider === "log" ? undefined : "provider_misconfigured" };
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    const res = await fetch(req.url, { ...req.init, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { ok: false, provider, status: res.status, error: (await res.text().catch(() => "")).slice(0, 300) };
    return { ok: true, provider, status: res.status };
  } catch (e: any) {
    return { ok: false, provider, error: String(e?.message ?? e) };
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run lib/whatsapp/sender.test.ts`
Expected: PASS (5 antigos + 5 novos).

- [ ] **Step 5: Commit**

```bash
git add lib/whatsapp/sender.ts lib/whatsapp/sender.test.ts
git commit -m "feat(whatsapp): provider bridge no sender — chip do AgentChannel ou BRIDGE_INSTANCE_ID

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: `service.ts` passa o `agentKey`

**Files:**
- Modify: `lib/whatsapp/service.ts:104-110` (`reply`), `:121` (código inválido), `:135` (welcome), `:148,154,167,170` (stop/resume/plan/replied), `:174-193` (`NotifyInput`/`notifyWhatsApp`), `:196-208` (`notifyInVoice`)

**Interfaces:**
- Consumes: `SendOpts` da Task 5.
- Produces: `NotifyInput` ganha `agentKey?: string`.

- [ ] **Step 1: Editar `reply`**

```ts
async function reply(userId: string, phone: string, kind: string, text: string, agentKey = "aura"): Promise<boolean> {
  const r = await sendWhatsAppText(phone, text, process.env, { agentKey, idemKey: `reply:${userId}:${kind}:${Date.now()}` });
  await log(userId, "out", kind, text);
  await prisma.whatsAppLink.updateMany({ where: { userId }, data: { lastMsgAt: new Date() } });
  if (!r.ok) console.warn("[whatsapp] envio falhou:", r);
  return r.ok;
}
```

- [ ] **Step 2: Passar o mentor onde ele já é conhecido**

- Welcome (`:135`): `const sent = await reply(link.userId, msg.phone, "welcome", text, mentor?.slug ?? "aura");`
- Resposta do mentor (`:170`): `const sent = await reply(userId, msg.phone, "chat", out.text, out.mentor ?? "aura");`
- Os ramos `invalid_code`, `stop`, `resume`, `plan_required` ficam como estão (default `"aura"`).

- [ ] **Step 3: `notifyWhatsApp` / `notifyInVoice`**

```ts
export type NotifyInput = { userId: string; kind: string; text: string; dedupeKey?: string | null; ignoreQuiet?: boolean; now?: Date; agentKey?: string };
```
Na linha do envio em `notifyWhatsApp`:
```ts
  const r = await sendWhatsAppText(link.phone!, input.text, process.env, {
    agentKey: input.agentKey ?? "aura",
    idemKey: input.dedupeKey ? `notify:${input.userId}:${input.dedupeKey}` : undefined,
  });
```
No fim de `notifyInVoice`:
```ts
  return notifyWhatsApp({ userId, kind, text, dedupeKey, ignoreQuiet, agentKey: mentor?.slug ?? "aura" });
```

- [ ] **Step 4: Typecheck + testes do WhatsApp**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"; npx vitest run lib/whatsapp`
Expected: `0` e PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/whatsapp/service.ts
git commit -m "feat(whatsapp): service passa o agentKey (mentor) e idemKey pro sender

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: rota admin `/api/admin/agents/[agentKey]/canal`

**Files:**
- Create: `app/api/admin/agents/[agentKey]/canal/route.ts`
- Test: `app/api/admin/agents/[agentKey]/canal/route.test.ts`

**Interfaces:**
- Consumes: `prisma.agentChannel` (Task 1); `assertAdmin` (`@/lib/admin/assertAdmin`); `agentsAdmin` (`@/lib/canal/flags`); `rosterComMentores`, `isAgentKey` (`@/lib/agents/roster`); `toE164` (`@/lib/whatsapp/phone`).
- Produces: `GET` → `{ canais }`; `PUT` → `{ canal }`; `DELETE ?tipo=` → `{ ok: true }`. `parseChipflowId(v: unknown): number | null` exportado (puro).

- [ ] **Step 1: Escrever os testes**

```ts
// app/api/admin/agents/[agentKey]/canal/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  admin: { ok: true, email: "dono@zaeon" } as any, flag: true,
  findMany: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), mentores: vi.fn(), profile: vi.fn(),
}));
vi.mock("@/lib/admin/assertAdmin", () => ({ assertAdmin: async () => m.admin }));
vi.mock("@/lib/canal/flags", () => ({ agentsAdmin: () => m.flag }));
vi.mock("@/src/lib/prisma", () => ({ prisma: {
  agentChannel: { findMany: m.findMany, upsert: m.upsert, updateMany: m.updateMany },
  mentorTemplate: { findMany: m.mentores },
  agentProfile: { findUnique: m.profile },
} }));

import { GET, PUT, DELETE, parseChipflowId } from "@/app/api/admin/agents/[agentKey]/canal/route";

const P = (agentKey: string) => ({ params: { agentKey } });
const put = (agentKey: string, body: any) => PUT(new Request("http://x/", { method: "PUT", body: JSON.stringify(body) }), P(agentKey));

beforeEach(() => {
  m.admin = { ok: true, email: "dono@zaeon" }; m.flag = true;
  for (const f of [m.findMany, m.upsert, m.updateMany, m.mentores, m.profile]) f.mockReset();
  m.mentores.mockResolvedValue([]); m.profile.mockResolvedValue(null);
  m.upsert.mockImplementation(async ({ create }: any) => ({ id: "c1", ...create, chipflowToken: create.chipflowToken ?? null }));
  m.updateMany.mockResolvedValue({ count: 1 });
});

describe("parseChipflowId", () => {
  it("inteiro positivo (número ou string numérica); resto null", () => {
    expect(parseChipflowId(42)).toBe(42);
    expect(parseChipflowId("42")).toBe(42);
    for (const v of ["42abc", 0, -1, 1.5, "", null, undefined, {}]) expect(parseChipflowId(v)).toBeNull();
  });
});

describe("gate", () => {
  it("flag off → 404; sem admin → 401/403", async () => {
    m.flag = false; expect((await GET(new Request("http://x/"), P("aura"))).status).toBe(404);
    m.flag = true; m.admin = { ok: false, status: 403 }; expect((await GET(new Request("http://x/"), P("aura"))).status).toBe(403);
    m.admin = { ok: false, status: 401 }; expect((await put("aura", { chipflowId: 1 })).status).toBe(401);
  });
});

describe("PUT", () => {
  it("agente desconhecido → 404; chipflowId inválido → 400; numero inválido → 400", async () => {
    expect((await put("zz", { chipflowId: 1 })).status).toBe(404);
    expect((await put("aura", { chipflowId: "42abc" })).status).toBe(400);
    expect((await put("aura", { chipflowId: 42, numero: "abc" })).status).toBe(400);
    expect(m.upsert).not.toHaveBeenCalled();
  });
  it("upsert por [agentKey,tipo] vira vinculado/chipflow; token mascarado na resposta", async () => {
    const r = await put("aura", { chipflowId: "42", chipflowToken: "abcd-efgh-1234", numero: "11 99999-9999", limiteDia: 50, pool: "operator", tierReportado: "baby" });
    expect(r.status).toBe(200);
    const { canal } = await r.json();
    const arg = m.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ agentKey_tipo: { agentKey: "aura", tipo: "whatsapp" } });
    expect(arg.create).toMatchObject({ agentKey: "aura", tipo: "whatsapp", origem: "chipflow", chipflowId: 42, chipflowToken: "abcd-efgh-1234", numero: "+5511999999999", limiteDia: 50, pool: "operator", tierReportado: "baby", estado: "vinculado" });
    expect(arg.create.tokenAtualizadoEm).toBeInstanceOf(Date);
    expect(arg.update).toMatchObject({ chipflowId: 42, estado: "vinculado" });
    expect(canal.chipflowToken).toBe("••••1234");
  });
  it("mentor do banco é agente válido", async () => {
    m.mentores.mockResolvedValue([{ slug: "medicina", name: "Dra. Lia", course: "Medicina", emoji: "🩺", personaText: "x".repeat(50), order: 1 }]);
    expect((await put("medicina", { chipflowId: 7 })).status).toBe(200);
  });
});

describe("GET / DELETE", () => {
  it("GET lista os canais do agente com token mascarado", async () => {
    m.findMany.mockResolvedValue([{ id: "c1", agentKey: "aura", tipo: "whatsapp", chipflowToken: "zzzz9999", estado: "vinculado" }]);
    const { canais } = await (await GET(new Request("http://x/"), P("aura"))).json();
    expect(canais[0].chipflowToken).toBe("••••9999");
    expect(m.findMany).toHaveBeenCalledWith({ where: { agentKey: "aura" }, orderBy: { tipo: "asc" } });
  });
  it("DELETE desvincula (mantém o documento)", async () => {
    const r = await DELETE(new Request("http://x/?tipo=whatsapp"), P("aura"));
    expect(r.status).toBe(200);
    expect(m.updateMany).toHaveBeenCalledWith({
      where: { agentKey: "aura", tipo: "whatsapp" },
      data: { estado: "nao_vinculado", chipflowId: null, chipflowToken: null, tokenAtualizadoEm: null },
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run "app/api/admin/agents/[agentKey]/canal/route.test.ts"`
Expected: FAIL — módulo da rota não existe.

- [ ] **Step 3: Implementar**

```ts
// app/api/admin/agents/[agentKey]/canal/route.ts
/**
 * /api/admin/agents/[agentKey]/canal (founder-only, flag NEXT_PUBLIC_AGENTS_ADMIN) — o campo
 * "conectar chip" do PR-W1, sem UI: vincula um AgentChannel ao chip da ChipFlow pelo id.
 *   GET            → { canais } do agente (token mascarado).
 *   PUT  { tipo?="whatsapp", chipflowId, chipflowToken?, numero?, limiteDia?, ownerEmail?, pool?,
 *          tierReportado?, mensagensReportadas?, apiVersion? } → upsert, estado "vinculado".
 *   DELETE ?tipo=  → desvincula (estado nao_vinculado, mantém o documento).
 * O botão [conectar chip] com a lista do diretório é o PR-W2/W5.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { agentsAdmin } from "@/lib/canal/flags";
import { rosterComMentores, isAgentKey } from "@/lib/agents/roster";
import { toE164 } from "@/lib/whatsapp/phone";

type Ctx = { params: { agentKey: string } };
const TIPOS = new Set(["whatsapp", "email"]);

async function gate(): Promise<NextResponse | null> {
  if (!agentsAdmin()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const a = await assertAdmin();
  if (!a.ok) return NextResponse.json({ error: a.status === 401 ? "Unauthorized" : "Forbidden" }, { status: a.status });
  return null;
}

/** Inteiro positivo (número ou string só de dígitos). Qualquer outra coisa → null. */
export function parseChipflowId(v: unknown): number | null {
  if (typeof v === "number") return Number.isSafeInteger(v) && v > 0 ? v : null;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) { const n = Number(v.trim()); return n > 0 && Number.isSafeInteger(n) ? n : null; }
  return null;
}

const mascarar = <T extends { chipflowToken?: string | null }>(c: T): T => ({
  ...c, chipflowToken: c.chipflowToken ? `••••${c.chipflowToken.slice(-4)}` : null,
});

async function agenteExiste(agentKey: string): Promise<boolean> {
  if (await prisma.agentProfile.findUnique({ where: { agentKey } })) return true;
  const mentores = await prisma.mentorTemplate.findMany({ select: { slug: true, name: true, course: true, emoji: true, personaText: true, order: true } });
  return rosterComMentores(mentores).some((a) => a.agentKey === agentKey);
}

export async function GET(_req: Request, { params }: Ctx) {
  const g = await gate(); if (g) return g;
  const agentKey = String(params.agentKey || "").toLowerCase();
  if (!isAgentKey(agentKey)) return NextResponse.json({ error: "agentKey inválido" }, { status: 400 });
  const canais = await prisma.agentChannel.findMany({ where: { agentKey }, orderBy: { tipo: "asc" } });
  return NextResponse.json({ canais: canais.map(mascarar) });
}

export async function PUT(req: Request, { params }: Ctx) {
  const g = await gate(); if (g) return g;
  const agentKey = String(params.agentKey || "").toLowerCase();
  if (!isAgentKey(agentKey)) return NextResponse.json({ error: "agentKey inválido" }, { status: 400 });
  if (!(await agenteExiste(agentKey))) return NextResponse.json({ error: "Agente desconhecido — crie com POST /api/admin/agents." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const tipo = typeof b?.tipo === "string" && TIPOS.has(b.tipo) ? b.tipo : "whatsapp";
  const chipflowId = parseChipflowId(b?.chipflowId);
  if (!chipflowId) return NextResponse.json({ error: "chipflowId tem de ser inteiro positivo (o id do chip na ChipFlow)." }, { status: 400 });
  let numero: string | null = null;
  if (b?.numero !== undefined && b?.numero !== null && b?.numero !== "") {
    numero = toE164(String(b.numero));
    if (!numero) return NextResponse.json({ error: "numero inválido (use E.164, ex.: +5511999999999)." }, { status: 400 });
  }
  const str = (v: unknown, max = 120) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const token = str(b?.chipflowToken, 200);
  const now = new Date();
  const campos = {
    chipflowId,
    numero,
    ownerEmail: str(b?.ownerEmail),
    pool: str(b?.pool, 20),
    tierReportado: str(b?.tierReportado, 20),
    mensagensReportadas: Number.isFinite(b?.mensagensReportadas) ? Math.trunc(Number(b.mensagensReportadas)) : null,
    apiVersion: str(b?.apiVersion, 20),
    limiteDia: Number.isFinite(b?.limiteDia) && Number(b.limiteDia) > 0 ? Math.trunc(Number(b.limiteDia)) : undefined,
    estado: "vinculado",
    origem: "chipflow",
    sincronizadoEm: now,
    ...(token ? { chipflowToken: token, tokenAtualizadoEm: now } : {}),
  };
  const canal = await prisma.agentChannel.upsert({
    where: { agentKey_tipo: { agentKey, tipo } },
    update: campos,
    create: { agentKey, tipo, ...campos, limiteDia: campos.limiteDia ?? 20 },
  });
  return NextResponse.json({ canal: mascarar(canal) });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const g = await gate(); if (g) return g;
  const agentKey = String(params.agentKey || "").toLowerCase();
  if (!isAgentKey(agentKey)) return NextResponse.json({ error: "agentKey inválido" }, { status: 400 });
  const tipo = new URL(req.url).searchParams.get("tipo") || "whatsapp";
  if (!TIPOS.has(tipo)) return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  await prisma.agentChannel.updateMany({
    where: { agentKey, tipo },
    data: { estado: "nao_vinculado", chipflowId: null, chipflowToken: null, tokenAtualizadoEm: null },
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run "app/api/admin/agents/[agentKey]/canal/route.test.ts"`
Expected: PASS. Se o `create` do teste reclamar de `limiteDia: undefined`, é porque o spread pôs `limiteDia: undefined` antes do override — a ordem `{ agentKey, tipo, ...campos, limiteDia: campos.limiteDia ?? 20 }` resolve.

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/agents/[agentKey]/canal/route.ts" "app/api/admin/agents/[agentKey]/canal/route.test.ts"
git commit -m "feat(admin): rota /api/admin/agents/[agentKey]/canal — vincular chip da ChipFlow ao agente

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: docs + verificação final

**Files:**
- Modify: `docs/FONTES_BASE.md` (nova seção antes de `## Alertas de licença`)
- Modify: `docs/WHATSAPP_MENTOR.md:45-47` (tabela de envs) e `:14` (diagrama)

- [ ] **Step 1: `FONTES_BASE.md`** — inserir antes de `## Alertas de licença (ler antes de codar)`:

```markdown
## 11. Agente mensageiro — chip da ChipFlow via bridge Redis
| Repo | Licença | O que usamos | Status |
|---|---|---|---|
| `zenith-warmer` `app/bridge/{producer,shard}.py` + `whatsapp-adapter` `internal/bridge/contracts.go` | interno (Martinez) | envelope do Command/Event, `shard = id % NUM_SHARDS`, XADD com `v` JSON | ADOTAR (portado em `lib/chipflow/bridge-request.ts`) |
| `axtral-store` (FlowShot) `backend/core/bridge.py` | interno | modelo por-chamada: last_id ANTES do XADD + XREAD BLOCK até o terminal | REFERÊNCIA (`lib/chipflow/bridge.ts`) — **não** copiar o `payload.state` da presença (o adapter lê `presence`) nem o fallback pro `REDIS_URL` |
| `zenith-warmer` `app/api/routers/admin.py` (`chip-directory`) | interno | diretório read-only de chips elegíveis | DADOS (PR-W2) |

Os números de aquecimento (tiers, teto por maturidade, piso de 60 s, 463) entram nos PRs W3/W4 —
com o motivo registrado: custaram **73 chips em 25/08/2026** (`app/services/warm_speed.py`).
```

- [ ] **Step 2: `WHATSAPP_MENTOR.md`**

Linha 14: `Zaeon (Next) ──HTTP──► sender (Evolution | disparos/ChipFlow) ──► WhatsApp do aluno` →
`Zaeon (Next) ──► sender (bridge Redis da ChipFlow | Evolution | disparos legado) ──► WhatsApp do aluno`.

Na tabela de envs (linha 45), trocar a linha de `WHATSAPP_PROVIDER` por:
```markdown
| `WHATSAPP_PROVIDER` | `bridge` \| `evolution` \| `disparos` \| `log` (default: inferido de `EVOLUTION_URL` → URL do bridge → `DISPAROS_URL`, senão `log`). |
| `CHIPFLOW_BRIDGE_REDIS_URL` 🔒, `BRIDGE_REDIS_URL`, `NUM_SHARDS`, `BRIDGE_INSTANCE_ID`, `BRIDGE_TIMEOUT_MS` | provider `bridge`: chip da ChipFlow via Redis Streams (`wa:cmd`/`wa:evt`). O chip de cada agente vem do `AgentChannel` (`PUT /api/admin/agents/:key/canal`); `BRIDGE_INSTANCE_ID` é o fallback. Nunca cai no `REDIS_URL`. Ver `docs/HANDOFF_AGENTE_MENSAGEIRO_V3.md`. |
```

- [ ] **Step 3: Verificação completa**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx vitest run lib/chipflow lib/whatsapp app/api/admin 2>&1 | tail -6
```
Expected: `0`; `Test Files N passed`, `Tests N passed`, 0 failed.

- [ ] **Step 4: Commit**

```bash
git add docs/FONTES_BASE.md docs/WHATSAPP_MENTOR.md
git commit -m "docs(whatsapp): provider bridge no runbook + origem do bridge no FONTES_BASE

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 5: Lembrete pro dono (na mensagem final, não no código)**

Depois do merge: `npx prisma db push` no Atlas (coleção `agent_channels`); setar `WHATSAPP_PROVIDER=bridge`, `CHIPFLOW_BRIDGE_REDIS_URL` 🔒 e `NUM_SHARDS` iguais ao warmer; vincular um chip com
`curl -X PUT …/api/admin/agents/aura/canal -d '{"chipflowId":<id>}'` e mandar um "oi" de teste; confirmar que a ChipFlow em prod roda o `main` com o `chip-directory` (só importa no W2).
