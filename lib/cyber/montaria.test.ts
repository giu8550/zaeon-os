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
    expect(caminhoDaSubida(0.3, de, lado, banco)).toEqual(lado);   // (aterrissou na altura da moto antes de começar a subir)
    const f = caminhoDaSubida(1, de, lado, banco); expect(f.x).toBeCloseTo(2.6); expect(f.y).toBeCloseTo(1.9);
  });
  it("o pé que passa por cima SOBE do lado de fora antes de cruzar a moto e chega na pedaleira", () => {
    // x = pra dentro da moto (0 = o lado de fora, 0.6 = o meio); y = a altura
    const chao = { x: 0, y: 0, z: 0 }, alto = { x: -0.1, y: 1.5, z: -0.2 }, atras = { x: 0.4, y: 1.5, z: -0.6 }, pedal = { x: 0.8, y: 0.4, z: 0 };
    expect(arcoDaPerna(0, chao, alto, atras, pedal)).toEqual(chao);
    expect(arcoDaPerna(1, chao, alto, atras, pedal)).toEqual(pedal);
    // enquanto ainda está baixo (abaixo de 0,9 m) o pé não entrou na moto (x pequeno)
    for (let i = 1; i < 50; i++) { const p = arcoDaPerna(i / 50, chao, alto, atras, pedal); if (p.y < 0.9 && i < 25) expect(p.x).toBeLessThan(0.2); }
    expect(arcoDaPerna(0.5, chao, alto, atras, pedal).y).toBeGreaterThan(1.1);
  });
  it("a moto só ergue depois que ele sentou", () => {
    expect(alturaDaMoto(0.5, 1, 2)).toBe(1);
    expect(alturaDaMoto(1, 1, 2)).toBe(2);
  });
});
