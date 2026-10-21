import { describe, expect, it } from "vitest";
import { CABOS, GLOBOS, GRUPOS_DROIDS, LIGACOES, MIRANTES, MIRANTES_ESTACAO, MIRANTES_PIRAMIDE, MOTORES, PONTOS_TERRA, RONDA_LIDER, R_MIRANTE, SUPERTREES, TELOES, TELOES_SOLUCAO, TEMAS, TOTENS, colisoresDoDistritoTerra, ehSolucao, noMapa, noMirante, poseDoLider, poseDosMenores, reacaoDoMotor } from "./terra";
import { CAPELA, CIDADE, ESCADA_LOUNGE, mundo } from "./ceu";
import { LAR_LOCAL, POIS } from "./landmarks";
import { BASES_CEU_LOCAIS } from "./bases";
import { poseDaDoca, NAVE_QG } from "./naveQG";

const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const doca = (() => { const p = poseDaDoca(); return { x: p.x - CIDADE.centro.x, z: p.z - CIDADE.centro.z }; })();
const PIRAMIDE_R = 15;   // o pé do cone da pirâmide (chaoR ≈ 14,8)
const OCUPADO = [
  { nome: "capela", x: 0, z: 0, r: CAPELA.r + 4 },
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
    expect(POIS.filter((p) => p.preset === "zaeon")).toHaveLength(MIRANTES_PIRAMIDE.length);   // a Recepção + os 2 do lado do lounge (o 3 saiu — fps)
    expect(MIRANTES_PIRAMIDE.map((m) => m.id)).toEqual([0, 1]);   // (o 2 era a cópia do 1 — out/2026, o dono: "retire os repetidos")
    // as ESTAÇÕES (telões, globo, árvores, droids) só nos 2 do lado do LOUNGE (oeste, x < 0)
    expect(MIRANTES_ESTACAO.map((m) => m.id)).toEqual([1]); for (const m of MIRANTES_ESTACAO) expect(m.x).toBeLessThan(0);
    expect(POIS.filter((p) => p.acesso === "dono" && p.preset === "zaeon")).toHaveLength(1);   // só a Recepção é do dono
  });
  it("não encostam na nave, na escada do lounge, no buraco negro, no estacionamento, nas bases nem na capela", () => {
    for (const m of MIRANTES) for (const o of OCUPADO) expect(d(m, o), `mirante ${m.id} × ${o.nome}`).toBeGreaterThan(PIRAMIDE_R + o.r);
    for (const m of MIRANTES) expect(!(m.x < 0 && Math.abs(m.z) < ESCADA_LOUNGE.meia + 30)).toBe(true);
    expect(R_MIRANTE + PIRAMIDE_R).toBeLessThan(CIDADE.andavelR);
  });
  it("NADA na frente da pirâmide: a escada e a vista do centro ficam livres (corredor de 22 m de largura até o centro)", () => {
    const coisas = [...[...TELOES, ...TELOES_SOLUCAO].map((t) => ({ ...t, r: t.larg / 2 })), ...GLOBOS, ...MOTORES, ...SUPERTREES.map((s) => ({ ...s, r: s.copa })), ...TOTENS.map((t) => ({ ...t, r: 1.5 }))];
    for (const m of MIRANTES_PIRAMIDE) for (let u = 8; u <= 150; u += 3) for (const c of coisas) {
      const p = noMirante(m, u, 0), q = noMirante(m, u, 11), q2 = noMirante(m, u, -11);
      for (const x of [p, q, q2]) expect(d(x, c), `mirante ${m.id}, u=${u}`).toBeGreaterThan(c.r * 0.999);
    }
  });
  it("a ESTAÇÃO fica de lado: PROBLEMAS → SOLUÇÕES (2 telões virados pro centro), globo no meio, motores atrás — sem os cards no chão", () => {
    MIRANTES_ESTACAO.forEach((m, i) => {
      const t = TELOES[i]!, s = TELOES_SOLUCAO[i]!, g = GLOBOS[i]!;
      for (const T of [t, s]) { const rT = Math.hypot(T.x, T.z); expect(Math.sin(T.rot) * -T.x + Math.cos(T.rot) * -T.z).toBeGreaterThan(0.99 * rT); expect(d(T, m)).toBeGreaterThan(30); }
      expect(d(t, m)).toBeLessThan(d(s, m));                                                    // o dos problemas é o mais perto da pirâmide
      expect(d(t, s)).toBeGreaterThan(t.larg + 20);                                             // cabem os palcos, os cards e o globo no meio
      expect(Math.abs(d(g, t) - d(g, s))).toBeLessThan(1);                                      // o globo entre os dois
      MOTORES.slice(i * 2, i * 2 + 2).forEach((mo, k) => expect(d(mo, k ? s : t)).toBeLessThan(20));          // 1 motor atrás de cada telão
    });
    expect(CABOS).toHaveLength(MOTORES.length * 2);
    expect(TOTENS).toHaveLength(0); expect(LIGACOES).toHaveLength(0);   // (os cards em pé saíram das duas estações — o dono, out/2026)
    const tudo = [...[...TELOES, ...TELOES_SOLUCAO].map((t) => ({ ...t, r: t.larg / 2 })), ...GLOBOS, ...TOTENS.map((t) => ({ ...t, r: 1.5 })), ...MOTORES];
    for (const c of tudo) { expect(Math.hypot(c.x, c.z) + c.r).toBeLessThan(CIDADE.andavelR - 2); for (const o of OCUPADO) expect(d(c, o), `× ${o.nome}`).toBeGreaterThan(c.r + o.r); }
    for (const c of tudo) for (const m of MIRANTES) expect(d(c, m)).toBeGreaterThan(PIRAMIDE_R + c.r);
    for (const s of SUPERTREES) { expect(s.alt).toBeGreaterThanOrEqual(25); expect(s.alt).toBeLessThanOrEqual(50); for (const c of tudo) expect(d(s, c)).toBeGreaterThan(c.r + 2.5); }
    expect(colisoresDoDistritoTerra(mundo).length).toBeGreaterThan(SUPERTREES.length + MOTORES.length);
  });
  it("os pontos: os PROBLEMAS (o foco) e, pra cada tema, SOLUÇÕES reais", () => {
    expect(PONTOS_TERRA.filter((p) => p.tipo === "problema").length).toBeGreaterThanOrEqual(6);
    for (const tema of TEMAS) { expect(PONTOS_TERRA.filter((p) => p.tema === tema && !ehSolucao(p)).length).toBeGreaterThan(0); expect(PONTOS_TERRA.filter((p) => p.tema === tema && ehSolucao(p)).length).toBeGreaterThanOrEqual(2); }
  });
  it("os motores acordam com gente perto (e dormem longe)", () => {
    expect(reacaoDoMotor(40)).toBe(0); expect(reacaoDoMotor(6)).toBe(1); expect(reacaoDoMotor(16)).toBeCloseTo(0.5, 5);
  });
});

describe("os droids observadores", () => {
  it("1 grupo por estação: o líder BAIXO alterna entre o PROBLEMA e a SOLUÇÃO (lendo cada tela); os 2 menores orbitando o globo — pelo relógio", () => {
    expect(GRUPOS_DROIDS).toHaveLength(MIRANTES_ESTACAO.length);
    for (const g of GRUPOS_DROIDS) {
      const vistas = new Set<string | null>();
      let ant = poseDoLider(g, 0);
      for (let t = 0; t < 200; t += 0.5) {
        const l = poseDoLider(g, t); expect(poseDoLider(g, t)).toEqual(l); vistas.add(l.lendoTela);
        expect(l.y).toBeGreaterThan(4); expect(l.y).toBeLessThan(11);                     // baixo
        expect(Math.hypot(l.x - ant.x, l.z - ant.z)).toBeLessThan(15); ant = l;           // sem teleporte (voa de uma tela pra outra)
        if (l.lendoTela) {
          const T = l.lendoTela === "problema" ? g.tela : g.solucao, frente = Math.sin(T.rot) * (l.x - T.x) + Math.cos(T.rot) * (l.z - T.z);
          expect(frente).toBeGreaterThan(5); expect(frente).toBeLessThan(11);           // na FRENTE da tela que lê, perto
          expect(d(l.alvo, T)).toBeLessThan(T.larg / 2);                                 // lendo um ponto dela
        }
        for (const m of poseDosMenores(g, t)) expect(d(m, g.globo)).toBeLessThan(g.globo.r + 5);
      }
      expect([...vistas].sort()).toEqual([null, "problema", "solucao"].sort());
    }
    expect(RONDA_LIDER.le).toBeGreaterThan(RONDA_LIDER.voa);   // passa mais tempo lendo do que voando
  });
  it("os pontos da Terra caem no mapa", () => {
    for (const p of PONTOS_TERRA) { const m = noMapa(p.lat, p.lon); expect(m.u).toBeGreaterThanOrEqual(0); expect(m.u).toBeLessThanOrEqual(1); expect(m.v).toBeGreaterThanOrEqual(0); expect(m.v).toBeLessThanOrEqual(1); }
  });
});
