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
