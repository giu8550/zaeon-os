import { describe, expect, it } from "vitest";
import { sintetizarPuxaFio, sintetizarZumbidoFio } from "./somFio";
import { SINTESE, SONS } from "./audio";

describe("o som dos FIOS DE ENERGIA", () => {
  for (const [nome, f, dur] of [["fio-zumbido", sintetizarZumbidoFio, 4], ["fio-puxa", sintetizarPuxaFio, 2]] as const) it(`${nome}: loop sem emenda, com som, sem estourar`, () => {
    const SR = 8000, a = f(SR);
    expect(a.length).toBe(SR * dur); expect(f(SR)).toEqual(a);
    let pico = 0, maxPasso = 0; for (let i = 0; i < a.length; i++) { pico = Math.max(pico, Math.abs(a[i]!)); if (i) maxPasso = Math.max(maxPasso, Math.abs(a[i]! - a[i - 1]!)); }
    expect(pico).toBeGreaterThan(0.5); expect(pico).toBeLessThanOrEqual(0.66);
    expect(Math.abs(a[0]! - a[a.length - 1]!)).toBeLessThanOrEqual(maxPasso + 1e-6);
    expect(SONS[nome].loop).toBe(true); expect(SINTESE[nome]).toBe(f);
  });
});
