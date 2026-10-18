import { describe, expect, it } from "vitest";
import { ATRASO_PERTO, LIMITE_PERTO, distPerto, seguirPerto } from "./camera";
describe("a câmera PERTO em movimento (corrida, voo, turbo)", () => {
  it("recua com a velocidade, mas nunca passa do limite — e o limite + o atraso ficam abaixo da câmera padrão (6 m)", () => {
    expect(distPerto(2.4, 0)).toBe(2.4); expect(distPerto(2.4, 0.5)).toBeGreaterThan(2.4);
    expect(distPerto(5, 3)).toBe(LIMITE_PERTO); expect(LIMITE_PERTO + ATRASO_PERTO).toBeLessThan(6);
  });
  it("no TURBO (50 m/s, a 20 fps ou a 60) o personagem nunca fica mais que o atraso à frente do ponto seguido", () => {
    for (const fps of [20, 60]) {
      let cam = { x: 0, y: 1.2, z: 0 }, pos = 0, pior = 0;
      for (let i = 0; i < fps * 3; i++) { pos += 50 / fps; cam = seguirPerto(cam, { x: pos, y: 1.2, z: 0 }, 1 / fps); pior = Math.max(pior, pos - cam.x); }
      expect(pior).toBeLessThanOrEqual(ATRASO_PERTO + 1e-9);
    }
  });
  it("subindo de mochila (vertical) também: a câmera acompanha", () => {
    let cam = { x: 0, y: 1.2, z: 0 }, y = 1.2;
    for (let i = 0; i < 60; i++) { y += 0.4; cam = seguirPerto(cam, { x: 0, y, z: 0 }, 1 / 60); }
    expect(y - cam.y).toBeLessThanOrEqual(ATRASO_PERTO + 1e-9);
  });
});
