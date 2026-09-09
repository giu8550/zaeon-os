import { describe, it, expect } from "vitest";
import { normalizeInbound } from "./inbound";

describe("whatsapp · inbound (normaliza payloads)", () => {
  it("Evolution messages.upsert → { phone, text, messageId }", () => {
    const p = {
      event: "messages.upsert", instance: "zaeon",
      data: { key: { remoteJid: "5511999999999@s.whatsapp.net", fromMe: false, id: "ABC1" }, message: { conversation: "CONECTAR-ABC234" } },
    };
    expect(normalizeInbound(p)).toEqual({ phone: "+5511999999999", text: "CONECTAR-ABC234", messageId: "ABC1" });
  });
  it("Evolution extendedTextMessage e ignora fromMe / grupos / outros eventos", () => {
    const ext = { event: "messages.upsert", data: { key: { remoteJid: "5511999999999@s.whatsapp.net", id: "X" }, message: { extendedTextMessage: { text: "oi" } } } };
    expect(normalizeInbound(ext)?.text).toBe("oi");
    expect(normalizeInbound({ event: "messages.upsert", data: { key: { remoteJid: "5511999999999@s.whatsapp.net", fromMe: true }, message: { conversation: "x" } } })).toBeNull();
    expect(normalizeInbound({ event: "messages.upsert", data: { key: { remoteJid: "1203630@g.us" }, message: { conversation: "x" } } })).toBeNull();
    expect(normalizeInbound({ event: "connection.update", data: {} })).toBeNull();
  });
  it("formato genérico (bridge/disparos): phone|from|number + text|message|body", () => {
    expect(normalizeInbound({ phone: "+55 11 99999-9999", text: "oi", messageId: "m1" })).toEqual({ phone: "+5511999999999", text: "oi", messageId: "m1" });
    expect(normalizeInbound({ from: "5511999999999@s.whatsapp.net", body: "PARE", id: "m2" })).toEqual({ phone: "+5511999999999", text: "PARE", messageId: "m2" });
    expect(normalizeInbound({ number: "11999999999", message: "VOLTAR" })).toEqual({ phone: "+5511999999999", text: "VOLTAR", messageId: undefined });
  });
  it("sem texto ou sem telefone → null", () => {
    expect(normalizeInbound({ phone: "+5511999999999" })).toBeNull();
    expect(normalizeInbound({ text: "oi" })).toBeNull();
    expect(normalizeInbound(null)).toBeNull();
  });
});
