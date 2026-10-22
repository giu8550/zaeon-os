import { describe, expect, it } from "vitest";
import { sintetizarEstilhacos, sintetizarTempestade } from "./somTempestade";
import { SINTESE, SONS } from "./audio";

describe("o som da travessia do buraco negro", () => {
  it("a tempestade: loop sem emenda de 6 s, com som, sem estourar", () => {
    const SR = 8000, a = sintetizarTempestade(SR);
    expect(a.length).toBe(SR * 6); expect(sintetizarTempestade(SR)).toEqual(a);
    let pico = 0, maxPasso = 0; for (let i = 0; i < a.length; i++) { pico = Math.max(pico, Math.abs(a[i]!)); if (i) maxPasso = Math.max(maxPasso, Math.abs(a[i]! - a[i - 1]!)); }
    expect(pico).toBeGreaterThan(0.5); expect(pico).toBeLessThanOrEqual(0.63);
    expect(Math.abs(a[0]! - a[a.length - 1]!)).toBeLessThanOrEqual(maxPasso + 1e-6);
    expect(SONS["tempestade-cosmica"].loop).toBe(true); expect(SINTESE["tempestade-cosmica"]).toBe(sintetizarTempestade);
  });
  it("os estilhaços: um estouro (forte no começo, some no fim), sem estourar", () => {
    const SR = 22050, a = sintetizarEstilhacos(SR);
    let pico = 0; for (const v of a) pico = Math.max(pico, Math.abs(v));
    expect(pico).toBeLessThanOrEqual(0.91); expect(pico).toBeGreaterThan(0.5);
    const energia = (de: number, ate: number) => { let s = 0; for (let i = Math.floor(de * SR); i < Math.floor(ate * SR); i++) s += a[i]! * a[i]!; return s; };
    expect(energia(0, 0.3)).toBeGreaterThan(energia(1.8, 2.1) * 5);
    expect(Math.abs(a.at(-1)!)).toBeLessThan(0.01);
    expect(SONS.estilhacos.loop).toBe(false); expect(SINTESE.estilhacos).toBe(sintetizarEstilhacos);
  });
});
