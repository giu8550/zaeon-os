import { describe, expect, it } from "vitest";
import { BOCA_NO_TEMPLO, CHEGADA_NO_TEMPLO, caminhoNoTemplo, noLayout, spotsDoTemplo } from "./templo";
import { transitoDeMoto } from "./corpo";
import { ALCANCE_DUELO, alturaNoComplexo, colisoresDaTorre, colisoresDoAndarEstudo, colisoresDoComplexo, naPiramide, postoDaGuardia, PLATS } from "../temploCosmico";
import { CIDADE } from "../ceu";
import { lugaresDosNovatos } from "../cidadela";

const L = CIDADE.salas.lounge;
describe("os lugares da frota no Templo Cósmico", () => {
  const spots = spotsDoTemplo();
  it("muitos (as rodas de todas as salas + as cabines), em rodas de 2 a 5", () => {
    expect(spots.length).toBeGreaterThan(450);
    const salas = new Set(spots.map((s) => s.templo!.sala)); for (const s of ["salao", "estudoL", "estudoR", "campus", "torre", "rasta", "capelaRasta", "festas"]) expect(salas.has(s as never), s).toBe(true);
    const rodas = new Map<string, number>(); for (const s of spots) if (s.tipo !== "cabine") { const k = s.id.replace(/-\d+$/, ""); rodas.set(k, (rodas.get(k) ?? 0) + 1); }
    for (const [k, n] of rodas) { expect(n, k).toBeGreaterThanOrEqual(2); expect(n, k).toBeLessThanOrEqual(5); }
    // os 3 andares dos lounges estudantis
    for (const id of ["estudoL", "estudoR"]) expect(new Set(spots.filter((s) => s.templo!.sala === id).map((s) => s.templo!.andar)).size).toBe(3);
  });
  it("cada lugar num PISO de verdade, fora dos colisores do andar dele e longe da Examiner", () => {
    const base = colisoresDoComplexo(L.r), posto = postoDaGuardia();
    for (const s of spots) {
      const t = s.templo!, h = alturaNoComplexo(t.q, t.yRel + 0.2);
      expect(h, s.id).not.toBeNull(); expect(Math.abs(h! - t.yRel), s.id).toBeLessThan(0.6);
      expect(naPiramide(t.q, 1), s.id).toBe(false);
      expect(Math.hypot(t.q.x - posto.x, t.q.z - posto.z), s.id).toBeGreaterThan(ALCANCE_DUELO + 4);
      if (s.tipo === "cabine") continue;   // (a cadeira fica entre a mesa e os painéis da cabine)
      const andar = t.sala === "torre" ? colisoresDaTorre(t.andar as 0 | 1 | 2) : t.sala === "estudoL" || t.sala === "estudoR" ? colisoresDoAndarEstudo(PLATS.find((p) => p.id === t.sala)!, t.andar) : [];
      for (const c of [...(t.sala === "torre" && t.andar > 0 ? [] : base), ...andar]) expect(Math.hypot(t.q.x - c.x, t.q.z - c.z), s.id).toBeGreaterThan(c.r + 0.5);
    }
  });
  it("o caminho a pé entre dois lugares: só por piso, sem a pirâmide (a torre e a escadaria, de mochila)", () => {
    const amostra = spots.filter((_, k) => k % 5 === 0), cs = colisoresDoComplexo(L.r);
    let bate = 0, total = 0;
    for (let k = 0; k + 1 < amostra.length; k++) {
      const a = amostra[k]!, b = amostra[k + 1]!;
      for (const tr of caminhoNoTemplo({ q: a.templo!.q, no: a.templo! }, { q: b.templo!.q, no: b.templo! })) {
        if (tr.salto) continue;
        for (let i = 1; i < tr.pts.length; i++) for (let u = 0; u <= 1; u += 0.1) {
          const p0 = tr.pts[i - 1]!, p1 = tr.pts[i]!, w = { x: p0.x + (p1.x - p0.x) * u, y: p0.y + (p1.y - p0.y) * u, z: p0.z + (p1.z - p0.z) * u }, q = noLayout(w);
          expect(alturaNoComplexo(q, w.y - (CIDADE.pisoY + L.y) + 0.5) !== null || Math.hypot(q.x, q.z) < 70, `${a.id}→${b.id} ${q.x.toFixed(1)},${q.z.toFixed(1)}`).toBe(true);
          expect(naPiramide(q, 0.3), `${a.id}→${b.id} na pirâmide`).toBe(false);
          total++; if (cs.some((c) => Math.hypot(q.x - c.x, q.z - c.z) < c.r * 0.8)) { bate++; if (bate < 6) console.log("bate", a.id, b.id, q.x.toFixed(1), q.z.toFixed(1)); }
        }
      }
    }
    expect(bate / total).toBeLessThan(0.002);   // (dentro de um colisor: quase nunca)
    expect(caminhoNoTemplo({ q: CHEGADA_NO_TEMPLO.q, no: CHEGADA_NO_TEMPLO }, { q: BOCA_NO_TEMPLO.q, no: BOCA_NO_TEMPLO }).length).toBeGreaterThan(0);
  });
});

describe("o trânsito de moto (level 2+)", () => {
  it("sai do Templo a pé, some no túnel, cruza a Zaeon DE MOTO, some de novo e pousa", () => {
    const s = spotsDoTemplo()[40]!, t = transitoDeMoto({ x: s.x, y: s.y, z: s.z, templo: s.templo }, "ia-teste", 3);
    const modos: string[] = [];
    for (let u = 0; u <= 1; u += 0.002) { const p = t.v.em(u), m = p.oculto ? "túnel" : p.modo ?? "?"; if (modos.at(-1) !== m) modos.push(m); }
    expect(modos[0]).toBe("pe"); expect(modos).toContain("túnel"); expect(modos).toContain("moto");
    expect(modos.filter((m) => m === "túnel").length).toBeGreaterThanOrEqual(2);
    expect(Number.isFinite(t.fim.x + t.fim.y + t.fim.z)).toBe(true);
  });
});

describe("os novatos (level 1) na Zaeon", () => {
  it("rodas em volta das supertrees e dos telões", () => {
    const n = lugaresDosNovatos(); expect(n.length).toBeGreaterThan(60);
    for (const s of n) expect(s.ambiente).toBe("zaeon");
  });
});
