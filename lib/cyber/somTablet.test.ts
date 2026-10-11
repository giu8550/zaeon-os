import { describe, it, expect } from "vitest";
import { sintetizarTablet } from "./somTablet";

describe("som do tablet", () => {
  it("curto, baixo e sem clique; abrir sobe, guardar desce", () => {
    for (const abre of [true, false]) {
      const a = sintetizarTablet(44100, abre);
      expect(a.length / 44100).toBeLessThan(0.6);
      let pico = 0; for (const v of a) pico = Math.max(pico, Math.abs(v));
      expect(pico).toBeLessThanOrEqual(0.33);
      expect(Math.abs(a[a.length - 1]!)).toBeLessThan(1e-3);
    }
  });
});
