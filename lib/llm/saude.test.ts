import { describe, it, expect, vi, beforeEach } from "vitest";
import { estadoGateway, provedorAtual, __resetSaudeParaTeste } from "./saude";

beforeEach(() => __resetSaudeParaTeste());

describe("estadoGateway", () => {
  it("off sem GATEWAY_URL (e não chama fetch)", async () => {
    const f = vi.fn();
    expect(await estadoGateway({ env: {}, fetchImpl: f as any })).toBe("off"); expect(f).not.toHaveBeenCalled();
  });
  it("on com liveliness 200; degraded com 500 ou fetch lançando", async () => {
    expect(await estadoGateway({ env: { GATEWAY_URL: "http://a" }, fetchImpl: (async () => new Response("ok", { status: 200 })) as any })).toBe("on");
    __resetSaudeParaTeste();
    expect(await estadoGateway({ env: { GATEWAY_URL: "http://b" }, fetchImpl: (async () => new Response("x", { status: 500 })) as any })).toBe("degraded");
    __resetSaudeParaTeste();
    expect(await estadoGateway({ env: { GATEWAY_URL: "http://c" }, fetchImpl: (async () => { throw new Error("ECONNREFUSED"); }) as any })).toBe("degraded");
  });
  it("cache de 60s por URL; expira", async () => {
    let t = 1_000_000; const f = vi.fn(async () => new Response("ok", { status: 200 }));
    const d = { env: { GATEWAY_URL: "http://litellm:4000" }, fetchImpl: f as any, agora: () => t };
    await estadoGateway(d); await estadoGateway(d);
    expect(f).toHaveBeenCalledTimes(1); expect((f.mock.calls[0] as any)[0]).toBe("http://litellm:4000/health/liveliness");
    t += 61_000; await estadoGateway(d); expect(f).toHaveBeenCalledTimes(2);
  });
  it("provedorAtual", () => { expect(provedorAtual("on")).toBe("litellm"); expect(provedorAtual("off")).toBe("vertex-direct"); expect(provedorAtual("degraded")).toBe("vertex-direct"); });
});
