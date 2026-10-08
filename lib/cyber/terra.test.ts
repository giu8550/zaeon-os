import { describe, expect, it } from "vitest";
import { CABOS, GLOBOS, GRUPOS_DROIDS, LOTES_MIRANTE, MIRANTES, MOTORES, PONTOS_TERRA, R_MIRANTE, SUPERTREES, TELOES, TOTENS, colisoresDoDistritoTerra, noMapa, noMirante, poseDoLider, poseDosMenores, reacaoDoMotor } from "./terra";
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
  it("NADA na frente da pirâmide: a escada e a vista do centro ficam livres (corredor de 22 m de largura até o centro)", () => {
    const coisas = [...TELOES.map((t) => ({ ...t, r: t.larg / 2 })), ...GLOBOS, ...MOTORES, ...SUPERTREES.map((s) => ({ ...s, r: s.copa })), ...TOTENS.map((t) => ({ ...t, r: 1.5 })), ...LOTES_MIRANTE.map((l) => ({ ...l, r: 12 }))];
    for (const m of MIRANTES) for (let u = 8; u <= 150; u += 3) for (const c of coisas) {
      const p = noMirante(m, u, 0), q = noMirante(m, u, 11), q2 = noMirante(m, u, -11);
      for (const x of [p, q, q2]) expect(d(x, c), `mirante ${m.id}, u=${u}`).toBeGreaterThan(c.r * 0.999);
    }
  });
  it("a ESTAÇÃO fica de lado: telão (virado pro centro) com o globo ao lado, motores atrás e cabos ligando; totens; motos do outro lado", () => {
    MIRANTES.forEach((m, i) => {
      const t = TELOES[i]!, g = GLOBOS[i]!, rT = Math.hypot(t.x, t.z);
      expect(Math.sin(t.rot) * -t.x + Math.cos(t.rot) * -t.z).toBeGreaterThan(0.99 * rT);   // olha pro centro
      expect(d(t, m)).toBeGreaterThan(45);                                                      // longe da pirâmide (de lado)
      expect(d(g, t)).toBeLessThan(t.larg);                                                     // o globo ao lado do telão
      for (const mo of MOTORES.slice(i * 2, i * 2 + 2)) expect(d(mo, t)).toBeLessThan(20);
      expect(Math.sign(LOTES_MIRANTE[i]!.x - m.x) !== Math.sign(t.x - m.x) || Math.sign(LOTES_MIRANTE[i]!.z - m.z) !== Math.sign(t.z - m.z)).toBe(true);   // motos do outro lado
    });
    expect(CABOS).toHaveLength(MOTORES.length * 2);
    const tudo = [...TELOES.map((t) => ({ ...t, r: t.larg / 2 })), ...GLOBOS, ...TOTENS.map((t) => ({ ...t, r: 1.5 })), ...LOTES_MIRANTE.map((l) => ({ ...l, r: 12 })), ...MOTORES];
    for (const c of tudo) { expect(Math.hypot(c.x, c.z) + c.r).toBeLessThan(CIDADE.andavelR - 2); for (const o of OCUPADO) expect(d(c, o)).toBeGreaterThan(c.r + o.r); }
    for (const c of tudo) for (const m of MIRANTES) expect(d(c, m)).toBeGreaterThan(PIRAMIDE_R + c.r);
    for (const s of SUPERTREES) { expect(s.alt).toBeGreaterThanOrEqual(25); expect(s.alt).toBeLessThanOrEqual(50); for (const c of tudo) expect(d(s, c)).toBeGreaterThan(c.r + 2.5); }
    expect(colisoresDoDistritoTerra(mundo).length).toBeGreaterThan(SUPERTREES.length + MOTORES.length);
    expect(PONTOS_TERRA.filter((p) => p.tipo === "problema").length).toBeGreaterThanOrEqual(6);   // o foco: os PROBLEMAS da Terra
  });
  it("os motores acordam com gente perto (e dormem longe)", () => {
    expect(reacaoDoMotor(40)).toBe(0); expect(reacaoDoMotor(6)).toBe(1); expect(reacaoDoMotor(16)).toBeCloseTo(0.5, 5);
  });
});

describe("os droids observadores", () => {
  it("1 grupo por estação: o líder BAIXO na frente do telão, lendo a tela; os 2 menores orbitando o globo — pelo relógio", () => {
    expect(GRUPOS_DROIDS).toHaveLength(MIRANTES.length);
    for (const g of GRUPOS_DROIDS) for (let t = 0; t < 300; t += 7) {
      const l = poseDoLider(g, t); expect(poseDoLider(g, t)).toEqual(l);
      expect(l.y).toBeGreaterThan(4); expect(l.y).toBeLessThan(9);   // baixo
      const T = g.tela, frente = Math.sin(T.rot) * (l.x - T.x) + Math.cos(T.rot) * (l.z - T.z);
      expect(frente).toBeGreaterThan(5); expect(frente).toBeLessThan(11);   // na FRENTE da tela, perto
      expect(d(l.alvo, T)).toBeLessThan(T.larg / 2);                         // lendo um ponto da tela
      for (const m of poseDosMenores(g, t)) expect(d(m, g.globo)).toBeLessThan(g.globo.r + 5);
    }
  });
  it("os pontos da Terra caem no mapa", () => {
    for (const p of PONTOS_TERRA) { const m = noMapa(p.lat, p.lon); expect(m.u).toBeGreaterThanOrEqual(0); expect(m.u).toBeLessThanOrEqual(1); expect(m.v).toBeGreaterThanOrEqual(0); expect(m.v).toBeLessThanOrEqual(1); }
  });
});
