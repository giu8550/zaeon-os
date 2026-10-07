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
