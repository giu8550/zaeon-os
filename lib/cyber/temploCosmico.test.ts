import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALTURA_LOUNGE, CIDADE, alturaNaCidade, colisoresDaCidade, daSala, mundo, naIlhaPrincipal, naSala, rotDaSala, salaEm, solidosDaCidade } from "./ceu";
import { NOS } from "./buracos";
import { FIO, saidaDaSala } from "./fiosCosmicos";
import { definirNivel } from "./nivelAtivo";
import { nivelDoPonto } from "./niveis";
import { BOCA_SAIDA_SALAO, CHEGADA_SALAO, PIRAMIDE, PONTE_LOUNGE, SALAO, naPiramide } from "./temploCosmico";

const L = CIDADE.salas.lounge;
const W = (x: number, z: number) => mundo(daSala(L, x, z));
const loc = (p: { x: number; z: number }) => ({ x: p.x - CIDADE.centro.x, z: p.z - CIDADE.centro.z });

describe("o Templo Cósmico: o SALÃO central e a ponte pro lounge", () => {
  beforeEach(() => definirNivel("lounge"));
  afterEach(() => definirNivel(null));

  it("o salão fica à DIREITA do lounge pra quem chega (o lounge, à esquerda) e mais baixo que ele", () => {
    const ch = NOS.lounge.chegada, f = { x: Math.sin(ch.rumo), z: Math.cos(ch.rumo) }, dir = { x: -f.z, z: f.x }, lounge = mundo(L);
    expect((lounge.x - ch.x) * dir.x + (lounge.z - ch.z) * dir.z).toBeLessThan(-100);   // o lounge à esquerda de quem chega
    const pir = W(PIRAMIDE.x, PIRAMIDE.z); expect((pir.x - ch.x) * f.x + (pir.z - ch.z) * f.z).toBeGreaterThan(20);   // a pirâmide em frente
    expect(alturaNaCidade(W(SALAO.x + 20, SALAO.z + 20))).toBe(ALTURA_LOUNGE - SALAO.desce);
    expect(NOS.lounge.y).toBe(CIDADE.pisoY + ALTURA_LOUNGE - SALAO.desce);
  });
  it("chegando: é piso, é o nível do lounge e não está em cima de nenhum colisor nem da pirâmide", () => {
    const ch = NOS.lounge.chegada;
    expect(alturaNaCidade(ch)).toBe(ALTURA_LOUNGE - SALAO.desce); expect(naIlhaPrincipal(ch)).toBe(true);
    expect(salaEm(loc(ch))).toBe("lounge"); expect(nivelDoPonto(ch, NOS.lounge.y)).toBe("lounge");
    expect(colisoresDaCidade().every((c) => Math.hypot(c.x - ch.x, c.z - ch.z) > c.r + 0.5)).toBe(true);
    expect(naPiramide(naSala(L, loc(ch).x, loc(ch).z), 2)).toBe(false);
    expect(Math.abs(ch.rumo - (rotDaSala(L) - CHEGADA_SALAO.rumo))).toBeLessThan(1e-9);
  });
  it("a PONTE sobe por igual do salão até o pátio do lounge, sem degrau, e a parede do lounge abre ali", () => {
    const { a, b } = PONTE_LOUNGE; let ant = -Infinity;
    for (let u = 0; u <= 1.0001; u += 0.05) { const h = alturaNaCidade(W(a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u)); expect(h).toBeGreaterThanOrEqual(ant - 1e-9); ant = h; }
    expect(alturaNaCidade(W(a.x, a.z))).toBeCloseTo(ALTURA_LOUNGE - SALAO.desce, 6); expect(alturaNaCidade(W(b.x * 0.97, b.z * 0.97))).toBeCloseTo(ALTURA_LOUNGE, 6);
    // nenhum colisor no meio do caminho (salão → ponte → pátio)
    const cs = colisoresDaCidade();
    for (let u = -0.1; u <= 1.12; u += 0.02) { const p = W(a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u); expect(cs.every((c) => Math.hypot(c.x - p.x, c.z - p.z) > c.r + 0.6)).toBe(true); }
    // e dos lados da ponte, guarda-corpo (não se cai dela)
    const m = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, n = { x: (b.z - a.z), z: -(b.x - a.x) }, k = Math.hypot(n.x, n.z);
    for (const s of [-1, 1]) { const p = W(m.x + (n.x / k) * s * (PONTE_LOUNGE.meia + 0.5), m.z + (n.z / k) * s * (PONTE_LOUNGE.meia + 0.5)); expect(cs.some((c) => Math.hypot(c.x - p.x, c.z - p.z) <= c.r + 0.2)).toBe(true); }
  });
  it("a PIRÂMIDE é sólida (andando e voando) e a borda do salão tem guarda-corpo", () => {
    const cs = colisoresDaCidade(), canto = W(PIRAMIDE.x + PIRAMIDE.meia, PIRAMIDE.z);
    expect(cs.some((c) => Math.hypot(c.x - canto.x, c.z - canto.z) <= c.r)).toBe(true);
    const pc = W(PIRAMIDE.x, PIRAMIDE.z);
    expect(solidosDaCidade().some((s) => Math.hypot(s.x - pc.x, s.z - pc.z) < 1 && s.topo > CIDADE.pisoY + ALTURA_LOUNGE)).toBe(true);
    const borda = W(SALAO.x - SALAO.r, SALAO.z); expect(cs.some((c) => Math.hypot(c.x - borda.x, c.z - borda.z) <= c.r + 0.1)).toBe(true);
  });
  it("a pista de SAÍDA sai do salão, longe o bastante da chegada pra não levar quem acabou de chegar", () => {
    const f = saidaDaSala("lounge"), ch = NOS.lounge.chegada, b = W(BOCA_SAIDA_SALAO.x, BOCA_SAIDA_SALAO.z);
    expect(Math.hypot(f.boca.x - loc(b).x, f.boca.z - loc(b).z)).toBeLessThan(0.5);
    let perto = Infinity; for (const q of f.eixo) perto = Math.min(perto, Math.hypot(q.x - loc(ch).x, q.z - loc(ch).z));
    expect(perto).toBeGreaterThan(FIO.captura * 1.6);
  });
});
