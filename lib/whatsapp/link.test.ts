import { describe, it, expect } from "vitest";
import { newVerifyCode, connectText, waMeUrl, parseInbound, CODE_RE } from "./link";

describe("whatsapp · link (código + parser de inbound)", () => {
  it("newVerifyCode: 6 chars sem ambíguos (0/O/1/I)", () => {
    for (let i = 0; i < 50; i++) {
      const c = newVerifyCode();
      expect(c).toMatch(CODE_RE);
      expect(c).not.toMatch(/[01OI]/);
    }
  });
  it("connectText + waMeUrl: monta o link wa.me com o texto pré-preenchido", () => {
    const url = waMeUrl("+5511999999999", connectText("ABC234"));
    expect(url).toBe("https://wa.me/5511999999999?text=CONECTAR-ABC234");
  });
  it("parseInbound: CONECTAR-<code> (case/espaço tolerante)", () => {
    expect(parseInbound("CONECTAR-ABC234")).toEqual({ kind: "connect", code: "ABC234" });
    expect(parseInbound("  conectar - abc234 ")).toEqual({ kind: "connect", code: "ABC234" });
    expect(parseInbound("Oi! CONECTAR-ABC234")).toEqual({ kind: "connect", code: "ABC234" });
  });
  it("parseInbound: PARE/STOP/SAIR desliga; VOLTAR/CONTINUAR religa", () => {
    expect(parseInbound("PARE")).toEqual({ kind: "stop" });
    expect(parseInbound("pare.")).toEqual({ kind: "stop" });
    expect(parseInbound("stop")).toEqual({ kind: "stop" });
    expect(parseInbound("sair")).toEqual({ kind: "stop" });
    expect(parseInbound("VOLTAR")).toEqual({ kind: "resume" });
    expect(parseInbound("continuar")).toEqual({ kind: "resume" });
  });
  it("parseInbound: o resto é chat (trim)", () => {
    expect(parseInbound("  me explica fotossíntese  ")).toEqual({ kind: "chat", text: "me explica fotossíntese" });
    expect(parseInbound("pare de me mandar isso hoje")).toEqual({ kind: "chat", text: "pare de me mandar isso hoje" });
  });
});
