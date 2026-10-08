import { describe, expect, it } from "vitest";
import { CIDADE, mundo } from "./ceu";
import { HELIPORTO, POIS } from "./landmarks";
import { passoVooSub, pilaresDoMarco, type EstadoVoo } from "./voo";
import { poseDaDoca } from "./naveQG";
import { alvoDoAtalho, rotaPara, seguirRota, type DestinoRota } from "./rota";

const Z = POIS.find((p) => p.id === "zaeon")!;   // a Recepção (marco andável, no piso da Zaeon)
const solidosZ = pilaresDoMarco({ x: Z.x, z: Z.z, chaoR: Z.nav!.chaoR, altura: (Z.base ?? 0) + Z.altura, escala: Z.escala ?? 1, cupula: true }).map((p) => ({ ...p, base: (Z.base ?? 0) - 1 }));
const est = (x: number, y: number, z: number): EstadoVoo => ({ x, y, z, yaw: 0, vx: 0, vy: 0, vz: 0 });
const hangar = mundo({ x: 34, z: 12 });   // um ponto do piso da Zaeon (o pátio onde era o hangar)
const doca = poseDaDoca();
const daCidade = (p: { x: number; z: number }) => Math.hypot(p.x - CIDADE.centro.x, p.z - CIDADE.centro.z);
const dentroDaIlha = (s: EstadoVoo) => daCidade(s) < CIDADE.bordaR - 1e-6 && s.y > CIDADE.pisoY - CIDADE.ilhaAltura + 1e-6 && s.y < CIDADE.pisoY - 1e-6;
const dentroDoQG = (s: EstadoVoo) => solidosZ.some((p) => Math.hypot(s.x - p.x, s.z - p.z) < p.r - 1e-6 && s.y < p.topo - 1e-6 && s.y > p.base + 1e-6);

/** voa o atalho do jeito do engine: piloto automático → mesmas entradas dos botões → passoVooSub */
function voarAtalho(destino: DestinoRota, ini: EstadoVoo, fps: number, maxSeg = 60) {
  let s = ini, pousado = true, rota = rotaPara(destino, ini), t = 0, chegou = false;
  const trilha: EstadoVoo[] = [];
  while (t < maxSeg && !chegou) {
    const f = seguirRota(s, rota, pousado); rota = f.rota; chegou = f.chegou; if (chegou) break;
    const r = passoVooSub(s, f.cmd, 1 / fps, solidosZ); s = r.s; pousado = r.pousado; t += 1 / fps; trilha.push(s);
  }
  return { s, pousado, chegou, t, trilha };
}

describe("atalhos de rota (piloto automático com as entradas dos botões)", () => {
  for (const fps of [60, 10]) {
    it(`Heliporto: do piso da Zaeon (céu) até o heliporto, contornando a ilha, a ${fps} FPS`, () => {
      const r = voarAtalho("heliporto", est(hangar.x, CIDADE.pisoY, hangar.z), fps);
      expect(r.chegou).toBe(true); expect(r.pousado).toBe(true); expect(r.s.y).toBe(0);
      expect(Math.hypot(r.s.x - HELIPORTO.x, r.s.z - HELIPORTO.z)).toBeLessThan(HELIPORTO.r);
      expect(r.trilha.some(dentroDaIlha)).toBe(false); expect(r.trilha.some(dentroDoQG)).toBe(false);
      expect(r.t).toBeLessThan(36);   // (a Zaeon mega fica a 450 m e longe da praça)
    });
    it(`do chão EMBAIXO da ilha até o heliporto a ${fps} FPS`, () => {
      const r = voarAtalho("heliporto", est(CIDADE.centro.x + 3, 0, CIDADE.centro.z + 2), fps);
      expect(r.chegou).toBe(true); expect(r.s.y).toBe(0);
      expect(r.trilha.some(dentroDaIlha)).toBe(false);
    });
  }
  for (const fps of [60, 10]) {
    it(`Zaeon: do heliporto (chão) até ATRACAR PAIRANDO na doca, ao lado da ilha, sem atravessar a ilha, a ${fps} FPS`, () => {
      const r = voarAtalho("zaeon", est(HELIPORTO.x, 0, HELIPORTO.z), fps);
      expect(r.chegou).toBe(true); expect(r.pousado).toBe(false);
      expect(Math.hypot(r.s.x - doca.x, r.s.z - doca.z)).toBeLessThan(6); expect(Math.abs(r.s.y - doca.y)).toBeLessThan(6);   // (o engine encaixa na doca ao chegar)
      expect(r.trilha.some(dentroDaIlha)).toBe(false); expect(r.trilha.some(dentroDoQG)).toBe(false);
    });
    it(`Zaeon: do chão EMBAIXO da ilha até a doca a ${fps} FPS`, () => {
      const r = voarAtalho("zaeon", est(CIDADE.centro.x + 3, 0, CIDADE.centro.z + 2), fps);
      expect(r.chegou).toBe(true); expect(Math.abs(r.s.y - doca.y)).toBeLessThan(6);
      expect(r.trilha.some(dentroDaIlha)).toBe(false);
    });
  }
  it("do meio do caminho (no ar, longe) as rotas também fecham", () => {
    for (const d of ["heliporto", "zaeon"] as const) {
      const r = voarAtalho(d, est(-120, 90, 60), 30);
      expect(r.chegou).toBe(true); expect(r.pousado).toBe(d !== "zaeon");   // na Zaeon a nave atraca PAIRANDO
    }
  });
  it("os atalhos são só o heliporto (na praça) e a doca da Zaeon — o QG do Andrei saiu (virou a Recepção, na Zaeon)", () => {
    expect(alvoDoAtalho("heliporto")).toMatchObject({ x: HELIPORTO.x, y: 0, z: HELIPORTO.z, pousar: true });
    expect(alvoDoAtalho("zaeon")).toMatchObject({ x: doca.x, y: doca.y, z: doca.z });
    expect(seguirRota(est(0, 0, 0), [], true).chegou).toBe(true);
  });
});
