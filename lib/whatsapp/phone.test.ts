import { describe, it, expect } from "vitest";
import { toE164, phoneFromJid, jidNumber } from "./phone";

describe("whatsapp · phone", () => {
  it("toE164: normaliza formatos BR comuns pra +55…", () => {
    expect(toE164("+55 11 99999-9999")).toBe("+5511999999999");
    expect(toE164("5511999999999")).toBe("+5511999999999");
    expect(toE164("(11) 99999-9999")).toBe("+5511999999999");
    expect(toE164("11999999999")).toBe("+5511999999999");
  });
  it("toE164: mantém DDI de outros países quando vem com +", () => {
    expect(toE164("+351 912 345 678")).toBe("+351912345678");
  });
  it("toE164: rejeita lixo/curto demais", () => {
    expect(toE164("")).toBeNull();
    expect(toE164("abc")).toBeNull();
    expect(toE164("123")).toBeNull();
  });
  it("phoneFromJid: usuário → E.164; grupo/lid → null", () => {
    expect(phoneFromJid("5511999999999@s.whatsapp.net")).toBe("+5511999999999");
    expect(phoneFromJid("120363012345678901@g.us")).toBeNull();
    expect(phoneFromJid("")).toBeNull();
  });
  it("jidNumber: E.164 → dígitos (formato do Evolution)", () => {
    expect(jidNumber("+5511999999999")).toBe("5511999999999");
  });
});
