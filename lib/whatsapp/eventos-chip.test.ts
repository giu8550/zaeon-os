import { describe, it, expect, vi } from "vitest";
import { GRUPO, lerEvento, tickEventos } from "./eventos-chip";

const ev = (v: object) => ({ v: JSON.stringify(v) });

describe("lerEvento (wa:evt do adapter)", () => {
  it("mensagem recebida", () => {
    expect(lerEvento(ev({ instance_id: 900001, kind: "message_inbound", result: { from: "5585999998888", text: " oi zaeon ", message_id: "M1", type: "text" } })))
      .toEqual({ inbound: { instanceId: 900001, de: "5585999998888", texto: "oi zaeon", messageId: "M1", tipo: "text" } });
  });
  it("mídia: usa a legenda; sem texto nem legenda, ignora", () => {
    expect(lerEvento(ev({ instance_id: 1, kind: "message_inbound", result: { from: "55", caption: "olha", type: "image", message_id: "x" } })).inbound?.texto).toBe("olha");
    expect(lerEvento(ev({ instance_id: 1, kind: "message_inbound", result: { from: "55", type: "audio" } }))).toEqual({});
  });
  it("estado de conexão; resultado de comando (sent) é ignorado", () => {
    expect(lerEvento(ev({ instance_id: 7, kind: "connection_state", result: { state: "open", jid: "55@s.whatsapp.net" } }))).toEqual({ estado: { instanceId: 7, estado: "open", jid: "55@s.whatsapp.net" } });
    expect(lerEvento(ev({ instance_id: 7, command_id: "c", status: "sent" }))).toEqual({});
    expect(lerEvento({ v: "{quebrado" })).toEqual({});
  });
});

describe("tickEventos", () => {
  const plano = (o: object) => ["v", JSON.stringify(o)];
  const fakeRedis = (entradas: [string, string[]][]) => ({
    xgroup: vi.fn(async () => { throw new Error("BUSYGROUP"); }),
    xreadgroup: vi.fn(async () => [["wa:evt:0", entradas]]),
    xack: vi.fn(async () => 1),
  });
  it("responde só mensagem de chip NOSSO, sem repetir; atualiza estado; ACK em tudo", async () => {
    const redis = fakeRedis([
      ["1-0", plano({ instance_id: 900001, kind: "message_inbound", result: { from: "5585999998888", text: "oi", message_id: "M1" } })],
      ["2-0", plano({ instance_id: 900001, kind: "message_inbound", result: { from: "5585999998888", text: "oi de novo", message_id: "M0-VISTO" } })],
      ["3-0", plano({ instance_id: 555, kind: "message_inbound", result: { from: "55", text: "chip alheio", message_id: "M2" } })],
      ["4-0", plano({ instance_id: 900001, kind: "connection_state", result: { state: "close", jid: "" } })],
      ["5-0", plano({ instance_id: 900001, command_id: "c", status: "sent" })],
    ]);
    const aoReceber = vi.fn(async () => undefined), aoMudarEstado = vi.fn(async () => undefined);
    const r = await tickEventos({
      redis: redis as any, shards: 1, consumidor: "t",
      ehNosso: async (id) => (id === 900001 ? { id: "chipA" } : null),
      jaVisto: async (m) => m === "M0-VISTO", aoReceber, aoMudarEstado,
    });
    expect(r).toEqual({ lidos: 5, respondidos: 1, estados: 1, ignorados: 3 });
    expect(aoReceber).toHaveBeenCalledWith(expect.objectContaining({ de: "5585999998888", texto: "oi", messageId: "M1" }), "chipA");
    expect(aoMudarEstado).toHaveBeenCalledWith({ instanceId: 900001, estado: "close", jid: "" });
    expect(redis.xack).toHaveBeenCalledTimes(5);
    expect(redis.xreadgroup).toHaveBeenCalledWith("GROUP", GRUPO, "t", "COUNT", 50, "STREAMS", "wa:evt:0", ">");
  });
  it("evento que explode não trava a fila (ACK mesmo assim)", async () => {
    const redis = fakeRedis([["1-0", plano({ instance_id: 900001, kind: "message_inbound", result: { from: "55", text: "x", message_id: "M" } })]]);
    await tickEventos({ redis: redis as any, shards: 1, ehNosso: async () => ({ id: "c" }), jaVisto: async () => false, aoReceber: async () => { throw new Error("boom"); } });
    expect(redis.xack).toHaveBeenCalledTimes(1);
  });
});
