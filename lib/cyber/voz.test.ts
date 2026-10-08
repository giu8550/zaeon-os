import { describe, expect, it } from "vitest";
import { educado, ehTeclaFalar } from "./voz";
import { DISTANCIA } from "./audio";

describe("voz (push-to-talk)", () => {
  it("negociação: exatamente UM dos dois é educado", () => {
    const a = "a".repeat(24), b = "b".repeat(24);
    expect(educado(a, b)).not.toBe(educado(b, a));
  });
  it("G fala; digitando, repetição ou com Ctrl/⌘ não", () => {
    expect(ehTeclaFalar({ key: "g" }, false)).toBe(true);
    expect(ehTeclaFalar({ key: "G" }, false)).toBe(true);
    expect(ehTeclaFalar({ key: "g" }, true)).toBe(false);
    expect(ehTeclaFalar({ key: "g", repeat: true }, false)).toBe(false);
    expect(ehTeclaFalar({ key: "g", metaKey: true }, false)).toBe(false);
    expect(ehTeclaFalar({ key: "h" }, false)).toBe(false);
    expect(ehTeclaFalar({ key: "V" }, false, "v")).toBe(true); expect(ehTeclaFalar({ key: "g" }, false, "v")).toBe(false);   // quem tem habilidade no G fala no V
  });
  it("voz por proximidade: some de verdade longe (modelo linear)", () => {
    expect(DISTANCIA.voz.modelo).toBe("linear");
    expect(DISTANCIA.voz.max).toBeGreaterThan(DISTANCIA.voz.ref);
  });
});
