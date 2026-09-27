import { describe, it, expect } from "vitest";
import { toWhatsAppText } from "./format";

describe("whatsapp · format (markdown → texto do Zap)", () => {
  it("**negrito** → *negrito*; headings viram linha; listas viram •", () => {
    const out = toWhatsAppText("## Conceitos\n\n**Cafeína** é um alcaloide.\n- item um\n* item dois");
    expect(out).toBe("*Conceitos*\n\n*Cafeína* é um alcaloide.\n• item um\n• item dois");
  });
  it("remove blocos de código e links markdown mantendo o texto", () => {
    const out = toWhatsAppText("Veja [o artigo](https://x.y/z) e `x = 1`.");
    expect(out).toBe("Veja o artigo (https://x.y/z) e x = 1.");
  });
  it("corta no limite com reticências", () => {
    const out = toWhatsAppText("a".repeat(100), 20);
    expect(out.length).toBe(20);
    expect(out.endsWith("…")).toBe(true);
  });
  it("vazio → mensagem padrão", () => {
    expect(toWhatsAppText("")).toBe("Sem resposta agora.");
  });
});
