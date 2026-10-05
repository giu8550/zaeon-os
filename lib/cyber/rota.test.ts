import { describe, expect, it } from "vitest";
import { CIDADE, mundo } from "./ceu";
import { HELIPORTO, POIS } from "./landmarks";
import { passoVooSub, pilaresDoMarco, type EstadoVoo } from "./voo";
import { alvoDoAtalho, pousoDoQG, rotaPara, seguirRota, type DestinoRota } from "./rota";

const Z = POIS.find((p) => p.id === "zaeon")!;   // o QG do Andrei (marco andável)
const solidosZ = pilaresDoMarco({ x: Z.x, z: Z.z, chaoR: Z.nav!.chaoR, altura: Z.altura, escala: Z.escala ?? 1, cupula: true });
const qg = pousoDoQG({ x: Z.x, z: Z.z, dir: Z.nav!.escada.dir, muralhaR: Z.nav!.muralhaR }, solidosZ[0]!.topo);
const est = (x: number, y: number, z: number): EstadoVoo => ({ x, y, z, yaw: 0, vx: 0, vy: 0, vz: 0 });
const hangar = mundo(CIDADE.hangar);
const daCidade = (p: { x: number; z: number }) => Math.hypot(p.x - CIDADE.centro.x, p.z - CIDADE.centro.z);
const dentroDaIlha = (s: EstadoVoo) => daCidade(s) < CIDADE.bordaR - 1e-6 && s.y > CIDADE.pisoY - CIDADE.ilhaAltura + 1e-6 && s.y < CIDADE.pisoY - 1e-6;
const dentroDoQG = (s: EstadoVoo) => solidosZ.some((p) => Math.hypot(s.x - p.x, s.z - p.z) < p.r - 1e-6 && s.y < p.topo - 1e-6);

/** voa o atalho do jeito do engine: piloto automático → mesmas entradas dos botões → passoVooSub */
function voarAtalho(destino: DestinoRota, ini: EstadoVoo, fps: number, maxSeg = 60) {
  let s = ini, pousado = true, rota = rotaPara(destino, ini, qg), t = 0, chegou = false;
  const trilha: EstadoVoo[] = [];
  while (t < maxSeg && !chegou) {
    const f = seguirRota(s, rota, pousado); rota = f.rota; chegou = f.chegou; if (chegou) break;
    const r = passoVooSub(s, f.cmd, 1 / fps, solidosZ); s = r.s; pousado = r.pousado; t += 1 / fps; trilha.push(s);
  }
  return { s, pousado, chegou, t, trilha };
}

describe("atalhos de rota (piloto automático com as entradas dos botões)", () => {
  for (const fps of [60, 10]) {
    it(`Heliporto: do hangar da Zaeon (céu) até o heliporto, contornando a ilha, a ${fps} FPS`, () => {
      const r = voarAtalho("heliporto", est(hangar.x, CIDADE.pisoY, hangar.z), fps);
      expect(r.chegou).toBe(true); expect(r.pousado).toBe(true); expect(r.s.y).toBe(0);
      expect(Math.hypot(r.s.x - HELIPORTO.x, r.s.z - HELIPORTO.z)).toBeLessThan(HELIPORTO.r);
      expect(r.trilha.some(dentroDaIlha)).toBe(false); expect(r.trilha.some(dentroDoQG)).toBe(false);
      expect(r.t).toBeLessThan(25);
    });
    it(`QG do Andrei: da Zaeon (céu) até sobre as muralhas, do lado do portão, a ${fps} FPS`, () => {
      const r = voarAtalho("qg", est(hangar.x, CIDADE.pisoY, hangar.z), fps);
      expect(r.chegou).toBe(true); expect(r.s.y).toBe(solidosZ[0]!.topo);
      expect(Math.hypot(r.s.x - qg.x, r.s.z - qg.z)).toBeLessThan(2.5);
      expect(Math.hypot(r.s.x - Z.x, r.s.z - Z.z)).toBeGreaterThan(solidosZ[1]!.r);   // fora da cúpula
      expect(r.trilha.some(dentroDaIlha)).toBe(false); expect(r.trilha.some(dentroDoQG)).toBe(false);
    });
    it(`do chão EMBAIXO da ilha até o heliporto a ${fps} FPS`, () => {
      const r = voarAtalho("heliporto", est(CIDADE.centro.x + 3, 0, CIDADE.centro.z + 2), fps);
      expect(r.chegou).toBe(true); expect(r.s.y).toBe(0);
      expect(r.trilha.some(dentroDaIlha)).toBe(false);
    });
  }
  for (const fps of [60, 10]) {
    it(`Zaeon: do heliporto (chão) até o hangar no céu, sem atravessar a ilha, a ${fps} FPS`, () => {
      const r = voarAtalho("zaeon", est(HELIPORTO.x, 0, HELIPORTO.z), fps);
      expect(r.chegou).toBe(true); expect(r.s.y).toBe(CIDADE.pisoY);
      expect(Math.hypot(r.s.x - hangar.x, r.s.z - hangar.z)).toBeLessThan(CIDADE.hangar.r);
      expect(r.trilha.some(dentroDaIlha)).toBe(false); expect(r.trilha.some(dentroDoQG)).toBe(false);
    });
    it(`Zaeon: do chão EMBAIXO da ilha até o hangar a ${fps} FPS`, () => {
      const r = voarAtalho("zaeon", est(CIDADE.centro.x + 3, 0, CIDADE.centro.z + 2), fps);
      expect(r.chegou).toBe(true); expect(r.s.y).toBe(CIDADE.pisoY);
      expect(r.trilha.some(dentroDaIlha)).toBe(false);
    });
  }
  it("do meio do caminho (no ar, longe) as rotas também fecham", () => {
    for (const d of ["heliporto", "qg", "zaeon"] as const) {
      const r = voarAtalho(d, est(-120, 90, 60), 30);
      expect(r.chegou).toBe(true); expect(r.pousado).toBe(true);
    }
  });
  it("o pouso do QG fica do lado do portão (escada), entre a cúpula e a borda", () => {
    const d = Math.hypot(qg.x - Z.x, qg.z - Z.z);
    expect(d).toBeGreaterThan(solidosZ[1]!.r); expect(d).toBeLessThan(Z.nav!.chaoR);
    const ang = Math.atan2(qg.z - Z.z, qg.x - Z.x);
    expect(Math.abs(ang - Z.nav!.escada.dir)).toBeLessThan(1e-9);
  });
  it("QG sem marco na cena → sem rota", () => {
    expect(alvoDoAtalho("qg")).toBeNull();
    expect(rotaPara("qg", est(0, 0, 0))).toEqual([]);
    expect(seguirRota(est(0, 0, 0), [], true).chegou).toBe(true);
  });
});
