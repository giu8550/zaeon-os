import { describe, it, expect } from "vitest";
import { validarArea, validarEntrega, validarEmoji, validarWhatsapp, validarInstagram, validarFacebook, linkWhatsapp, temRedes } from "./vitrine";

describe("vitrine · campos do crachá (Modo CEO)", () => {
  it("área/emoji: limpa, apaga com vazio, recusa grande demais", () => {
    expect(validarArea("  Pesquisa ")).toBe("Pesquisa");
    expect(validarArea("")).toBeNull();
    expect(validarArea("x".repeat(41))).toBeUndefined();
    expect(validarEmoji("🧬")).toBe("🧬");
    expect(validarEmoji("abcdef")).toBeUndefined();
  });
  it("entrega: lista ou vírgulas, até 4 chips de até 28", () => {
    expect(validarEntrega("TCC, artigo , ABNT")).toEqual(["TCC", "artigo", "ABNT"]);
    expect(validarEntrega(["a", "b"])).toEqual(["a", "b"]);
    expect(validarEntrega("")).toEqual([]);
    expect(validarEntrega("a,b,c,d,e")).toBeUndefined();
    expect(validarEntrega(["x".repeat(29)])).toBeUndefined();
  });
  it("WhatsApp: qualquer formato → +DDI; BR sem DDI ganha +55; link wa.me vale", () => {
    expect(validarWhatsapp("(11) 99999-8888")).toBe("+5511999998888");
    expect(validarWhatsapp("+55 11 99999-8888")).toBe("+5511999998888");
    expect(validarWhatsapp("https://wa.me/5511999998888")).toBe("+5511999998888");
    expect(validarWhatsapp("123")).toBeUndefined();
    expect(validarWhatsapp("")).toBeNull();
    expect(linkWhatsapp("+5511999998888")).toBe("https://wa.me/5511999998888");
  });
  it("Instagram/Facebook: @handle, handle ou link → handle; lixo recusado", () => {
    expect(validarInstagram("@zaeon.app")).toBe("zaeon.app");
    expect(validarInstagram("https://www.instagram.com/zaeon.app/")).toBe("zaeon.app");
    expect(validarInstagram("com espaço")).toBeUndefined();
    expect(validarFacebook("https://facebook.com/zaeonapp/")).toBe("zaeonapp");
    expect(validarFacebook("zaeon-app")).toBe("zaeon-app");
    expect(validarFacebook("<script>")).toBeUndefined();
    expect(temRedes({ instagram: "x" })).toBe(true);
    expect(temRedes({})).toBe(false);
  });
});
