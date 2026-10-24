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

import { revelarPorTempo } from "./typewriter";
describe("datilografia por tempo", () => {
  it("nada a revelar → 0; sempre ao menos 1 letra", () => { expect(revelarPorTempo(0, 0.016)).toBe(0); expect(revelarPorTempo(3, 0)).toBe(1); });
  it("um atraso grande se fecha em ~0,5 s, com qualquer fps", () => {
    for (const fps of [60, 30, 12]) {
      let resta = 3000, t = 0; const dt = 1 / fps;
      while (resta > 0 && t < 5) { resta -= revelarPorTempo(resta, dt); t += dt; }
      expect(t).toBeLessThan(2.2);   // (sem o teto por quadro: a 12 fps antes eram ~42 s)
    }
  });
  it("nunca revela mais do que falta", () => expect(revelarPorTempo(10, 5)).toBe(10));
});
