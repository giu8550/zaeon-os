import { describe, expect, it } from "vitest";
import { DUR_AMBIENTE, sintetizarAmbiente, type SalaAmbiente } from "./ambiente";
import { SINTESE, SONS } from "./audio";

describe("a música ambiente dos espaços de convivência", () => {
  const SR = 8000;
  for (const sala of ["biblioteca", "jardim"] as SalaAmbiente[]) it(`${sala}: loop sem emenda, determinística, com som e sem estourar`, () => {
    const a = sintetizarAmbiente(sala, SR);
    expect(a.length).toBe(SR * DUR_AMBIENTE);
    expect(sintetizarAmbiente(sala, SR)).toEqual(a);
    let pico = 0, rms = 0; for (const v of a) { pico = Math.max(pico, Math.abs(v)); rms += v * v; } rms = Math.sqrt(rms / a.length);
    expect(pico).toBeCloseTo(0.7, 5); expect(rms).toBeGreaterThan(0.05);
    // a emenda (fim → começo) não dá degrau maior que os saltos normais entre amostras
    let maxPasso = 0; for (let i = 1; i < a.length; i++) maxPasso = Math.max(maxPasso, Math.abs(a[i]! - a[i - 1]!));
    expect(Math.abs(a[0]! - a[a.length - 1]!)).toBeLessThanOrEqual(maxPasso + 1e-6);
    expect(SONS[`ambiente-${sala}`].loop).toBe(true); expect(SINTESE[`ambiente-${sala}`]).toBeTypeOf("function");
  });
});
