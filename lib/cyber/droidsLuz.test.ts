import { describe, expect, it } from "vitest";
import { N_LIDERES, SALAS_DOS_DROIDS, VOO_DROIDS_LUZ, poseDoLiderNaSala, poseDosMenoresNaSala, rotaDosDroids } from "./droidsLuz";
import { ALTURA_LOUNGE, CIDADE, MOVEIS, daSala, salaEm } from "./ceu";

describe("os DROIDS DE LUZ passeiam pelas salas de estudo", () => {
  it("a rota passa por cima dos lugares de estudo da biblioteca e do jardim, acima das cabeças", () => {
    const R = rotaDosDroids();
    expect(R.len).toBeGreaterThan(300);
    for (const nome of SALAS_DOS_DROIDS) {
      const s = CIDADE.salas[nome], pufes = MOVEIS[nome].filter((m) => m.tipo === "pufe").map((m) => daSala(s, m.x, m.z));
      expect(pufes.length).toBeGreaterThan(3);
      // cada pufe tem um ponto da rota a menos de 4 m (no plano), na altura do voo
      for (const p of pufes) expect(Math.min(...R.pts.map((q) => Math.hypot(q.x - p.x, q.z - p.z)))).toBeLessThan(4);
    }
    for (const q of R.pts) expect(q.y - ALTURA_LOUNGE).toBeGreaterThanOrEqual(VOO_DROIDS_LUZ.acimaDaSala - 1e-9);   // nunca baixo (as cabeças ~1,8 m)
  });
  it("a travessia entre as salas é alta e não passa por cima da ilha central", () => {
    const R = rotaDosDroids();
    for (let s = 0; s < R.len; s += 3) {
      const p = poseDoLiderNaSala(0, s / VOO_DROIDS_LUZ.vel);
      if (!salaEm({ x: p.x, z: p.z }, 4)) expect(Math.hypot(p.x, p.z)).toBeGreaterThan(CIDADE.bordaR);
    }
  });
  it("os líderes ficam espalhados na volta; a luz cai no chão da sala embaixo deles; os menores orbitam perto", () => {
    const t = 1234, a = poseDoLiderNaSala(0, t), b = poseDoLiderNaSala(1, t);
    expect(N_LIDERES).toBe(2); expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(30);
    for (let k = 0; k < 400; k += 7) {
      const l = poseDoLiderNaSala(0, k), dentro = salaEm({ x: l.x, z: l.z }) !== null;
      if (dentro && l.y < ALTURA_LOUNGE + VOO_DROIDS_LUZ.travessia - 1) expect(l.luz.y).toBe(ALTURA_LOUNGE);
      for (const m of poseDosMenoresNaSala(0, k)) { expect(Math.hypot(m.x - l.x, m.z - l.z)).toBeCloseTo(VOO_DROIDS_LUZ.orbitaMenores, 6); expect(m.y).toBeLessThan(l.y); }
    }
  });
  it("o jardim troca as árvores por ESMERALDAS de luz (que não ocupam o chão)", () => {
    expect(MOVEIS.jardim.some((m) => m.tipo === "planta")).toBe(false);
    const esm = MOVEIS.jardim.filter((m) => m.tipo === "esmeralda");
    expect(esm.length).toBeGreaterThanOrEqual(6); expect(esm.every((m) => m.solido === false)).toBe(true);
  });
});
