import { describe, expect, it } from "vitest";
import { CAMPI, IDS_CAMPI, andarNoCampus, empurrarNoCampus, layoutDoCampus, localC, mundoC, pilaresDoCampus, type IdCampus } from "./campi";
import { UNIVERSIDADE } from "./universidade";
import { SOLANA } from "./solana";
import { CIDADE } from "./ceu";
import { VOO } from "./voo";
import { PLATAFORMAS, anelDoChao, andarNaPlataforma, pilaresDasPlataformas } from "./plataformas";

const area = (r: number) => Math.PI * r * r;
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe("os outros CAMPI (UFC, Unifor, UECE)", () => {
  it("tamanhos: UFC ≥ 8× a UNILAB; Unifor grande (mas menor que a UFC); UECE quase do tamanho da UNILAB", () => {
    const u = area(UNIVERSIDADE.discoR);
    expect(area(CAMPI.ufc.r) / u).toBeGreaterThanOrEqual(8);
    expect(area(CAMPI.unifor.r) / u).toBeGreaterThan(2.5); expect(CAMPI.unifor.r).toBeLessThan(CAMPI.ufc.r * 0.75);
    expect(area(CAMPI.uece.r) / u).toBeGreaterThan(0.9); expect(area(CAMPI.uece.r) / u).toBeLessThan(1.6);
  });
  it("todos FLUTUANTES e longe uns dos outros e de tudo (Zaeon, UNILAB, Solana, a praça); dentro do mapa", () => {
    const outros = [{ c: CIDADE.centro, r: CIDADE.bordaR + 70 }, { c: UNIVERSIDADE.centro, r: UNIVERSIDADE.discoR }, { c: SOLANA.centro, r: SOLANA.r }, { c: { x: 0, z: 0 }, r: 120 }];
    for (const id of IDS_CAMPI) {
      const C = CAMPI[id];
      expect(C.y).toBeGreaterThan(150);
      expect(Math.hypot(C.centro.x, C.centro.z) + C.r).toBeLessThan(VOO.raioMapa - 20);
      for (const o of outros) expect(dist(C.centro, o.c) - C.r - o.r).toBeGreaterThan(150);
      for (const j of IDS_CAMPI) if (j !== id) expect(dist(C.centro, CAMPI[j].centro) - C.r - CAMPI[j].r).toBeGreaterThan(250);
    }
  });
  it("UFC é uma CIDADE: quarteirões em grade, centenas de prédios, parques, ruas e prédios com nome", () => {
    const l = layoutDoCampus("ufc");
    expect(l.predios.length).toBeGreaterThan(200);
    expect(l.areas.filter((a) => a.tipo === "rua").length).toBeGreaterThan(10);
    expect(l.areas.filter((a) => a.tipo === "parque").length).toBeGreaterThan(8);
    expect(l.predios.filter((p) => p.nome).length).toBeGreaterThanOrEqual(6);
    expect(l.predios.some((p) => p.tipo === "marco" && p.nome === "Reitoria")).toBe(true);
  });
  it("cada campus tem o seu marco (Reitoria) e todo prédio cabe inteiro no disco", () => {
    for (const id of IDS_CAMPI) {
      const l = layoutDoCampus(id), r = CAMPI[id].r;
      expect(l.predios.filter((p) => p.tipo === "marco")).toHaveLength(1);
      for (const p of l.predios) expect(Math.hypot(p.x, p.z) + Math.hypot(p.lx, p.lz) / 2).toBeLessThan(r - 2);
    }
  });
  it("a ENTRADA: o anel do chão leva ao disco, e a chegada/volta não caem dentro de prédio nem fora do disco", () => {
    for (const id of IDS_CAMPI) {
      const P = PLATAFORMAS[id];
      expect(anelDoChao(P.anelChao)).toBe(id);
      const ch = localC(id, P.chegada); expect(empurrarNoCampus(id, ch)).toEqual(ch);
      expect(Math.hypot(ch.x, ch.z)).toBeLessThan(CAMPI[id].r - 5);
      expect(andarNaPlataforma(id, 0, P.chegada).fora).toBe(false);
      // a entrada aponta pra praça
      expect(Math.hypot(P.anelChao.x, P.anelChao.z)).toBeLessThan(Math.hypot(CAMPI[id].centro.x, CAMPI[id].centro.z));
    }
  });
  it("colisão: andando, não se entra num prédio (nem nos GIRADOS da Unifor); passou da borda do disco = cai", () => {
    for (const id of ["ufc", "unifor"] as IdCampus[]) {
      const p = layoutDoCampus(id).predios.find((q) => q.tipo !== "marco" && (id === "ufc" || q.rot !== 0))!;
      const q = andarNoCampus(id, mundoC(id, { x: p.x, z: p.z }));
      const u = localC(id, q), dx = u.x - p.x, dz = u.z - p.z, c = Math.cos(p.rot), s = Math.sin(p.rot);
      const lu = dx * c - dz * s, lv = dx * s + dz * c;
      expect(Math.abs(lu) >= p.lx / 2 + 0.4 || Math.abs(lv) >= p.lz / 2 + 0.4).toBe(true);
    }
    const C = CAMPI.uece; expect(andarNoCampus("uece", { x: C.centro.x + C.r + 3, z: C.centro.z }).fora).toBe(true);
  });
  it("voo (nave/moto): o disco e os prédios são sólidos; os sólidos das plataformas saem do cache (não recalcula por quadro)", () => {
    const p = pilaresDoCampus("ufc");
    expect(p[0]).toMatchObject({ r: CAMPI.ufc.r, topo: CAMPI.ufc.y });
    expect(p.length).toBe(layoutDoCampus("ufc").predios.length + 1);
    expect(pilaresDasPlataformas()).toBe(pilaresDasPlataformas());
  });
  it("o caminho da CHEGADA até o centro é LIVRE (UFC: a avenida até a Reitoria; Unifor: até o espelho d'água; UECE: o boulevard até o pátio)", () => {
    const ate: Record<IdCampus, number> = { ufc: 50, unifor: 66, uece: 12 };
    for (const id of IDS_CAMPI) {
      const ch = localC(id, PLATAFORMAS[id].chegada), d0 = Math.hypot(ch.x, ch.z), ux = ch.x / d0, uz = ch.z / d0;
      for (let d = d0; d > ate[id]; d -= 2) { const p = { x: ux * d, z: uz * d }; expect(empurrarNoCampus(id, p), `${id} a ${d.toFixed(0)} m do centro`).toEqual(p); }
    }
  });
});
