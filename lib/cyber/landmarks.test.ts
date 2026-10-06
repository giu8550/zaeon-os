import { NAVE_QG, paraLocal, poseDaDoca } from "./naveQG";
import { describe, expect, it } from "vitest";
import { HELIPORTO, POIS, baseLivreDosPOIs, bordaDoPOI, colisoresDosPOIs, landmarksOn, marcoNav, poiPerto, type POI } from "./landmarks";
import { BASES_CEU_LOCAIS, BASE_COLLIDER_R, BASE_PLATAFORMA_R, baseNoCeu, baseNoQG, basesDosMembros, localParaMundo, posicaoDaBase, spawnDaBase } from "./bases";
import { CIDADE, colisoresDaCidade, mundo, noPortalEntrada, noPortalVolta } from "./ceu";
import { empurrarParaFora, dentroDeAlgum } from "./colisao";
import { decidirClique } from "./clique";
import { PE_DA_ESCADA, alturaEm, colisoresDoAlto, deEscada, escadaLocal, muralhaTemBloco, resolverPasso } from "./nav";

const zaeon = POIS.find((p) => p.id === "zaeon")!;
const m = marcoNav(zaeon)!;
const BH = { x: 0, z: -110 };   // buraco negro (CenaCosmica)

describe("registro de POIs", () => {
  it("o QG do Andrei (antiga Zaeon do chão): maior/mais alto que o protótipo, andável, topo do dono, sem link", () => {
    expect(zaeon).toMatchObject({ nome: "QG do Andrei", preset: "zaeon", acesso: "dono", topo: { y: 6.6 } });
    expect(zaeon.link).toBeUndefined();
    expect(zaeon.escala!).toBeGreaterThan(1);
    expect(zaeon.altura).toBeGreaterThan(7);
    expect(zaeon.nav!.pisoY).toBeGreaterThan(zaeon.altura);
    expect(zaeon.interactR).toBeGreaterThan(zaeon.footprintR);
  });
  it("afastada do eixo do buraco negro (não fica atrás dele na tela) e da praça", () => {
    const angZ = Math.atan2(zaeon.x, -zaeon.z), angBH = Math.atan2(BH.x, -BH.z);
    expect(Math.abs(angZ - angBH)).toBeGreaterThan(0.4);
    expect(Math.hypot(zaeon.x, zaeon.z)).toBeGreaterThan(zaeon.footprintR + 20);
  });
  it("ids únicos; um colisor por POI no raio sólido", () => {
    expect(new Set(POIS.map((p) => p.id)).size).toBe(POIS.length);
    expect(colisoresDosPOIs()).toEqual([{ x: zaeon.x, z: zaeon.z, r: zaeon.footprintR }]);
  });
  it("escala por dados: um 2º POI genérico é só mais uma entrada", () => {
    const outro: POI = { id: "teste", nome: "Teste", org: "x", preset: "generico", x: 40, z: 10, footprintR: 4, interactR: 7, altura: 3, acesso: "publico" };
    expect(colisoresDosPOIs([...POIS, outro])).toHaveLength(2);
    expect(poiPerto({ x: 41, z: 10 }, [...POIS, outro])?.id).toBe("teste");
    expect(marcoNav(outro)).toBeNull();
  });
});

describe("proximidade e aproximação", () => {
  it("rótulo/clique só dentro do interactR", () => {
    expect(poiPerto({ x: zaeon.x, z: zaeon.z + zaeon.interactR - 1 })?.id).toBe("zaeon");
    expect(poiPerto({ x: zaeon.x, z: zaeon.z + zaeon.interactR + 1 })).toBeNull();
    expect(poiPerto({ x: 0, z: 0 })).toBeNull();
  });
  it("aproximar leva pra borda, fora do colisor, do lado de quem chega", () => {
    const b = bordaDoPOI(zaeon, { x: 0, z: 0 });
    expect(dentroDeAlgum(b, colisoresDosPOIs())).toBe(false);
    expect(poiPerto(b)?.id).toBe("zaeon");
  });
  it("colisor do chão empurra pra borda (desliza)", () => {
    const p = empurrarParaFora({ x: zaeon.x + 1, z: zaeon.z + 3 }, colisoresDosPOIs());
    expect(Math.hypot(p.x - zaeon.x, p.z - zaeon.z)).toBeCloseTo(zaeon.footprintR, 6);
  });
});

describe("POIs × bases (sem brigar com o anel, a escada nem o spawn)", () => {
  it("o 1º anel (praça) e os spawns ficam longe da Zaeon e da escada", () => {
    for (let i = 0; i < 5; i++) { const b = posicaoDaBase(i); expect(baseLivreDosPOIs(b, BASE_PLATAFORMA_R)).toBe(true); expect(poiPerto(spawnDaBase(b))).toBeNull(); }
  });
  it("salas grandes: nenhuma base cai na ilha nem na escada (slots conflitantes são pulados)", () => {
    const ids = Array.from({ length: 40 }, (_, i) => `u${i}`);
    for (const b of basesDosMembros(ids).values()) expect(baseLivreDosPOIs(b, BASE_PLATAFORMA_R, POIS, 0)).toBe(true);
  });
  it("o pé da escada fica no chão da praça, virado pra ela", () => {
    const pe = deEscada(m, m.nav.bordaR + m.nav.escada.comprimento, 0);
    expect(Math.hypot(pe.x, pe.z)).toBeLessThan(Math.hypot(zaeon.x, zaeon.z));
    expect(alturaEm(m, pe)).toBeCloseTo(0, 6);
  });
});

describe("navegação: escada + plataforma", () => {
  const pe = (lat = 0, frac = 0.97) => deEscada(m, m.nav.bordaR + m.nav.escada.comprimento * frac, lat);
  it("do chão, entra na escada pelo PÉ", () => {
    const r = resolverPasso(m, false, pe(0, 1.02), pe(0, 0.97));
    expect(r.alto).toBe(true); expect(r.y).toBeGreaterThan(0); expect(r.y).toBeLessThan(1);
  });
  it("do chão, NÃO entra pelos lados no meio da escada (corpo sólido)", () => {
    const meio = deEscada(m, m.nav.bordaR + m.nav.escada.comprimento * 0.5, 0);
    const r = resolverPasso(m, false, deEscada(m, m.nav.bordaR + m.nav.escada.comprimento * 0.5, 5), meio);
    expect(r.alto).toBe(false); expect(r.y).toBe(0);
    expect(Math.abs(escadaLocal(m, r).lat)).toBeGreaterThan(m.nav.escada.largura / 2);
  });
  it("do chão, não anda por baixo da ilha", () => {
    const r = resolverPasso(m, false, { x: zaeon.x + 20, z: zaeon.z }, { x: zaeon.x + 5, z: zaeon.z });
    expect(Math.hypot(r.x - zaeon.x, r.z - zaeon.z)).toBeGreaterThan(m.nav.bordaR);
    expect(r.alto).toBe(false);
  });
  it("subir: a altura cresce até o piso e, passando a borda, está na plataforma", () => {
    let pos = pe(0, 0.97), alto = true, y = 0; const ys: number[] = [];
    for (let f = 0.95; f >= -0.1; f -= 0.05) { const r = resolverPasso(m, alto, pos, deEscada(m, m.nav.bordaR + m.nav.escada.comprimento * f, 0)); pos = r; alto = r.alto; y = r.y; ys.push(y); }
    expect(alto).toBe(true);
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeGreaterThanOrEqual(ys[i - 1]! - 1e-9);
    expect(y).toBeCloseTo(m.nav.pisoY, 6);
    const dentro = resolverPasso(m, true, pos, deEscada(m, m.nav.bordaR - 2, 0));
    expect(dentro).toMatchObject({ alto: true, y: m.nav.pisoY });
  });
  it("descer: no pé volta pro chão", () => {
    const r = resolverPasso(m, true, pe(0, 0.98), pe(0, 1.01));
    expect(r).toMatchObject({ alto: false, y: 0 });
  });
  it("na escada não cai pelos lados (clamp lateral)", () => {
    const r = resolverPasso(m, true, pe(0, 0.5), pe(m.nav.escada.largura / 2 + 0.2, 0.5));
    expect(r.alto).toBe(true);
    expect(Math.abs(escadaLocal(m, r).lat)).toBeLessThan(m.nav.escada.largura / 2);
  });
  it("muralhas sólidas, PORTÃO aberto alinhado à escada", () => {
    const portao = deEscada(m, m.nav.muralhaR, 0);
    expect(dentroDeAlgum(portao, colisoresDoAlto(m))).toBe(false);
    const ladoOposto = deEscada(m, -m.nav.muralhaR, 0);
    expect(dentroDeAlgum(ladoOposto, colisoresDoAlto(m))).toBe(true);
    const tem = Array.from({ length: m.nav.muralhaN }, (_, i) => muralhaTemBloco(m, i));
    expect(tem.filter((x) => !x).length).toBeGreaterThanOrEqual(1);
    expect(tem.filter(Boolean).length).toBeGreaterThan(10);
  });
  it("pilares da casa de cristal são sólidos; não cai da borda da plataforma", () => {
    const pilar = { x: zaeon.x + m.nav.pilares.r, z: zaeon.z };
    const r = resolverPasso(m, true, { x: zaeon.x + m.nav.pilares.r - 2, z: zaeon.z }, pilar);
    expect(Math.hypot(r.x - pilar.x, r.z - pilar.z)).toBeGreaterThanOrEqual(m.nav.pilares.colR - 1e-6);
    const fora = deEscada(m, -(m.nav.bordaR + 3), 0);
    const r2 = resolverPasso(m, true, deEscada(m, -(m.nav.bordaR - 1), 0), fora);
    expect(Math.hypot(r2.x - zaeon.x, r2.z - zaeon.z)).toBeLessThan(m.nav.bordaR);
    expect(r2.alto).toBe(true);
  });
  it("altura sem estado (remotos): chão 0, escada rampa, plataforma piso", () => {
    expect(alturaEm(m, { x: 0, z: 0 })).toBe(0);
    expect(alturaEm(m, deEscada(m, m.nav.bordaR + m.nav.escada.comprimento / 2, 0))).toBeCloseTo(m.nav.pisoY / 2, 6);
    expect(alturaEm(m, { x: zaeon.x, z: zaeon.z })).toBe(m.nav.pisoY);
    expect(PE_DA_ESCADA).toBeGreaterThan(0.5);
  });
});

describe("clique no marco", () => {
  const o = { noMonitor: false, baseMinha: false, pertoDaBase: false, noColega: false, colegaPerto: false };
  it("perto → landmark; longe → aproxima; monitor e colega têm prioridade", () => {
    expect(decidirClique({ ...o, noLandmark: true, landmarkPerto: true })).toBe("landmark");
    expect(decidirClique({ ...o, noLandmark: true, landmarkPerto: false })).toBe("aproximar-landmark");
    expect(decidirClique({ ...o, noLandmark: true, landmarkPerto: true, noColega: true, colegaPerto: true })).toBe("colega");
    expect(decidirClique({ ...o, noLandmark: true, landmarkPerto: true, noMonitor: true, baseMinha: true, pertoDaBase: true })).toBe("monitor");
    expect(decidirClique(o)).toBe("chao");
  });
});

describe("flag de render", () => {
  it("ligada em dev por padrão; desligada em produção sem a flag; a flag manda", () => {
    expect(landmarksOn({ nodeEnv: "development" })).toBe(true);
    expect(landmarksOn({ nodeEnv: "production" })).toBe(false);
    expect(landmarksOn({ flag: "1", nodeEnv: "production" })).toBe(true);
    expect(landmarksOn({ flag: "0", nodeEnv: "development" })).toBe(false);
  });
});

describe("simulação quadro a quadro (WASD 'por nós mesmos'): subir e descer sem saltos", () => {
  const ax = Math.cos(m.nav.escada.dir), az = Math.sin(m.nav.escada.dir);
  /** anda `seg` segundos na direção (dx,dz) a `v` m/s, 60 fps, como o engine (prev → prop → resolverPasso) */
  function andar(ini: { x: number; z: number; alto: boolean; y: number }, dx: number, dz: number, seg: number, v = 4) {
    let s = { ...ini }; let maiorPasso = 0; const n = Math.round(seg * 60), dt = 1 / 60, k = Math.hypot(dx, dz);
    for (let i = 0; i < n; i++) {
      const prop = { x: s.x + (dx / k) * v * dt, z: s.z + (dz / k) * v * dt };
      const r = resolverPasso(m, s.alto, s, prop);
      maiorPasso = Math.max(maiorPasso, Math.hypot(r.x - s.x, r.z - s.z), Math.abs(r.y - s.y) / 2);
      s = { x: r.x, z: r.z, alto: r.alto, y: r.y };
    }
    return { s, maiorPasso };
  }
  const longeDoPe = deEscada(m, m.nav.bordaR + m.nav.escada.comprimento + 3, 0);
  it("da praça até a plataforma e de volta ao chão, sem nenhum salto", () => {
    const sobe = andar({ ...longeDoPe, alto: false, y: 0 }, -ax, -az, 12);
    expect(sobe.s.alto).toBe(true);
    expect(sobe.s.y).toBeCloseTo(m.nav.pisoY, 6);
    expect(sobe.maiorPasso).toBeLessThan(0.2);   // 4 m/s a 60 fps ≈ 0,067 por quadro
    const desce = andar(sobe.s, ax, az, 14);
    expect(desce.s.alto).toBe(false);
    expect(desce.s.y).toBe(0);
    expect(desce.maiorPasso).toBeLessThan(0.2);
  });
  it("entrando em diagonal pelo pé (e até 'um pouco além do fim'), ainda sem salto", () => {
    for (const lat of [-1.8, 0, 1.8]) {
      const ini = deEscada(m, m.nav.bordaR + m.nav.escada.comprimento + 0.25, lat);
      const r = andar({ ...ini, alto: false, y: 0 }, -ax + 0.08, -az, 3);
      expect(r.maiorPasso).toBeLessThan(0.2);
    }
  });
  it("correndo (7,5 m/s) também não salta", () => {
    const r = andar({ ...longeDoPe, alto: false, y: 0 }, -ax, -az, 7, 7.5);
    expect(r.maiorPasso).toBeLessThan(0.3);
    expect(r.s.alto).toBe(true);
  });
  it("na plataforma, dá pra voltar pela boca da escada e descer", () => {
    const dentro = deEscada(m, m.nav.muralhaR - 2.5, 0);
    const r = andar({ ...dentro, alto: true, y: m.nav.pisoY }, ax, az, 12);
    expect(r.s.alto).toBe(false);
    expect(r.maiorPasso).toBeLessThan(0.2);
  });
  it("correndo pela plataforma em 8 direções, batendo nas muralhas, nunca salta nem sai do alto", () => {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const r = andar({ x: zaeon.x, z: zaeon.z + 0.5, alto: true, y: m.nav.pisoY }, Math.cos(a), Math.sin(a), 10, 7.5);
      expect(r.maiorPasso).toBeLessThan(0.3);
      // a não ser que tenha saído pela boca da escada, continua na plataforma
      if (r.s.alto && escadaLocal(m, r.s).u < 0) expect(Math.hypot(r.s.x - zaeon.x, r.s.z - zaeon.z)).toBeLessThanOrEqual(m.nav.bordaR);
    }
  });
});

describe("heliporto (pouso perto da praça)", () => {
  const heli = POIS.find((p) => p.id === "heliporto")!;
  it("plano e andável (não colide), perto da praça e longe do QG, da escada e do portal", () => {
    expect(colisoresDosPOIs().some((c) => c.x === HELIPORTO.x && c.z === HELIPORTO.z)).toBe(false);
    const d = Math.hypot(HELIPORTO.x, HELIPORTO.z); expect(d).toBeGreaterThan(20); expect(d).toBeLessThan(45);
    expect(baseLivreDosPOIs(HELIPORTO, HELIPORTO.r, POIS.filter((p) => p.id !== "heliporto"))).toBe(true);   // fora da Zaeon/escada
    expect(noPortalEntrada(HELIPORTO)).toBe(false);
    expect(poiPerto(HELIPORTO)?.id).toBe("heliporto");
    expect(heli.acesso).toBe("publico");
  });
  it("o 1º anel (praça) fica livre e as bases das salas grandes desviam do heliporto", () => {
    for (let i = 0; i < 5; i++) expect(baseLivreDosPOIs(posicaoDaBase(i), BASE_PLATAFORMA_R)).toBe(true);
    const ids = Array.from({ length: 60 }, (_, i) => String(i).padStart(24, "0"));
    for (const b of basesDosMembros(ids).values()) expect(Math.hypot(b.x - HELIPORTO.x, b.z - HELIPORTO.z)).toBeGreaterThan(HELIPORTO.r + BASE_PLATAFORMA_R);
  });
});

describe("bases fora do chão: o dono na Zaeon (céu) e o Andrei no centro do QG", () => {
  const ids = Array.from({ length: 8 }, (_, i) => String(i).padStart(24, "0"));
  const dono = ids[3]!, andrei = ids[5]!;
  const m2 = basesDosMembros(ids, POIS, { ceu: [dono], qg: andrei });
  it("o dono fica na Zaeon, o Andrei no salão do QG; os outros no anel, sem buraco", () => {
    expect(m2.get(dono)).toEqual(baseNoCeu(0)); expect(m2.get(dono)!.nivel).toBe("ceu");
    expect(m2.get(andrei)).toEqual(baseNoQG()); expect(m2.get(andrei)!.nivel).toBe("qg");
    const anel = ids.filter((id) => id !== dono && id !== andrei).map((id) => m2.get(id)!);
    expect(anel.every((l) => !l.nivel)).toBe(true);
    expect(anel[0]).toEqual(posicaoDaBase(0)); expect(anel[1]).toEqual(posicaoDaBase(1));   // os slots do anel não sobram
  });
  it("sem especiais = tudo no anel (marcos desligados)", () => {
    expect([...basesDosMembros(ids).values()].every((l) => !l.nivel)).toBe(true);
  });
  it("a base da Zaeon: dentro da área andável, livre da cidadela, da doca da nave e dos portais; virada pro centro", () => {
    const cs = colisoresDaCidade();
    BASES_CEU_LOCAIS.forEach((l, i) => {
      const b = baseNoCeu(i), w = mundo(l);
      expect(Math.hypot(l.x, l.z) + BASE_PLATAFORMA_R).toBeLessThan(CIDADE.andavelR);
      for (const c of cs) expect(Math.hypot(w.x - c.x, w.z - c.z)).toBeGreaterThan(c.r + BASE_COLLIDER_R);
      const doca = paraLocal(poseDaDoca(), w); expect(Math.hypot(doca.x, doca.z)).toBeGreaterThan(NAVE_QG.raio + BASE_PLATAFORMA_R);   // fora do casco da nave atracada
      expect(noPortalVolta(w)).toBe(false); expect(noPortalVolta(spawnDaBase(b))).toBe(false);
      const frente = localParaMundo(b, 0, 1);   // +z local aponta pro centro da ilha
      expect(Math.hypot(frente.x - CIDADE.centro.x, frente.z - CIDADE.centro.z)).toBeLessThan(Math.hypot(w.x - CIDADE.centro.x, w.z - CIDADE.centro.z));
    });
  });
  it("a base do QG: no centro do salão, entre os pilares, virada pro portão; o spawn fica no salão", () => {
    const b = baseNoQG()!;
    expect(b).toMatchObject({ x: zaeon.x, z: zaeon.z, nivel: "qg" });
    expect(BASE_PLATAFORMA_R).toBeLessThan(m.nav.pilares.r - m.nav.pilares.colR);
    const sp = spawnDaBase(b);
    expect(alturaEm(m, sp)).toBe(m.nav.pisoY);   // nasce no piso do salão
    expect(dentroDeAlgum(sp, colisoresDoAlto(m))).toBe(false);
    const e = escadaLocal(m, localParaMundo(b, 0, 1)); expect(e.along).toBeGreaterThan(0);   // +z local → portão/escada
  });
});
