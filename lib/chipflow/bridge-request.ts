/**
 * lib/chipflow/bridge-request.ts — montadores/parsers PUROS do bridge Redis do whatsapp-adapter
 * (wa:cmd:{shard} / wa:evt:{shard}). Sem rede — o IO fica em lib/chipflow/bridge.ts.
 *
 * Espelha byte a byte o `producer.py`/`shard.py` do zenith-warmer e o `contracts.go` do adapter
 * (ver docs/HANDOFF_AGENTE_MENSAGEIRO_V3.md, adendo): o adapter lê SÓ o campo `v` (JSON do
 * Command); os campos indexados existem por paridade (inspeção via redis-cli).
 */
import { randomUUID } from "crypto";
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

/**
 * Chave de idempotência padrão: POR COMANDO. O adapter dedupa a redelivery do mesmo comando
 * (Redis at-least-once) — e isso a chave por comando já cobre. Uma chave por conteúdo
 * (jid|texto) engoliria repetições legítimas (aluno que erra o código duas vezes ficaria sem
 * a 2ª resposta). Quem quer dedupe de nível aplicação (outbox do PR-W4) passa a sua.
 */
export function idemKeyPadrao(instanceId: number, commandId: string): string {
  return `zaeon:send_text:${instanceId}:${commandId}`;
}
