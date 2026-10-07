import { describe, it, expect, vi } from "vitest";

// ioredis falso só pro caminho de conexão real (redisPara): conta construções/desconexões.
const io = vi.hoisted(() => ({ ctor: 0, disconnects: 0, connectFails: 0 }));
vi.mock("ioredis", () => ({
  default: class FakeIORedis {
    constructor(public url: string, public opts: unknown) { io.ctor++; }
    on() { return this; }
    async connect() { if (io.connectFails > 0) { io.connectFails--; throw new Error("ECONNREFUSED"); } }
    disconnect() { io.disconnects++; }
    duplicate() { return this; }
    async xrevrange() { return []; }
    async xadd() { return "1-0"; }
    async xread() { return null; }
  },
}));

import { sendTextViaBridge, bridgeConfigurado, type BridgeRedis } from "./bridge";

const ENV = { CHIPFLOW_BRIDGE_REDIS_URL: "redis://fake", NUM_SHARDS: "1" };

type Calls = { xrevrange: any[][]; xadd: any[][]; xread: any[][]; disconnect: number };
/** Redis falso: registra chamadas; `eventos` é a fila que o xread devolve, uma entry por chamada.
 *  `comDuplicate` → `duplicate()` devolve uma 2ª conexão (própria pro XREAD BLOCK) com `disconnect`. */
function fakeRedis(opts: { tail?: string | null; eventos?: (cmdId: string) => Array<[string, string[]]>; xrevrangeThrows?: boolean; xaddThrows?: boolean; comDuplicate?: boolean } = {}) {
  const calls: Calls = { xrevrange: [], xadd: [], xread: [], disconnect: 0 };
  const dup: Calls = { xrevrange: [], xadd: [], xread: [], disconnect: 0 };
  let publicado: string | null = null;
  let fila: Array<[string, string[]]> | null = null;
  const xreadDe = (c: Calls) => async (...a: (string | number)[]) => {
    c.xread.push(a);
    if (!fila || !fila.length) return null;
    const entry = fila.shift()!;
    return [["wa:evt:0", [entry]]] as [string, [string, string[]][]][];
  };
  const r: BridgeRedis = {
    async xrevrange(...a) { calls.xrevrange.push(a); if (opts.xrevrangeThrows) throw new Error("boom"); return opts.tail === null ? [] : [[opts.tail ?? "1700-0", ["v", "{}"]]]; },
    async xadd(...a) {
      calls.xadd.push(a);
      if (opts.xaddThrows) throw new Error("xadd caiu");
      const i = a.indexOf("command_id"); publicado = String(a[i + 1]);
      fila = opts.eventos ? opts.eventos(publicado) : [];
      return "1700-1";
    },
    xread: xreadDe(calls),
  };
  if (opts.comDuplicate) {
    r.duplicate = () => ({ ...r, xread: xreadDe(dup), disconnect: () => { dup.disconnect++; } });
  }
  return { r, calls, dup, get publicado() { return publicado; } };
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
  it("idemKey do chamador vai no envelope; sem ela usa uma por comando (repetição legítima não é engolida)", async () => {
    const f = fakeRedis({ eventos: (id) => [["1-0", evt(id)]] });
    await sendTextViaBridge({ instanceId: 42, phone: "+5511999999999", text: "oi", idemKey: "reply:c1:m1", env: ENV, redis: f.r });
    expect(f.calls.xadd[0][f.calls.xadd[0].indexOf("idempotency_key") + 1]).toBe("reply:c1:m1");
    const g = fakeRedis({ eventos: (id) => [["1-0", evt(id)]] });
    await sendTextViaBridge({ instanceId: 42, phone: "+5511999999999", text: "oi", env: ENV, redis: g.r });
    expect(g.calls.xadd[0][g.calls.xadd[0].indexOf("idempotency_key") + 1]).toBe(`zaeon:send_text:42:${g.publicado}`);
    const h = fakeRedis({ eventos: (id) => [["1-0", evt(id)]] });
    await sendTextViaBridge({ instanceId: 42, phone: "+5511999999999", text: "oi", env: ENV, redis: h.r });
    expect(h.calls.xadd[0][h.calls.xadd[0].indexOf("idempotency_key") + 1]).not.toBe(g.calls.xadd[0][g.calls.xadd[0].indexOf("idempotency_key") + 1]);
  });
  it("XREAD BLOCK roda numa conexão duplicada (não trava a compartilhada) e a fecha no fim", async () => {
    const f = fakeRedis({ comDuplicate: true, eventos: (id) => [["1-0", evt("outro")], ["1-1", evt(id)]] });
    const r = await sendTextViaBridge({ instanceId: 42, phone: "+5511999999999", text: "oi", env: ENV, redis: f.r });
    expect(r.ok).toBe(true);
    expect(f.calls.xread.length).toBe(0);
    expect(f.dup.xread.length).toBe(2);
    expect(f.dup.disconnect).toBe(1);
    // XADD e XREVRANGE continuam na conexão compartilhada
    expect(f.calls.xadd.length).toBe(1);
    expect(f.calls.xrevrange.length).toBe(1);
  });
  it("timeout também fecha a conexão duplicada", async () => {
    const f = fakeRedis({ comDuplicate: true, eventos: () => [] });
    await sendTextViaBridge({ instanceId: 42, phone: "+5511999999999", text: "oi", env: ENV, redis: f.r, timeoutMs: 30 });
    expect(f.dup.disconnect).toBe(1);
  });
});

describe("conexão real (redisPara) — ciclo de vida", () => {
  it("connect falhando → desconecta o cliente (sem zumbi reconectando) e devolve error; a próxima chamada tenta de novo", async () => {
    const env = { CHIPFLOW_BRIDGE_REDIS_URL: "redis://cai-na-primeira", NUM_SHARDS: "1" };
    io.connectFails = 1;
    const antes = { ctor: io.ctor, disc: io.disconnects };
    const r1 = await sendTextViaBridge({ instanceId: 7, phone: "+5511999999999", text: "oi", env, timeoutMs: 20 });
    expect(r1).toMatchObject({ ok: false, status: "error", error: "ECONNREFUSED" });
    expect(io.disconnects).toBe(antes.disc + 1);
    const r2 = await sendTextViaBridge({ instanceId: 7, phone: "+5511999999999", text: "oi", env, timeoutMs: 20 });
    expect(r2.status).toBe("timeout"); // conectou desta vez (o fake não devolve eventos)
    expect(io.ctor).toBe(antes.ctor + 2);
  });
  it("duas chamadas simultâneas na 1ª conexão compartilham UM cliente", async () => {
    const env = { CHIPFLOW_BRIDGE_REDIS_URL: "redis://concorrente", NUM_SHARDS: "1" };
    const antes = io.ctor;
    await Promise.all([
      sendTextViaBridge({ instanceId: 1, phone: "+5511999999999", text: "a", env, timeoutMs: 20 }),
      sendTextViaBridge({ instanceId: 2, phone: "+5511999999999", text: "b", env, timeoutMs: 20 }),
    ]);
    expect(io.ctor).toBe(antes + 1);
  });
});
