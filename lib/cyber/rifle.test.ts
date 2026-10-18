import { describe, expect, it } from "vitest";
import { codificarLancamento, decodificarLancamento, estadoDoMov } from "./magia";
import {
  NUM_TIRO, RIFLE, animacaoDaMorte, danoDoTiro, desviar, difAng, dispersao, fracaoDoGiro, girarAte, movComRifle, naCabeca, noCorpo,
  passoCalor, passoInercia, pesosRifle, pontoDaMira, precisaVirar, raioNoCorpo, rifleDoMov, tirosNovos,
} from "./rifle";

describe("rifle — movimento", () => {
  it("gira no máximo o passo e pelo lado mais curto", () => {
    expect(girarAte(0, 1, 0.3)).toBeCloseTo(0.3);
    expect(girarAte(3, -3, 0.1)).toBeCloseTo(3.1);   // (de 3 a −3 o curto passa por π)
    expect(girarAte(0, 0.05, 0.3)).toBe(0.05);
    expect(difAng(0.1, -0.1)).toBeCloseTo(-0.2);
  });
  it("a inércia acelera e freia com limite (sem parada seca)", () => {
    let v = { x: 0, z: 0 };
    v = passoInercia(v, { x: 0, z: 4 }, 0.1, { acel: 16, freio: 11 });
    expect(v.z).toBeCloseTo(1.6);
    v = { x: 0, z: 7.5 };
    v = passoInercia(v, { x: 0, z: 0 }, 0.1, { acel: 16, freio: 7 });
    expect(v.z).toBeCloseTo(6.8);   // (correndo: freia 7 m/s²)
    expect(passoInercia({ x: 0, z: 0.5 }, { x: 0, z: 0 }, 0.1, { acel: 16, freio: 11 })).toEqual({ x: 0, z: 0 });
  });
  it("a velocidade no corpo: frente e lado (+ = direita)", () => {
    const f = noCorpo({ x: 0, z: 2 }, 0); expect(f.frente).toBeCloseTo(2); expect(f.lado).toBeCloseTo(0);
    const d = noCorpo({ x: -1, z: 0 }, 0); expect(d.lado).toBeCloseTo(1);   // olhando +z, a direita é −x
  });
  it("os pesos: parado, frente, de costas, de lado — somam 1", () => {
    const p0 = pesosRifle({ frente: 0, lado: 0 }); expect(p0.parado).toBe(1);
    const pf = pesosRifle({ frente: 2, lado: 0 }); expect(pf.frente).toBeCloseTo(1); expect(pf.escala.frente).toBeCloseTo(2);
    const pt = pesosRifle({ frente: -1.5, lado: 0 }); expect(pt.tras).toBeCloseTo(1);
    const pd = pesosRifle({ frente: 1, lado: 1 }); expect(pd.frente).toBeCloseTo(0.5); expect(pd.dir).toBeCloseTo(0.5);
    for (const p of [p0, pf, pt, pd]) expect(p.parado + p.frente + p.tras + p.esq + p.dir).toBeCloseTo(1);
  });
  it("a virada grande parada usa o Rifle Turn; andando, não", () => {
    expect(precisaVirar(0, Math.PI, 0)).not.toBe(0);
    expect(precisaVirar(0, 0.5, 0)).toBe(0);
    expect(precisaVirar(0, Math.PI, 3)).toBe(0);
    expect(fracaoDoGiro(0)).toBe(0); expect(fracaoDoGiro(1)).toBe(1); expect(fracaoDoGiro(0.45)).toBeGreaterThan(0.3);
  });
});

describe("rifle — tiro", () => {
  it("o calor só esfria depois do respiro", () => {
    expect(passoCalor(0.5, 0.1, 10, 9.9)).toBe(0.5);
    expect(passoCalor(0.5, 0.1, 10, 9)).toBeCloseTo(0.5 - RIFLE.esfria * 0.1);
  });
  it("mirar fecha a dispersão; correr e a rajada abrem", () => {
    expect(dispersao(1, 0, 0)).toBeLessThan(dispersao(0, 0, 0));
    expect(dispersao(0, 7, 0)).toBeGreaterThan(dispersao(0, 0, 0));
    expect(dispersao(1, 0, 10)).toBeLessThanOrEqual(RIFLE.dispersao.mira + RIFLE.dispersao.maxRajada + 1e-9);
  });
  it("o desvio fica dentro do cone", () => {
    const d = { x: 0, y: 0, z: 1 };
    for (const [a, b] of [[0.9, 0.1], [0.3, 0.7], [1, 1]] as const) { const r = desviar(d, 0.05, a, b); expect(Math.acos(r.z)).toBeLessThanOrEqual(0.05 + 1e-6); expect(Math.hypot(r.x, r.y, r.z)).toBeCloseTo(1); }
    expect(desviar(d, 0, 0.5, 0.5)).toEqual(d);
  });
  it("o raio da câmera acha o corpo no caminho (mesmo longe) e o chão", () => {
    expect(raioNoCorpo({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: 1 }, 90, { x: 0.2, y: 0, z: 60 })).toBeCloseTo(60 / 90, 1);
    expect(raioNoCorpo({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: 1 }, 90, { x: 3, y: 0, z: 60 })).toBeNull();
    expect(raioNoCorpo({ x: 0, y: 4, z: 0 }, { x: 0, y: 0, z: 1 }, 90, { x: 0, y: 0, z: 20 })).toBeNull();   // (passa por cima da cabeça)
    const olho = { x: 0, y: 2, z: 0 }, dir = { x: 0, y: -0.2, z: 0.98 };
    const m = pontoDaMira(olho, dir, [{ id: "eu", pe: { x: 0, y: 0, z: 0.5 } }, { id: "b", pe: { x: 0, y: 0, z: 5 } }], { alcance: 90, chao: 0, ignorar: "eu" });
    expect(m.id).toBe("b"); expect(m.p.z).toBeGreaterThan(4); expect(m.p.z).toBeLessThan(5.5);
    const c = pontoDaMira(olho, dir, [], { alcance: 90, chao: 0 });
    expect(c.id).toBeNull(); expect(c.p.y).toBeCloseTo(0);
  });
  it("cabeça vale mais", () => {
    expect(naCabeca(1.7, 0)).toBe(true); expect(naCabeca(1.1, 0)).toBe(false);
    expect(danoDoTiro(true)).toBeGreaterThan(danoDoTiro(false));
  });
  it("a rede: o tiro no mag (nº 3), os tiros perdidos pelo seq e a arma nos bits da mov", () => {
    const v = codificarLancamento(2047, { num: NUM_TIRO }, 1.2, -0.3), d = decodificarLancamento(v)!;
    expect(d.num).toBe(NUM_TIRO); expect(d.feitico).toBeNull(); expect(d.yaw).toBeCloseTo(1.2, 2); expect(d.pitch).toBeCloseTo(-0.3, 2);
    expect(tirosNovos(2046, 1)).toBe(3); expect(tirosNovos(5, 5)).toBe(0); expect(tirosNovos(0, 100)).toBe(6);
    const m = movComRifle(6, true, true); expect(estadoDoMov(m)).toBe(6); expect(rifleDoMov(m)).toEqual({ naMao: true, mirando: true });
    expect(rifleDoMov(movComRifle(1, false, true))).toEqual({ naMao: false, mirando: false });
  });
  it("a morte pelo lado", () => {
    expect(animacaoDaMorte("direita")).toEqual({ clipe: "morreDir", espelhar: false });
    expect(animacaoDaMorte("esquerda").espelhar).toBe(true);
    expect(animacaoDaMorte("frente").clipe).toBe("morre");
  });
});
