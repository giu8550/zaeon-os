import { describe, expect, it } from "vitest";
import { GLOBOS, GRUPOS_DROIDS, LOTES_MIRANTE, MIRANTES, MOTORES, PONTOS_TERRA, R_MIRANTE, SUPERTREES, TELOES, colisoresDoDistritoTerra, noMapa, noMirante, poseDoLider, poseDosMenores, reacaoDoMotor } from "./terra";
import { CAPELA, CIDADE, ESCADA_LOUNGE, mundo } from "./ceu";
import { LAR_LOCAL, POIS } from "./landmarks";
import { BASES_CEU_LOCAIS } from "./bases";
import { LOTE_ZAEON_LOCAL, LOTES, tamanhoDoLote } from "./motos";
import { poseDaDoca, NAVE_QG } from "./naveQG";

const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const doca = (() => { const p = poseDaDoca(); return { x: p.x - CIDADE.centro.x, z: p.z - CIDADE.centro.z }; })();
const PIRAMIDE_R = 15;   // o pé do cone da pirâmide (chaoR ≈ 14,8)
const OCUPADO = [
  { nome: "capela", x: 0, z: 0, r: CAPELA.r + 4 },
  { nome: "estacionamento da Zaeon", ...LOTE_ZAEON_LOCAL, r: 20 },
  { nome: "buraco negro", ...CIDADE.portalTunel, r: 10 },
  { nome: "chegada do túnel", ...CIDADE.chegada, r: 8 },
  { nome: "nave na doca", ...doca, r: NAVE_QG.raio + 12 },
  ...BASES_CEU_LOCAIS.map((b, i) => ({ nome: `base do dono ${i}`, ...b, r: 8 })),
];

describe("os MIRANTES DA TERRA nas 4 quinas (a antiga base do Andrei + 3 cópias)", () => {
  it("são 4, simétricos: mesmo raio, 90° entre eles, nas diagonais; o 0 é a Recepção", () => {
    expect(MIRANTES).toHaveLength(4);
    MIRANTES.forEach((m, i) => { expect(Math.hypot(m.x, m.z)).toBeCloseTo(R_MIRANTE, 5); expect(((m.ang * 180) / Math.PI) % 90).toBeCloseTo(45, 5); if (i) expect(m.ang - MIRANTES[i - 1]!.ang).toBeCloseTo(Math.PI / 2, 5); });
    expect(LAR_LOCAL).toEqual({ x: MIRANTES[0]!.x, z: MIRANTES[0]!.z });
    expect(POIS.filter((p) => p.preset === "zaeon")).toHaveLength(4);
    expect(POIS.filter((p) => p.acesso === "dono" && p.preset === "zaeon")).toHaveLength(1);   // só a Recepção é do dono
  });
  it("não encostam na nave, na escada do lounge, no buraco negro, no estacionamento, nas bases nem na capela", () => {
    for (const m of MIRANTES) for (const o of OCUPADO) expect(d(m, o), `mirante ${m.id} × ${o.nome}`).toBeGreaterThan(PIRAMIDE_R + o.r);
    for (const m of MIRANTES) expect(!(m.x < 0 && Math.abs(m.z) < ESCADA_LOUNGE.meia + 30)).toBe(true);
    expect(R_MIRANTE + PIRAMIDE_R).toBeLessThan(CIDADE.andavelR);
  });
  it("em volta: telão À FRENTE (virado pro centro), globo sobre a escada, árvores dos lados e atrás, motos ao lado", () => {
    MIRANTES.forEach((m, i) => {
      const t = TELOES[i]!, rT = Math.hypot(t.x, t.z), g = GLOBOS[i]!;
      expect(rT).toBeLessThan(R_MIRANTE - 40);   // à frente (mais perto do centro que a pirâmide)
      expect(Math.sin(t.rot) * -t.x + Math.cos(t.rot) * -t.z).toBeGreaterThan(0.99 * rT);   // a tela olha pro centro
      expect(Math.hypot(g.x, g.z)).toBeLessThan(R_MIRANTE); expect(g.y - g.r).toBeGreaterThan(t.y + t.alt / 2 - 6);   // o globo aparece por cima do telão
    });
    // nada na ESCADA da pirâmide (de u = 10 a 36 m rumo ao centro, ±4 m de lado), nem no telão
    for (const m of MIRANTES) for (let u = 10; u <= 36; u += 2) {
      const p = noMirante(m, u, 0);
      for (const s of SUPERTREES) expect(d(p, s)).toBeGreaterThan(6);
      for (const e of MOTORES) expect(d(p, e)).toBeGreaterThan(6);
    }
    for (const s of SUPERTREES) { expect(s.alt).toBeGreaterThanOrEqual(25); expect(s.alt).toBeLessThanOrEqual(50); expect(Math.hypot(s.x, s.z)).toBeLessThan(CIDADE.andavelR - 3); }
    for (const s of SUPERTREES) for (const m of MIRANTES) expect(d(s, m)).toBeGreaterThan(PIRAMIDE_R + 3);
    const lotes = LOTES.filter((l) => l.id === "mirante");
    expect(lotes).toHaveLength(4);
    LOTES_MIRANTE.forEach((l, i) => {
      const r = tamanhoDoLote(lotes[i]!).r;
      for (const s of SUPERTREES) expect(d(l, s), `lote ${i} × árvore`).toBeGreaterThan(r + 3);
      for (const e of MOTORES) expect(d(l, e)).toBeGreaterThan(r + 4);
      for (const o of OCUPADO) expect(d(l, o), `lote ${i} × ${o.nome}`).toBeGreaterThan(r + o.r);
      expect(Math.hypot(l.x, l.z) + r).toBeLessThan(CIDADE.andavelR - 3);
    });
    expect(colisoresDoDistritoTerra(mundo).length).toBeGreaterThan(SUPERTREES.length + MOTORES.length);
  });
  it("os motores acordam com gente perto (e dormem longe)", () => {
    expect(reacaoDoMotor(40)).toBe(0); expect(reacaoDoMotor(6)).toBe(1); expect(reacaoDoMotor(16)).toBeCloseTo(0.5, 5);
  });
});

describe("os droids observadores", () => {
  it("1 grupo por mirante (1 líder + 2 menores); o movimento sai só do relógio e fica no ar, longe da capela", () => {
    expect(GRUPOS_DROIDS).toHaveLength(MIRANTES.length);
    for (const g of GRUPOS_DROIDS) for (let t = 0; t < 300; t += 7) {
      const l = poseDoLider(g, t); expect(poseDoLider(g, t)).toEqual(l);
      expect(l.y).toBeGreaterThan(25); expect(Math.hypot(l.x, l.z)).toBeLessThan(CIDADE.andavelR + 10); expect(Math.hypot(l.x, l.z)).toBeGreaterThan(CAPELA.r + 30);
      const m = poseDosMenores(l, t, g.fase); expect(m).toHaveLength(2); for (const p of m) expect(d(p, l)).toBeLessThan(12);
    }
  });
  it("os pontos da Terra caem no mapa", () => {
    for (const p of PONTOS_TERRA) { const m = noMapa(p.lat, p.lon); expect(m.u).toBeGreaterThanOrEqual(0); expect(m.u).toBeLessThanOrEqual(1); expect(m.v).toBeGreaterThanOrEqual(0); expect(m.v).toBeLessThanOrEqual(1); }
  });
});
