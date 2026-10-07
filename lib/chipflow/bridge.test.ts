import { describe, it, expect } from "vitest";
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
