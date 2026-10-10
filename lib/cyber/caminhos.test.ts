import { describe, expect, it } from "vitest";
import { comprimento, linhaLivre, livre, pontoNaRota, rotaAPe } from "./caminhos";
import { CAPELA_NA_ZAEON, CIDADE, colisoresDaCidade, estacoesLocais } from "./ceu";

const c = CIDADE.centro;
const local = (p: { x: number; z: number }) => ({ x: p.x - c.x, z: p.z - c.z });
/** a rota não chega a menos de `folga` de nenhum colisor da cidade (amostrando a cada 0,3 m) */
function rotaSemColisao(r: { x: number; z: number }[], folga = 0.3) {
  const cols = colisoresDaCidade().map((o) => ({ ...local(o), r: o.r }));
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1]!, b = r[i]!, n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.3);
    for (let k = 0; k <= n; k++) { const p = { x: a.x + (b.x - a.x) * (k / n), z: a.z + (b.z - a.z) * (k / n) };
      for (const o of cols) if (Math.hypot(p.x - o.x, p.z - o.z) < o.r + folga) return false; }
  }
  return true;
}

const pontosAmostrados = (r: { x: number; z: number }[]) => r.flatMap((b, i) => { if (!i) return []; const a = r[i - 1]!, n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z)); return Array.from({ length: n + 1 }, (_, k) => ({ x: a.x + (b.x - a.x) * (k / n), z: a.z + (b.z - a.z) * (k / n) })); });

describe("caminhos a pé na Zaeon", () => {
  it("o centro do globo e as colunas da capela não são livres; a praça aberta é", () => {
    expect(livre({ x: 0, z: 0 })).toBe(false);
    expect(livre({ x: CIDADE.cidadela.r, z: 0 })).toBe(!CAPELA_NA_ZAEON);   // a coluna 0 (sem a capela, livre)
    expect(livre({ x: 120, z: -10 })).toBe(true);
    expect(livre({ x: 400, z: 0 })).toBe(false);                 // fora da ilha
  });
  it("de uma estação dos agentes até o lounge (subindo a escada) sem atravessar nada", () => {
    const e = estacoesLocais()[3]!, de = { x: e.x + Math.sin(e.rot) * 1.25, z: e.z + Math.cos(e.rot) * 1.25 };
    const r = rotaAPe(de, { x: -385, z: 0 })!;
    expect(r).not.toBeNull();
    expect(r[0]).toEqual(de); expect(r[r.length - 1]).toEqual({ x: -385, z: 0 });
    expect(rotaSemColisao(r.slice(1, -1))).toBe(true);
    expect(comprimento(r)).toBeGreaterThanOrEqual(Math.hypot(de.x + 385, de.z) - 1e-6);
    // entre o pé e o topo da escada (x de −220 a −355) ela anda DENTRO da escada (|z| ≤ meia-largura)
    for (const p of pontosAmostrados(r)) if (p.x < -222 && p.x > -354) expect(Math.abs(p.z)).toBeLessThanOrEqual(5);
    expect(comprimento(r)).toBeLessThan(560);
    expect(r.length).toBeLessThan(40);   // sem zigue-zague de grade
  });
  it("cruza a capela saindo por entre as colunas e o caminho é determinístico", () => {
    const a = rotaAPe({ x: 19, z: 3 }, { x: 150, z: 60 })!, b = rotaAPe({ x: 19, z: 3 }, { x: 150, z: 60 })!;
    expect(a).toEqual(b);
    for (let i = 2; i < a.length - 1; i++) expect(linhaLivre(a[i - 1]!, a[i]!)).toBe(true);
  });
  it("o ponto na rota anda pelo comprimento e dá o rumo do trecho", () => {
    const r = [{ x: 0, z: 0 }, { x: 0, z: 10 }, { x: 10, z: 10 }];
    expect(pontoNaRota(r, 5)).toMatchObject({ x: 0, z: 5 }); expect(pontoNaRota(r, 5).rumo).toBeCloseTo(0);
    expect(pontoNaRota(r, 15)).toMatchObject({ x: 5, z: 10 }); expect(pontoNaRota(r, 15).rumo).toBeCloseTo(Math.PI / 2);
    expect(pontoNaRota(r, 99)).toMatchObject({ x: 10, z: 10 });
  });
});
