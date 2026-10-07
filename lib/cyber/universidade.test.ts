import { describe, expect, it } from "vitest";
import { ARVORES, CAMPOS, FONTES, PATIOS, SALAS, SEBES, moveisDaSala, TORRES, UNIVERSIDADE, localU, mundoU, naUniversidade, paredesDaUniversidade, pilaresDaUniversidade, resolverUniversidade, resolverUniversidadeNoAr, salaEm } from "./universidade";
import { CIDADE, BURACO_NEGRO } from "./ceu";
import { POIS } from "./landmarks";
import { posicaoDaBase } from "./bases";
import { VOO } from "./voo";

const qg = POIS.find((p) => p.id === "zaeon")!;
const dentroDeParede = (w: { x: number; z: number }) => { const l = localU(w); return paredesDaUniversidade().some((p) => { const dx = p.bx - p.ax, dz = p.bz - p.az, L2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((l.x - p.ax) * dx + (l.z - p.az) * dz) / L2)); return Math.hypot(l.x - (p.ax + dx * t), l.z - (p.az + dz * t)) < p.esp / 2; }); };

describe("Universidade (castelo flutuando num disco no céu)", () => {
  it("é enorme: maior que a Zaeon do céu (que cresceu ×1,5 no cyberespaço v2), e cabe no mapa", () => {
    const lado = UNIVERSIDADE.externa.meia * 2;
    expect(lado * lado).toBeGreaterThan(1.2 * Math.PI * CIDADE.bordaR ** 2);
    const { x, z } = UNIVERSIDADE.centro, m = UNIVERSIDADE.externa.meia;
    expect(Math.hypot(Math.abs(x) + m, Math.abs(z) + m)).toBeLessThan(VOO.raioMapa + 160);   // o canto mais longe
  });
  it("longe do QG do Andrei, do portal do buraco negro e da praça (as bases cabem até muitas pessoas)", () => {
    const sul = UNIVERSIDADE.centro.z - UNIVERSIDADE.externa.meia;   // muralha sul
    expect(Math.hypot(qg.x - UNIVERSIDADE.centro.x, qg.z - UNIVERSIDADE.centro.z)).toBeGreaterThan(250);
    expect(sul - qg.z).toBeGreaterThan(140);
    expect(sul - BURACO_NEGRO.z).toBeGreaterThan(200);
    for (let i = 0; i < 50; i++) expect(naUniversidade(posicaoDaBase(i), 10)).toBe(false);   // 50 bases na praça e nenhuma no campus
  });
  it("as salas ficam dentro da muralha interna, sem se sobrepor, cada uma com porta", () => {
    const i = UNIVERSIDADE.interna.meia;
    for (const s of SALAS) {
      expect(s.x0).toBeGreaterThan(-i); expect(s.x1).toBeLessThan(i); expect(s.z0).toBeGreaterThan(-i); expect(s.z1).toBeLessThan(i);
      expect(s.portas.length).toBeGreaterThan(0);
      expect((s.x1 - s.x0) * (s.z1 - s.z0)).toBeGreaterThan(400);   // salas AMPLAS
      for (const o of SALAS) if (o !== s) expect(s.x1 <= o.x0 || o.x1 <= s.x0 || s.z1 <= o.z0 || o.z1 <= s.z0).toBe(true);
    }
    expect(SALAS.map((s) => s.tipo)).toEqual(expect.arrayContaining(["salao", "biblioteca", "auditorio", "estudo", "laboratorio", "cafe"]));
  });
  it("dá pra entrar: do portão externo, pelo portão interno, até o Grande Salão — sem parede no caminho", () => {
    for (let z = -UNIVERSIDADE.externa.meia - 6; z < 0; z += 0.5) expect(dentroDeParede(mundoU({ x: 0, z }))).toBe(false);
    for (const s of SALAS) for (const p of s.portas) {   // o meio de cada porta está livre
      const l = p.lado === "s" ? { x: p.em, z: s.z0 } : p.lado === "n" ? { x: p.em, z: s.z1 } : p.lado === "o" ? { x: s.x0, z: p.em } : { x: s.x1, z: p.em };
      expect(dentroDeParede(mundoU(l))).toBe(false);
    }
  });
  it("paredes e torres são sólidas pra quem anda; o pátio é livre", () => {
    const parede = mundoU({ x: 50, z: -UNIVERSIDADE.externa.meia }), q = resolverUniversidade(parede);
    expect(Math.abs(localU(q).z + UNIVERSIDADE.externa.meia)).toBeGreaterThan(1.5);
    const t = TORRES[0]!, qt = resolverUniversidade(mundoU(t)); expect(Math.hypot(localU(qt).x - t.x, localU(qt).z - t.z)).toBeGreaterThanOrEqual(t.r - 1e-6);
    const meioPatio = mundoU({ x: (PATIOS[0].x0 + PATIOS[0].x1) / 2, z: 30 }); expect(resolverUniversidade(meioPatio)).toEqual(meioPatio);
    const f = FONTES[0]!, qf = resolverUniversidade(mundoU({ x: f.x + 0.5, z: f.z })); expect(Math.hypot(localU(qf).x - f.x, localU(qf).z - f.z)).toBeCloseTo(f.r, 5);
    expect(resolverUniversidade({ x: 0, z: 0 })).toEqual({ x: 0, z: 0 });   // longe: não mexe
  });
  it("mochila (altura relativa ao disco): acima da muralha passa; as salas são a céu aberto (sobe e sai por cima)", () => {
    const sobreMuralha = mundoU({ x: 50, z: -UNIVERSIDADE.externa.meia });
    expect(resolverUniversidadeNoAr(sobreMuralha, UNIVERSIDADE.externa.alt + 1)).toMatchObject(sobreMuralha);
    const salao = SALAS.find((s) => s.tipo === "salao")!, meio = mundoU({ x: 0, z: 0 });
    expect(resolverUniversidadeNoAr(meio, salao.alt + 3)).toEqual(meio);   // sem teto: em cima da sala, fica onde está
    expect(salaEm(localU(resolverUniversidadeNoAr(meio, 4)))).not.toBeNull();
  });
  it("flutua um pouco abaixo da Zaeon; o disco cobre o castelo inteiro (cantos das muralhas)", () => {
    expect(UNIVERSIDADE.y).toBeLessThan(CIDADE.pisoY); expect(UNIVERSIDADE.y).toBeGreaterThan(CIDADE.pisoY - 100);
    expect(UNIVERSIDADE.discoR).toBeGreaterThan(Math.hypot(UNIVERSIDADE.externa.meia, UNIVERSIDADE.externa.meia) + 1);
    for (const a of ARVORES) expect(Math.hypot(a.x, a.z)).toBeLessThan(UNIVERSIDADE.discoR - 2);   // a avenida cabe no disco
  });
  it("a nave/moto: o disco é sólido (pousa em cima), as torres também (e a torre central é a mais alta)", () => {
    const ps = pilaresDaUniversidade(); expect(ps).toHaveLength(TORRES.length + 2);
    const disco = ps[0]!; expect(disco.r).toBe(UNIVERSIDADE.discoR); expect(disco.topo).toBe(UNIVERSIDADE.y); expect(disco.base).toBeLessThan(UNIVERSIDADE.y);
    expect(Math.max(...ps.map((p) => p.topo))).toBe(UNIVERSIDADE.y + UNIVERSIDADE.torreCentral.alt + UNIVERSIDADE.torreCentral.pinaculo);
  });
  it("móveis: dentro das salas, sem tampar as portas (sobra passagem de ≥ 1,2 m na frente de cada porta)", () => {
    for (const s of SALAS) {
      const ms = moveisDaSala(s);
      for (const m of ms) { expect(m.x0).toBeGreaterThan(s.x0); expect(m.x1).toBeLessThan(s.x1); expect(m.z0).toBeGreaterThan(s.z0); expect(m.z1).toBeLessThan(s.z1); }
      for (const p of s.portas) {
        const dentro = p.lado === "s" ? { x: p.em, z: s.z0 + 1.2 } : p.lado === "n" ? { x: p.em, z: s.z1 - 1.2 } : p.lado === "o" ? { x: s.x0 + 1.2, z: p.em } : { x: s.x1 - 1.2, z: p.em };
        expect(ms.some((m) => dentro.x > m.x0 - 0.45 && dentro.x < m.x1 + 0.45 && dentro.z > m.z0 - 0.45 && dentro.z < m.z1 + 0.45)).toBe(false);
      }
    }
    expect(moveisDaSala(SALAS.find((s) => s.tipo === "salao")!).filter((m) => m.tipo === "mesa")).toHaveLength(4);
  });
  it("salas de estudo: computadores, cadeiras, estantes e mesas — e as estantes não tampam as portas", () => {
    for (const s of SALAS.filter((x) => x.tipo === "estudo")) {
      const ms = moveisDaSala(s), tipos = ms.map((m) => m.tipo);
      expect(tipos).toEqual(expect.arrayContaining(["pc", "cadeira", "estante", "mesa"]));
      expect(ms.filter((m) => m.tipo === "cadeira").length).toBeGreaterThan(20);
    }
  });
  it("sem natureza (holograma): nenhuma árvore, sebe ou plantação — e os pátios continuam livres pra andar", () => {
    expect(CAMPOS).toHaveLength(0); expect(ARVORES).toHaveLength(0); expect(SEBES).toHaveLength(0);
    // dá pra entrar nos pátios pelos vãos das sebes (meio do lado sul)
    for (const p of PATIOS) expect(resolverUniversidade(mundoU({ x: (p.x0 + p.x1) / 2, z: p.z0 + 3 }))).toEqual(mundoU({ x: (p.x0 + p.x1) / 2, z: p.z0 + 3 }));
  });
});

