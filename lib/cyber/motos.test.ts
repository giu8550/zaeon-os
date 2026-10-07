import { describe, expect, it } from "vitest";
import { ESTACIONAMENTO, LOTES, MOTO, TOTAL_VAGAS, motoDe, motoPerto, vagas } from "./motos";
import { CIDADE, colisoresDaCidade, mundo, naIlhaPrincipal, noPortalVolta } from "./ceu";
import { BASES_CEU_LOCAIS } from "./bases";
import { HELIPORTO, POIS } from "./landmarks";
import { VOO, passoVooSub, type EstadoVoo } from "./voo";

describe("motos voadoras — estacionamentos (chão + Zaeon)", () => {
  it("2 lotes × 4 vagas; as do chão primeiro, depois as da Zaeon", () => {
    const v = vagas();
    expect(v).toHaveLength(TOTAL_VAGAS); expect(TOTAL_VAGAS).toBe(8);
    expect(v.slice(0, 4).every((x) => !x.ceu)).toBe(true);
    expect(v.slice(4).every((x) => x.ceu)).toBe(true);
  });
  it("cada fila: vagas lado a lado (espaçadas), todas viradas pro centro do lote", () => {
    for (const [k, l] of LOTES.entries()) {
      const fila = vagas().slice(k * ESTACIONAMENTO.n, (k + 1) * ESTACIONAMENTO.n);
      for (let i = 1; i < fila.length; i++) expect(Math.hypot(fila[i]!.x - fila[i - 1]!.x, fila[i]!.z - fila[i - 1]!.z)).toBeCloseTo(ESTACIONAMENTO.espacamento, 5);
      const alvo = l.ceu ? CIDADE.centro : { x: 0, z: 0 };
      for (const v of fila) {
        const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), dx = alvo.x - v.x, dz = alvo.z - v.z, d = Math.hypot(dx, dz);
        expect((fx * dx + fz * dz) / d).toBeGreaterThan(0.95);   // a frente aponta pro centro
      }
    }
  });
  it("o lote da Zaeon fica no piso andável, longe do portal de volta, das bases do dono e dos colisores da cidade", () => {
    for (const v of vagas().filter((x) => x.ceu)) {
      expect(naIlhaPrincipal(v)).toBe(true);
      expect(Math.hypot(v.x - CIDADE.centro.x, v.z - CIDADE.centro.z)).toBeLessThan(CIDADE.andavelR - 3);
      expect(noPortalVolta(v)).toBe(false);
      for (const b of BASES_CEU_LOCAIS) { const w = mundo(b); expect(Math.hypot(v.x - w.x, v.z - w.z)).toBeGreaterThan(8); }
      for (const c of colisoresDaCidade()) expect(Math.hypot(v.x - c.x, v.z - c.z)).toBeGreaterThan(c.r + 2);
    }
  });
  it("o lote do chão não encosta no heliporto nem em marcos sólidos", () => {
    const l = LOTES[0]!;
    expect(Math.hypot(l.x - HELIPORTO.x, l.z - HELIPORTO.z)).toBeGreaterThan(HELIPORTO.r + ESTACIONAMENTO.r);
    for (const p of POIS.filter((x) => x.solido !== false)) expect(Math.hypot(l.x - p.x, l.z - p.z)).toBeGreaterThan(p.footprintR + ESTACIONAMENTO.r);
  });
  it("motoPerto: a vaga livre mais perto, no alcance e no MESMO nível", () => {
    const v = vagas();
    expect(motoPerto({ x: v[1]!.x + 1, z: v[1]!.z }, new Set())).toBe(1);
    expect(motoPerto({ x: v[1]!.x + 1, z: v[1]!.z }, new Set([1]))).not.toBe(1);
    expect(motoPerto({ x: v[0]!.x + MOTO.alcance + 4, z: v[0]!.z + 40 }, new Set())).toBe(-1);   // longe
    expect(motoPerto({ x: v[5]!.x, z: v[5]!.z }, new Set(), true)).toBe(5);                     // na Zaeon
    expect(motoPerto({ x: v[5]!.x, z: v[5]!.z }, new Set(), false)).toBe(-1);                   // no chão embaixo dela, não
  });
  it("motoDe: saneia a presença (vaga inteira 0..7, altura com teto, rumo finito)", () => {
    expect(motoDe({ s: 6, y: 231.5, yaw: 1 })).toEqual({ moto: { s: 6, y: 231.5, yaw: 1 } });
    expect(motoDe({ s: 8, y: 1, yaw: 0 })).toEqual({});
    expect(motoDe({ s: -1, y: 1, yaw: 0 })).toEqual({});
    expect(motoDe({ s: 1.5, y: 1, yaw: 0 })).toEqual({});
    expect(motoDe({ s: 0, y: Infinity, yaw: 0 })).toEqual({});
    expect(motoDe({ s: 0, y: 9999, yaw: 99 })).toEqual({ moto: { s: 0, y: MOTO.teto, yaw: 10 } });
    expect(motoDe("lixo")).toEqual({}); expect(motoDe(null)).toEqual({});
  });
  it("dá pra ir de moto até a Zaeon: o teto passa do piso da ilha", () => {
    expect(MOTO.teto).toBeGreaterThan(CIDADE.pisoY + 10);
  });
});

describe("voo com teto", () => {
  it("passoVooSub respeita o teto passado (e o padrão é o da nave)", () => {
    let s: EstadoVoo = { x: -500, y: 0, z: 300, yaw: 0, vx: 0, vy: 0, vz: 0 };   // fora da sombra da Zaeon mega (ela cobre a praça lá no alto)
    for (let i = 0; i < 400; i++) s = passoVooSub(s, { wx: 0, wz: 0, subir: true, descer: false }, 0.05, [], 20).s;
    expect(s.y).toBeCloseTo(20, 5);
    for (let i = 0; i < 800; i++) s = passoVooSub(s, { wx: 0, wz: 0, subir: true, descer: false }, 0.05).s;
    expect(s.y).toBeCloseTo(VOO.yMax, 5);
  });
});
