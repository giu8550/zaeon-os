import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildSendRequest, resolveProvider, sendWhatsAppText } from "./sender";

const mb = vi.hoisted(() => ({ send: vi.fn(), resolver: vi.fn(), registrar: vi.fn() }));
vi.mock("@/lib/chipflow/bridge", async (o) => ({ ...(await o<any>()), sendTextViaBridge: mb.send }));
vi.mock("@/lib/chipflow/canal", () => ({ resolverCanalEnvio: mb.resolver, registrarEnvio: mb.registrar }));

describe("whatsapp · sender (provider-agnóstico)", () => {
  it("evolution: POST /message/sendText/{instance} com apikey", () => {
    const r = buildSendRequest("evolution", { EVOLUTION_URL: "https://evo.zaeon.space/", EVOLUTION_INSTANCE: "zaeon", EVOLUTION_API_KEY: "k1" }, "+5511999999999", "oi");
    expect(r?.url).toBe("https://evo.zaeon.space/message/sendText/zaeon");
    expect(r?.init.method).toBe("POST");
    expect((r?.init.headers as any).apikey).toBe("k1");
    expect(JSON.parse(String(r?.init.body))).toEqual({ number: "5511999999999", text: "oi" });
  });
  it("disparos (ChipFlow): POST {DISPAROS_URL}{DISPAROS_SEND_PATH} com Bearer", () => {
    const r = buildSendRequest("disparos", { DISPAROS_URL: "http://disparos:8080", DISPAROS_API_KEY: "s3", DISPAROS_SEND_PATH: "/api/messages/send" }, "+5511999999999", "oi");
    expect(r?.url).toBe("http://disparos:8080/api/messages/send");
    expect((r?.init.headers as any).Authorization).toBe("Bearer s3");
    expect(JSON.parse(String(r?.init.body))).toEqual({ phone: "+5511999999999", number: "5511999999999", text: "oi" });
  });
  it("disparos: sendPath default /api/send", () => {
    const r = buildSendRequest("disparos", { DISPAROS_URL: "http://d" }, "+5511999999999", "oi");
    expect(r?.url).toBe("http://d/api/send");
  });
  it("log: null (só loga); config faltando → null", () => {
    expect(buildSendRequest("log", {}, "+5511999999999", "oi")).toBeNull();
    expect(buildSendRequest("evolution", {}, "+5511999999999", "oi")).toBeNull();
  });
  it("resolveProvider: WHATSAPP_PROVIDER ou inferido pelas envs; default log", () => {
    expect(resolveProvider({ WHATSAPP_PROVIDER: "disparos" })).toBe("disparos");
    expect(resolveProvider({ EVOLUTION_URL: "x" })).toBe("evolution");
    expect(resolveProvider({ DISPAROS_URL: "x" })).toBe("disparos");
    expect(resolveProvider({})).toBe("log");
  });
});

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
