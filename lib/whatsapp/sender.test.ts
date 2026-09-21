import { describe, it, expect } from "vitest";
import { buildSendRequest, resolveProvider } from "./sender";

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
