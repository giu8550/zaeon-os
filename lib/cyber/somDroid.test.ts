import { describe, expect, it } from "vitest";
import { DUR_DROID, sintetizarMaquinaNoAr } from "./somDroid";
import { DISTANCIA, SINTESE, SONS } from "./audio";

describe("o som dos droids (maquinário se movendo pelo ar)", () => {
  const sr = 22050, x = sintetizarMaquinaNoAr(sr);
  it("um loop de DUR s, normalizado, sem silêncio", () => {
    expect(x.length).toBe(Math.round(sr * DUR_DROID));
    let m = 0, e = 0; for (const v of x) { m = Math.max(m, Math.abs(v)); e += v * v; }
    expect(m).toBeCloseTo(0.75, 5); expect(Math.sqrt(e / x.length)).toBeGreaterThan(0.08);
    expect(x.every(Number.isFinite)).toBe(true);
  });
  it("sem clique na emenda: o fim encosta no começo", () => {
    expect(Math.abs(x[x.length - 1]! - x[0]!)).toBeLessThan(0.12);
  });
  it("está registrado como loop posicional sintetizado, que some longe", () => {
    expect(SONS["droid-maquina"]).toMatchObject({ modo: "pos", loop: true, sintetico: true });
    expect(SINTESE["droid-maquina"]).toBe(sintetizarMaquinaNoAr);
    expect(DISTANCIA.droid.modelo).toBe("linear"); expect(DISTANCIA.droid.max).toBeLessThan(80);
  });
});
