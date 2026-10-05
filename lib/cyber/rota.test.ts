import { describe, expect, it } from "vitest";
import { CIDADE, mundo } from "./ceu";
import { HELIPORTO, POIS } from "./landmarks";
import { passoVooSub, pilaresDoMarco, type EstadoVoo } from "./voo";
import { alvoDoAtalho, rotaPara, seguirRota, type DestinoRota } from "./rota";

const Z = POIS.find((p) => p.id === "zaeon")!;
const solidosZ = pilaresDoMarco({ x: Z.x, z: Z.z, chaoR: Z.nav!.chaoR, altura: Z.altura, escala: Z.escala ?? 1, cupula: true });
const zaeon = { x: Z.x, z: Z.z, topo: solidosZ[1]!.topo };
const est = (x: number, y: number, z: number): EstadoVoo => ({ x, y, z, yaw: 0, vx: 0, vy: 0, vz: 0 });
const hangar = mundo(CIDADE.hangar);
const daCidade = (p: { x: number; z: number }) => Math.hypot(p.x - CIDADE.centro.x, p.z - CIDADE.centro.z);
const dentroDaIlha = (s: EstadoVoo) => daCidade(s) < CIDADE.bordaR - 1e-6 && s.y > CIDADE.pisoY - CIDADE.ilhaAltura + 1e-6 && s.y < CIDADE.pisoY - 1e-6;
const dentroDaZaeon = (s: EstadoVoo) => solidosZ.some((p) => Math.hypot(s.x - p.x, s.z - p.z) < p.r - 1e-6 && s.y < p.topo - 1e-6);

/** voa o atalho do jeito do engine: piloto automático → mesmas entradas dos botões → passoVooSub */
function voarAtalho(destino: DestinoRota, ini: EstadoVoo, fps: number, maxSeg = 60) {
  let s = ini, pousado = true, rota = rotaPara(destino, ini, zaeon), t = 0, chegou = false;
  const trilha: EstadoVoo[] = [];
  while (t < maxSeg && !chegou) {
    const f = seguirRota(s, rota, pousado); rota = f.rota; chegou = f.chegou; if (chegou) break;
    const r = passoVooSub(s, f.cmd, 1 / fps, solidosZ); s = r.s; pousado = r.pousado; t += 1 / fps; trilha.push(s);
  }
  return { s, pousado, chegou, t, trilha };
}

describe("atalhos de rota (piloto automático com as entradas dos botões)", () => {
  for (const fps of [60, 10]) {
    it(`⬇ Chão: do hangar até o heliporto, contornando a ilha, a ${fps} FPS`, () => {
      const r = voarAtalho("chao", est(hangar.x, CIDADE.pisoY, hangar.z), fps);
      expect(r.chegou).toBe(true); expect(r.pousado).toBe(true); expect(r.s.y).toBe(0);
      expect(Math.hypot(r.s.x - HELIPORTO.x, r.s.z - HELIPORTO.z)).toBeLessThan(HELIPORTO.r);
      expect(r.trilha.some(dentroDaIlha)).toBe(false); expect(r.trilha.some(dentroDaZaeon)).toBe(false);
      expect(r.t).toBeLessThan(25);
    });
    it(`⬆ Cidade: do chão EMBAIXO da ilha até o hangar a ${fps} FPS`, () => {
      const r = voarAtalho("cidade", est(CIDADE.centro.x + 3, 0, CIDADE.centro.z + 2), fps);
      expect(r.chegou).toBe(true); expect(r.s.y).toBe(CIDADE.pisoY);
      expect(Math.hypot(r.s.x - hangar.x, r.s.z - hangar.z)).toBeLessThan(CIDADE.hangar.r);
      expect(r.trilha.some(dentroDaIlha)).toBe(false);
    });
    it(`⬆ Cidade: do heliporto até o hangar a ${fps} FPS`, () => {
      const r = voarAtalho("cidade", est(HELIPORTO.x, 0, HELIPORTO.z), fps);
      expect(r.chegou).toBe(true); expect(r.s.y).toBe(CIDADE.pisoY);
      expect(Math.hypot(r.s.x - hangar.x, r.s.z - hangar.z)).toBeLessThan(CIDADE.hangar.r);
      expect(r.trilha.some(dentroDaIlha)).toBe(false); expect(r.trilha.some(dentroDaZaeon)).toBe(false);
    });
    it(`Zaeon: da Cidade até a cúpula (topo do dono) a ${fps} FPS`, () => {
      const r = voarAtalho("zaeon", est(hangar.x, CIDADE.pisoY, hangar.z), fps);
      expect(r.chegou).toBe(true); expect(r.s.y).toBe(zaeon.topo);
      expect(r.trilha.some(dentroDaIlha)).toBe(false); expect(r.trilha.some(dentroDaZaeon)).toBe(false);
    });
  }
  it("do meio do caminho (no ar, longe) a rota também fecha", () => {
    for (const d of ["chao", "cidade", "zaeon"] as const) {
      const r = voarAtalho(d, est(-120, 90, 60), 30);
      expect(r.chegou).toBe(true); expect(r.pousado).toBe(true);
    }
  });
  it("na Cidade, ⬆ Cidade não sai pela borda (vai direto ao hangar)", () => {
    const chegada = mundo(CIDADE.chegada);
    const rota = rotaPara("cidade", est(chegada.x, CIDADE.pisoY, chegada.z), zaeon);
    expect(rota.every((w) => daCidade(w) <= CIDADE.bordaR)).toBe(true);
    expect(rota.at(-1)).toEqual(alvoDoAtalho("cidade"));
  });
  it("Zaeon sem marco na cena → sem rota", () => {
    expect(rotaPara("zaeon", est(0, 0, 0))).toEqual([]);
    expect(seguirRota(est(0, 0, 0), [], true).chegou).toBe(true);
  });
});
