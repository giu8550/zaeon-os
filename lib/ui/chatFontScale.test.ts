import { describe, it, expect } from "vitest";
import { normalizarEscala, passo, lerEscala, gravarEscala, fonteChat, CHAVE_ESCALA, PASSOS } from "./chatFontScale";

describe("zoom do texto do chat", () => {
  it("só aceita os passos discretos; lixo vira 100%", () => {
    expect(normalizarEscala("1.15")).toBe(1.15);
    expect(normalizarEscala(2)).toBe(1);
    expect(normalizarEscala(null)).toBe(1);
  });
  it("A−/A+ andam um passo e param nas pontas", () => {
    expect(passo(1, 1)).toBe(1.15);
    expect(passo(1, -1)).toBe(0.85);
    expect(passo(PASSOS[0], -1)).toBe(PASSOS[0]);
    expect(passo(PASSOS[PASSOS.length - 1], 1)).toBe(PASSOS[PASSOS.length - 1]);
  });
  it("persiste por aparelho e não derruba sem localStorage", () => {
    const dados: Record<string, string> = {};
    const a = { getItem: (k: string) => dados[k] ?? null, setItem: (k: string, v: string) => { dados[k] = v; } };
    gravarEscala(a, 1.3);
    expect(dados[CHAVE_ESCALA]).toBe("1.3");
    expect(lerEscala(a)).toBe(1.3);
    const quebrado = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(lerEscala(quebrado)).toBe(1);
    expect(() => gravarEscala(quebrado, 1.15)).not.toThrow();
  });
  it("o corpo nunca fica abaixo de 14px", () => {
    expect(fonteChat(16)).toBe("max(14px, calc(16px * var(--chat-font-scale, 1)))");
  });
});
