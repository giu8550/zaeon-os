import { describe, expect, it } from "vitest";
import { alturaDaMoto, arcoDaPerna, caminhoDaSubida, pesosSubida } from "./montaria";

describe("subir na moto", () => {
  it("as fases vêm em ordem: pula → pega o guidão → passa a perna → senta → a moto ergue", () => {
    const p0 = pesosSubida(0), p1 = pesosSubida(1);
    expect(p0.pulo).toBe(0); expect(p0.maos).toBe(0); expect(p0.senta).toBe(0);
    expect(p1.pulo).toBe(1); expect(p1.maos).toBe(1); expect(p1.perna).toBe(1); expect(p1.senta).toBe(1); expect(p1.ergue).toBe(1);
    const m = pesosSubida(0.35); expect(m.pulo).toBe(1); expect(m.maos).toBeGreaterThan(0); expect(m.perna).toBe(0); expect(m.senta).toBe(0);
    expect(pesosSubida(0.6).ergue).toBe(0);
  });
  it("o caminho: começa onde ele estava, pula até o lado da moto (passando por cima) e termina no banco", () => {
    const de = { x: 0, y: 0, z: 0 }, lado = { x: 2, y: 1.1, z: 0 }, banco = { x: 2.6, y: 1.9, z: 0 };
    expect(caminhoDaSubida(0, de, lado, banco)).toEqual(de);
    const meio = caminhoDaSubida(0.13, de, lado, banco); expect(meio.y).toBeGreaterThan(1.1);   // (o arco do pulinho)
    expect(caminhoDaSubida(0.3, de, lado, banco)).toEqual(lado);
    const f = caminhoDaSubida(1, de, lado, banco); expect(f.x).toBeCloseTo(2.6); expect(f.y).toBeCloseTo(1.9);
  });
  it("o pé que passa por cima sobe acima dos dois pontos e chega na pedaleira", () => {
    const chao = { x: 0, y: 0, z: 0 }, atras = { x: 0.3, y: 1.6, z: -0.6 }, pedal = { x: 0.6, y: 0.4, z: 0 };
    expect(arcoDaPerna(0, chao, atras, pedal)).toEqual(chao);
    expect(arcoDaPerna(0.5, chao, atras, pedal).y).toBeGreaterThan(0.8);
    expect(arcoDaPerna(1, chao, atras, pedal)).toEqual(pedal);
  });
  it("a moto só ergue depois que ele sentou", () => {
    expect(alturaDaMoto(0.5, 1, 2)).toBe(1);
    expect(alturaDaMoto(1, 1, 2)).toBe(2);
  });
});
