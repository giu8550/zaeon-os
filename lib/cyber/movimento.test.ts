import { describe, expect, it } from "vitest";
import { DASH, DISTANCIA_DASH, SPRINT, emSprint, iniciarDash, intocavel, passoDash, podeDash, sensacaoAPe, velocidadeAPe } from "./movimento";

describe("movimento turbinado", () => {
  it("sprint: segurando correr, depois de ~0,7 s vai a 2× a corrida, sem tranco", () => {
    expect(velocidadeAPe(false, 5)).toBe(SPRINT.andar);
    expect(velocidadeAPe(true, 0)).toBe(SPRINT.correr);
    expect(velocidadeAPe(true, 0.5)).toBe(SPRINT.correr);
    expect(velocidadeAPe(true, 3)).toBe(SPRINT.correr * 2);
    let ant = velocidadeAPe(true, 0);
    for (let t = 0; t < 2; t += 1 / 60) { const v = velocidadeAPe(true, t); expect(v - ant).toBeLessThan(0.6); expect(v).toBeGreaterThanOrEqual(ant); ant = v; }
    expect(emSprint(true, 0.3)).toBe(false); expect(emSprint(true, 2)).toBe(true);
  });
  it("dash: ~5 m em 0,18 s na direção pedida (parado: pra frente), com recarga e o começo intocável", () => {
    const d = iniciarDash(10, { x: 3, z: 0 }, 0);
    for (const fps of [5, 30, 144]) {   // a MESMA distância em qualquer fps
      let x = 0, t = 10; for (let p = passoDash(d, t, t + 1 / fps); p; p = passoDash(d, t, t + 1 / fps)) { x += p.x; t += 1 / fps; }
      expect(x).toBeCloseTo(DISTANCIA_DASH, 5);
    }
    expect(DISTANCIA_DASH).toBeGreaterThan(4.5); expect(DISTANCIA_DASH).toBeLessThan(5.5);
    expect(iniciarDash(0, null, Math.PI / 2).dir.x).toBeCloseTo(1);
    expect(podeDash(d, 10.2)).toBe(false); expect(podeDash(d, 10 + DASH.recarga)).toBe(true); expect(podeDash(null, 0)).toBe(true);
    expect(intocavel(d, 10.1)).toBe(true); expect(intocavel(d, 10.4)).toBe(false);
  });
  it("a sensação de velocidade: andar/correr/voo normal = nada; sprint mais da metade; voo turbo e dash cheios", () => {
    expect(sensacaoAPe(SPRINT.correr)).toBe(0);
    expect(sensacaoAPe(SPRINT.sprint)).toBeGreaterThan(0.55); expect(sensacaoAPe(SPRINT.sprint)).toBeLessThan(0.75);
    expect(sensacaoAPe(DASH.vel)).toBe(1);
    expect(sensacaoAPe(16, true)).toBe(0); expect(sensacaoAPe(32, true)).toBe(1);
  });
});
