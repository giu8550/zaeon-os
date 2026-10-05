import { describe, expect, it } from "vitest";
import { CAM_FOLGA_CHAO, PITCH_MAX, PITCH_MIN, elevacaoDoOlhar, limitarPitch, poseDaCamera } from "./camera";

const olho = { x: 0, y: 2, z: 0 };
const pose = (pitch: number, chaoY = 0) => poseDaCamera({ olho: { ...olho, y: olho.y + chaoY }, az: 0.3, pitch, dist: 9, chaoY });

describe("câmera livre", () => {
  it("por cima: a câmera sobe e olha pro personagem (olhar pra baixo)", () => {
    const c = pose(0.8);
    expect(c.pos.y).toBeGreaterThan(olho.y);
    expect(elevacaoDoOlhar(c)).toBeLessThan(0);
  });
  it("arrastando pra baixo, a câmera encosta no chão e NÃO atravessa", () => {
    for (const p of [-0.2, -0.5, PITCH_MIN]) expect(pose(p).pos.y).toBeGreaterThanOrEqual(CAM_FOLGA_CHAO - 1e-9);
  });
  it("no limite, dá pra olhar pra CIMA (céu, Zaeon, buraco negro)", () => {
    expect(elevacaoDoOlhar(pose(PITCH_MIN))).toBeGreaterThan(0.9);
  });
  it("olhar sobe de forma contínua e monotônica ao arrastar pra baixo (sem pulo na transição)", () => {
    let ant = elevacaoDoOlhar(pose(PITCH_MAX));
    for (let p = PITCH_MAX; p >= PITCH_MIN; p -= 0.02) {
      const e = elevacaoDoOlhar(pose(p));
      expect(e).toBeGreaterThanOrEqual(ant - 1e-6);
      expect(e - ant).toBeLessThan(0.08);
      ant = e;
    }
  });
  it("na plataforma da Zaeon o 'chão' é o piso dela", () => {
    const c = pose(PITCH_MIN, 13);
    expect(c.pos.y).toBeGreaterThanOrEqual(13 + CAM_FOLGA_CHAO - 1e-9);
    expect(elevacaoDoOlhar(c)).toBeGreaterThan(0.9);
  });
  it("pitch fora da faixa é limitado", () => {
    expect(limitarPitch(-5)).toBe(PITCH_MIN);
    expect(limitarPitch(5)).toBe(PITCH_MAX);
  });
});
