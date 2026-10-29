import { describe, it, expect } from "vitest";
import { PARADAS, VOLTA_S } from "./percursoDroids";
import { PIRAMIDE, RASTA, SALAO, TORRE_TI } from "@/lib/cyber/temploCosmico";

const d2 = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe("o percurso dos droids no fundo do Sobre nós", () => {
  it("passa na ordem pedida: pirâmide → esquerda → centro → direita", () => {
    const ordem = PARADAS.map((p) => p.trecho).filter((t, i, a) => i === 0 || a[i - 1] !== t);
    expect(ordem).toEqual(["piramide", "esquerda", "centro", "direita"]);
  });
  it("dá a volta na pirâmide sem atravessar ela, e chega no lounge, na torre do meio e no Rasta", () => {
    const pir = PARADAS.filter((p) => p.trecho === "piramide");
    expect(pir.every((p) => d2(p, PIRAMIDE) > PIRAMIDE.meia * 1.8)).toBe(true);
    expect(PARADAS.some((p) => d2(p, { x: 0, z: 0 }) < 50)).toBe(true);                       // por cima do lounge
    expect(PARADAS.some((p) => p.trecho === "centro" && d2(p, TORRE_TI) < 70)).toBe(true);     // do lado da torre
    expect(PARADAS.filter((p) => p.trecho === "centro").every((p) => d2(p, TORRE_TI) > TORRE_TI.colR + 8)).toBe(true);
    expect(PARADAS.some((p) => p.trecho === "direita" && d2(p, RASTA) < RASTA.r)).toBe(true);  // por cima do Rasta
    expect(d2(PARADAS[0]!, SALAO)).toBeLessThan(SALAO.r);                                      // começa no salão
  });
  it("números finitos e uma volta lenta", () => {
    expect(PARADAS.every((p) => [p.x, p.y, p.z].every(Number.isFinite))).toBe(true);
    expect(VOLTA_S).toBeGreaterThan(60);
  });
});
