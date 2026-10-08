import { describe, expect, it } from "vitest";
import { IDS_PLATAFORMAS, PLATAFORMAS, alturaDoAndar, andarDoPouso, andarNaPlataforma, decolaDaPlataforma, elevadorAqui, noArNaPlataforma, noPortalDaPlataforma, pilaresDasPlataformas, plataformaPerto, pousosNaPlataforma } from "./plataformas";
import { ANDARES_SOLANA, NOMES_ANDARES, ROOFTOP, SOLANA, moveisDoAndar, mundoS, paredesDoAndar, resolverNoAndar, ESCALA_SOLANA } from "./solana";
import { CIDADE } from "./ceu";
import { PRACA } from "./praca";
import { VOO, passoVooSub, type EstadoVoo } from "./voo";

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe("lugares flutuantes (Universidade e Solana House)", () => {
  it("flutuam abaixo da Zaeon, longe uns dos outros, da Zaeon e da ilha da praça", () => {
    const zaeon = { x: CIDADE.centro.x, z: CIDADE.centro.z, r: CIDADE.bordaR };
    for (const id of IDS_PLATAFORMAS) {
      const P = PLATAFORMAS[id];
      expect(P.y).toBeLessThan(CIDADE.pisoY); expect(P.y).toBeGreaterThan(60);
      expect(dist(P.centro, zaeon)).toBeGreaterThan(P.r + zaeon.r + 40);
      expect(Math.hypot(P.centro.x, P.centro.z) + P.r).toBeLessThan(VOO.raioMapa + 60);
    }
    expect(dist(PLATAFORMAS.univ.centro, PLATAFORMAS.solana.centro)).toBeGreaterThan(PLATAFORMAS.univ.r + PLATAFORMAS.solana.r + 20);
    expect(PLATAFORMAS.solana.y).toBeGreaterThan(PLATAFORMAS.univ.y);   // a Solana cresceu e subiu: mais alta que a UNILAB
    for (const id of IDS_PLATAFORMAS) expect(dist(PLATAFORMAS[id].centro, PRACA)).toBeGreaterThan(PLATAFORMAS[id].r + PRACA.r + 20);
  });
  it("o BURACO NEGRO de cada lugar fica no disco (chão firme, fora de prédio); a chegada fica FORA do anel (não volta a disparar)", () => {
    for (const id of IDS_PLATAFORMAS) {
      const P = PLATAFORMAS[id];
      expect(noPortalDaPlataforma(id, P.portal)).toBe(true); expect(noPortalDaPlataforma(id, P.chegada)).toBe(false);
      expect(andarNaPlataforma(id, 0, P.chegada).fora).toBe(false);   // a chegada é chão firme
      expect(andarNaPlataforma(id, 0, P.portal)).toMatchObject({ x: P.portal.x, z: P.portal.z, fora: false });   // nada empurra de cima do anel
      expect(dist(P.portal, P.centro) + P.portal.r).toBeLessThan(P.r);
    }
  });
  it("a borda do disco é livre: passou, cai (sem parede invisível)", () => {
    for (const id of IDS_PLATAFORMAS) {
      const P = PLATAFORMAS[id], beira = { x: P.centro.x + P.r + 0.5, z: P.centro.z };
      expect(andarNaPlataforma(id, 0, beira).fora).toBe(true);
      expect(andarNaPlataforma(id, 0, { x: P.centro.x + P.r - 6, z: P.centro.z }).fora).toBe(false);
    }
  });
  it("mochila: a 'bolha' de cada lugar, e o pouso no disco vindo de cima", () => {
    const U = PLATAFORMAS.univ;
    expect(plataformaPerto(U.chegada, U.y + 5)).toBe("univ");
    expect(plataformaPerto(U.chegada, 0)).toBeNull();          // lá embaixo (no vazio, na altura da praça): não
    expect(pousosNaPlataforma("univ", U.chegada)).toEqual([0]);
    expect(pousosNaPlataforma("univ", { x: U.centro.x + U.r + 2, z: U.centro.z })).toEqual([]);
  });
  it("nave/moto: o disco é sólido — vindo de cima, pousa no piso dele", () => {
    const S = PLATAFORMAS.solana;
    let s: EstadoVoo = { x: S.chegada.x, y: S.y + 30, z: S.chegada.z, yaw: 0, vx: 0, vy: 0, vz: 0 }, r = passoVooSub(s, { wx: 0, wz: 0, subir: false, descer: true }, 0.1, pilaresDasPlataformas());
    for (let i = 0; i < 80 && !r.pousado; i++) { s = r.s; r = passoVooSub(s, { wx: 0, wz: 0, subir: false, descer: true }, 0.1, pilaresDasPlataformas()); }
    expect(r.pousado).toBe(true); expect(r.s.y).toBeCloseTo(S.y, 5);
  });
});

describe("Solana House (3 andares + rooftop)", () => {
  const S = SOLANA, P = S.predio, el = mundoS(S.elevador);
  it("o prédio cabe no disco, com a sacada e a chegada na frente", () => {
    for (const [x, z] of [[P.x0, S.sacada.z0], [P.x1, S.sacada.z0], [P.x0, P.z1], [P.x1, P.z1]]) expect(Math.hypot(x!, z!)).toBeLessThan(S.r - 2);
    expect(PLATAFORMAS.solana.chegada.z).toBeLessThan(S.centro.z + S.sacada.z0);
  });
  it("o ELEVADOR (F) passa por todos os andares e do rooftop volta pro térreo", () => {
    const vistos: string[] = []; let andar = 0;
    for (let k = 0; k < ANDARES_SOLANA.length; k++) { const e = elevadorAqui("solana", andar, el)!; expect(e).not.toBeNull(); vistos.push(e.rotulo); andar = e.proximo; }
    expect(andar).toBe(0);
    expect(vistos).toEqual(NOMES_ANDARES.map((_, i) => `Elevador → ${NOMES_ANDARES[(i + 1) % NOMES_ANDARES.length]}`));
    expect(elevadorAqui("solana", 0, mundoS({ x: 0, z: 5 }))).toBeNull();   // longe do tubo
    expect(elevadorAqui("univ", 0, el)).toBeNull();
  });
  it("em cada andar dá pra ir da entrada (porta / sacada) até o elevador sem móvel no caminho", () => {
    const livre = (andar: number, x: number, z: number) => !moveisDoAndar(andar).some((m) => m.solido !== false && x > m.x0 - 0.45 && x < m.x1 + 0.45 && z > m.z0 - 0.45 && z < m.z1 + 0.45);
    for (let andar = 0; andar < ANDARES_SOLANA.length; andar++) {
      // corredor: pelo lado leste (a planta escalada), da frente até o elevador
      for (let z = P.z0 + 0.6; z <= S.elevador.z; z += 0.25) expect(livre(andar, 10.6 * ESCALA_SOLANA, z)).toBe(true);
      expect(livre(andar, S.elevador.x, S.elevador.z)).toBe(true);
    }
    // a porta do térreo está aberta (sem parede no meio dela)
    const q = resolverNoAndar(0, { x: 0, z: P.z0 }); expect(Math.abs(q.z - P.z0)).toBeLessThan(0.01);
  });
  it("paredes: no térreo a fachada sul só abre na porta; em cima abre pra sacada, que tem guarda-corpo (não se cai)", () => {
    const fora = resolverNoAndar(0, { x: 6, z: P.z0 }); expect(Math.abs(fora.z - P.z0)).toBeGreaterThan(0.4);   // parede ao lado da porta
    const sacada = resolverNoAndar(1, { x: 0, z: S.sacada.z0 - 0.5 });   // passou do guarda-corpo → segura na sacada
    expect(sacada.z).toBeGreaterThan(S.sacada.z0); expect(sacada.fora).toBe(false);
    expect(resolverNoAndar(ROOFTOP, { x: 0, z: P.z0 - 2 }).z).toBeGreaterThan(P.z0);   // parapeito do rooftop
    expect(paredesDoAndar(ROOFTOP).every((w) => w.alt === S.guardaCorpo)).toBe(true);
  });
  it("rooftop: piscina (sólida, não se anda dentro), bar e lounge", () => {
    const tipos = moveisDoAndar(ROOFTOP).map((m) => m.tipo);
    expect(tipos).toEqual(expect.arrayContaining(["piscina", "bar", "espreguicadeira", "sofa", "dj"]));
    const meio = { x: (S.piscina.x0 + S.piscina.x1) / 2, z: (S.piscina.z0 + S.piscina.z1) / 2 }, q = resolverNoAndar(ROOFTOP, meio);
    expect(q.x > S.piscina.x0 && q.x < S.piscina.x1 && q.z > S.piscina.z0 && q.z < S.piscina.z1).toBe(false);
  });
  it("pouso de mochila: no prédio só no rooftop; na sacada, na sacada de cima primeiro; no terraço, no disco", () => {
    expect(pousosNaPlataforma("solana", mundoS({ x: 0, z: 6 }))).toEqual([ANDARES_SOLANA[ROOFTOP]]);
    expect(pousosNaPlataforma("solana", mundoS({ x: 0, z: -4 }))).toEqual([ANDARES_SOLANA[2], ANDARES_SOLANA[1], 0]);
    expect(pousosNaPlataforma("solana", mundoS({ x: 0, z: -15 }))).toEqual([0]);
    expect(andarDoPouso("solana", ANDARES_SOLANA[ROOFTOP])).toBe(ROOFTOP); expect(alturaDoAndar("solana", 2)).toBe(ANDARES_SOLANA[2]);
  });
  it("mochila: dentro de casa não decola; do rooftop, da sacada e do terraço sim; o prédio é sólido por fora", () => {
    expect(decolaDaPlataforma("solana", 1, mundoS({ x: 0, z: 6 }))).toBe(false);
    expect(decolaDaPlataforma("solana", 0, mundoS({ x: 0, z: 6 }))).toBe(false);
    expect(decolaDaPlataforma("solana", ROOFTOP, mundoS({ x: 0, z: 6 }))).toBe(true);
    expect(decolaDaPlataforma("solana", 1, mundoS({ x: 0, z: -4 }))).toBe(true);
    expect(decolaDaPlataforma("solana", 0, mundoS({ x: 0, z: -15 }))).toBe(true);
    const encostado = noArNaPlataforma("solana", mundoS({ x: 0, z: 3 }), 6, 6);   // voando a 6 m "dentro" da parede → empurrado pra fora
    expect(encostado.z - S.centro.z < P.z0 || encostado.x - S.centro.x < P.x0 || encostado.x - S.centro.x > P.x1 || encostado.z - S.centro.z > P.z1).toBe(true);
    const topo = ANDARES_SOLANA[ROOFTOP], descendoNoTeto = noArNaPlataforma("solana", mundoS({ x: 0, z: 3 }), topo + 0.2, topo + 0.4); expect(descendoNoTeto).toEqual(mundoS({ x: 0, z: 3 }));
  });
});
