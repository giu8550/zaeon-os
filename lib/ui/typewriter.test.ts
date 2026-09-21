import { describe, it, expect } from "vitest";
import { typeStep, safeCut, TYPE_MAX_PER_FRAME } from "./typewriter";

describe("typewriter", () => {
  it("nada a revelar → 0", () => expect(typeStep(0)).toBe(0));
  it("pouco texto → 1 letra por frame", () => expect(typeStep(5)).toBe(1));
  it("atraso grande respeita o teto (sem despejar bloco)", () => expect(typeStep(5000)).toBe(TYPE_MAX_PER_FRAME));
  it("não corta emoji ao meio", () => {
    const s = "a😀b"; // 'a' + par surrogate + 'b'
    expect(safeCut(s, 2)).toBe(3);
    expect(safeCut(s, 1)).toBe(1);
  });
});
