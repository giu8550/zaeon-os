import { describe, expect, it } from "vitest";
import { BURACO_NEGRO, CIDADE, chaoDaNave, colisoresDaCidade, computadorPerto, computadoresLocais, foraDaIlha, mundo, noPortalEntrada, noPortalVolta, resolverCidade, resolverCidadeLivre, naIlhaPrincipal, ilhotaEm, alturaIlhota, ILHOTAS, daSala, paredeDaSala, MOVEIS, PALCO, MESA_DJ, alturaNaCidade, naCabineDJ, naSala, pontoDaCabineDJ, rumoDoDJ, rotDaSala, ALTURA_LOUNGE, ESCADA_LOUNGE, inicioDaPonta, naEscadaLocal, pisoNoAr, LOUNGE_ANGULO, LOUNGE_MEIA_ABERTURA, DOCA_ANGULO, DOCA_MEIA_ABERTURA, type NomeSala } from "./ceu";
import { BASES_CEU_LOCAIS, BASE_COLLIDER_R, baseNoCeu, spawnDaBase } from "./bases";
import { vagas } from "./motos";
import { NAVE_QG, paraMundo, poseDaDoca } from "./naveQG";
import { VOO, passoVoo, type EstadoVoo } from "./voo";
import { dentroDeAlgum } from "./colisao";
import { POIS } from "./landmarks";

/** um pátio livre da ilha (local) — fora da capela, longe das bases, das motos e da escada do lounge */
const PATIO = { x: 102, z: 36 };

describe("cidade no céu", () => {
  it("flutua BEEEM alto e LONGE da praça: o céu da praça fica aberto (nem a ilha nem as ilhotas passam por cima dela)", () => {
    const praca = { x: 0, z: 0 }, alcance = CIDADE.bordaR + 30 + 2 * 16 + 20;   // a ilha + o anel de ilhotas
    expect(Math.hypot(praca.x - CIDADE.centro.x, praca.z - CIDADE.centro.z)).toBeGreaterThan(alcance);
    expect(Math.hypot(BURACO_NEGRO.x - CIDADE.centro.x, BURACO_NEGRO.z - CIDADE.centro.z)).toBeGreaterThan(alcance - 110);   // o portal fica perto da praça
    expect(CIDADE.pisoY - CIDADE.ilhaAltura).toBeGreaterThan(BURACO_NEGRO.y + 120);   // o fundo da ilha
    expect(VOO.yMax).toBeGreaterThan(CIDADE.pisoY + 40);                              // a nave sobrevoa por cima
  });
  it("é maior que a Zaeon do chão", () => {
    const z = POIS.find((p) => p.id === "zaeon")!;
    expect(CIDADE.bordaR).toBeGreaterThan(z.nav!.bordaR * 2);
  });
  it("portal de entrada no chão, embaixo do buraco negro; portal de volta na cidade", () => {
    expect(noPortalEntrada({ x: 0, z: -110 })).toBe(true);
    expect(noPortalEntrada({ x: 0, z: 0 })).toBe(false);
    expect(noPortalVolta(mundo(CIDADE.portalVolta))).toBe(true);
    expect(noPortalVolta(mundo(CIDADE.chegada))).toBe(false);   // chegar não te manda de volta
  });
  it("a chegada, o pátio (onde era o hangar) e o portal de volta ficam livres de colisores e dentro da área andável", () => {
    const cs = colisoresDaCidade();
    for (const l of [CIDADE.chegada, PATIO, CIDADE.portalVolta]) {
      expect(dentroDeAlgum(mundo(l), cs)).toBe(false);
      expect(Math.hypot(l.x, l.z)).toBeLessThan(CIDADE.andavelR);
    }
  });
  it("andar: desktops, pilares da capela e a mesa do globo são sólidos; não cai da borda", () => {
    const c0 = mundo(computadoresLocais()[0]!);
    const r = resolverCidade(c0);
    expect(Math.hypot(r.x - c0.x, r.z - c0.z)).toBeGreaterThanOrEqual(CIDADE.monitores.colR - 1e-6);
    const fora = resolverCidade(mundo({ x: CIDADE.bordaR - 4, z: 40 }));
    expect(Math.hypot(fora.x - CIDADE.centro.x, fora.z - CIDADE.centro.z)).toBeLessThanOrEqual(CIDADE.andavelR + 1e-6);
  });
  it("a capela: só o globo no meio e os DESKTOPS em volta dele (virados pro centro), com passagem entre eles", () => {
    const ms = computadoresLocais();
    expect(ms).toHaveLength(CIDADE.monitores.n);
    for (const m of ms) {
      expect(Math.hypot(m.x, m.z)).toBeCloseTo(CIDADE.monitores.r, 6);
      expect(Math.hypot(m.x, m.z) - CIDADE.monitores.colR).toBeGreaterThan(CIDADE.mesaHolo.r + 2);   // entre o globo e os pilares
      expect(Math.hypot(m.x, m.z) + CIDADE.monitores.colR).toBeLessThan(CIDADE.cidadela.r - 2);
      const frente = { x: m.x + Math.sin(m.rot), z: m.z + Math.cos(m.rot) };
      expect(Math.hypot(frente.x, frente.z)).toBeLessThan(Math.hypot(m.x, m.z));   // +z local (a tela) → centro
    }
    const a = (1 / CIDADE.monitores.n) * Math.PI * 2, vao = mundo({ x: Math.cos(a) * CIDADE.monitores.r, z: Math.sin(a) * CIDADE.monitores.r });
    expect(dentroDeAlgum(vao, colisoresDaCidade())).toBe(false);
  });
  it("desktop mais perto (pra clicar e estudar)", () => {
    const c3 = computadoresLocais()[3]!;
    const k = (CIDADE.monitores.r - 2.4) / CIDADE.monitores.r, perto = mundo({ x: c3.x * k, z: c3.z * k });   // na frente da tela
    expect(computadorPerto(perto)).toBe(3);
    expect(computadorPerto(mundo(CIDADE.chegada))).toBe(-1);
  });
  it("a ilha é sólida pra nave (pousa em cima; não atravessa por baixo nem pelo lado)", () => {
    const meio = { ...mundo({ x: 5, z: 0 }), y: CIDADE.pisoY - 2 };
    expect(foraDaIlha(meio).y).toBe(CIDADE.pisoY);
    const embaixo = { ...mundo({ x: 5, z: 0 }), y: CIDADE.pisoY - CIDADE.ilhaAltura + 1 };
    expect(foraDaIlha(embaixo).y).toBe(CIDADE.pisoY - CIDADE.ilhaAltura);
    expect(chaoDaNave({ ...mundo({ x: 0, z: 0 }), y: CIDADE.pisoY + 3 })).toBe(CIDADE.pisoY);
    expect(chaoDaNave({ x: 0, y: 10, z: 0 })).toBe(0);
  });
  it("a agulha embaixo do ápice: afiada, sólida e ainda bem acima do buraco negro", () => {
    const fundo = CIDADE.pisoY - CIDADE.ilhaAltura - CIDADE.agulha.altura;
    expect(fundo).toBeGreaterThan(BURACO_NEGRO.y + 90);
    expect(CIDADE.agulha.r).toBeLessThan(CIDADE.bordaR / 4);
    const dentro = { ...mundo({ x: 1, z: 0 }), y: fundo + 20 };
    const q = foraDaIlha(dentro);
    expect(Math.hypot(q.x - CIDADE.centro.x, q.z - CIDADE.centro.z)).toBeCloseTo(CIDADE.agulha.r, 6);   // desliza pra fora
    expect(foraDaIlha({ ...mundo({ x: 1, z: 0 }), y: fundo + 0.5 }).y).toBe(fundo);                     // de baixo: para na ponta
    const lado = CIDADE.agulha.r + 5;
    expect(foraDaIlha({ ...mundo({ x: lado, z: 0 }), y: fundo + 20 })).toEqual({ ...mundo({ x: lado, z: 0 }), y: fundo + 20 });   // fora dela: livre
  });
});

describe("voo da nave", () => {
  const parada: EstadoVoo = { ...mundo(PATIO), y: CIDADE.pisoY, yaw: 0, vx: 0, vy: 0, vz: 0 };
  const voar = (s: EstadoVoo, cmd: Parameters<typeof passoVoo>[1], seg: number) => { let r = { s, pousado: true, chaoY: 0 }; for (let i = 0; i < seg * 60; i++) r = passoVoo(r.s, cmd, 1 / 60); return r; };
  it("decola da ilha, sobrevoa e pousa no chão do mapa", () => {
    const sobe = voar(parada, { wx: 0, wz: 0, subir: true, descer: false }, 2);
    expect(sobe.pousado).toBe(false); expect(sobe.s.y).toBeGreaterThan(CIDADE.pisoY + 5);
    const sai = voar(sobe.s, { wx: 0, wz: 1, subir: false, descer: false }, 12);   // vai pra +z (rumo à praça) — a Zaeon mega é larga
    expect(Math.hypot(sai.s.x - CIDADE.centro.x, sai.s.z - CIDADE.centro.z)).toBeGreaterThan(CIDADE.bordaR);
    const desce = voar(sai.s, { wx: 0, wz: 0, subir: false, descer: true }, 40);   // (e alta: 450 m)
    expect(desce.pousado).toBe(true); expect(desce.s.y).toBe(0); expect(desce.chaoY).toBe(0);
  });
  it("não sai do mapa nem passa do teto", () => {
    const r = voar({ x: 0, y: VOO.yMax - 5, z: 0, yaw: 0, vx: 0, vy: 0, vz: 0 }, { wx: 1, wz: 0, subir: true, descer: false }, 30);
    expect(Math.hypot(r.s.x, r.s.z)).toBeLessThanOrEqual(VOO.raioMapa + 1e-6);
    expect(r.s.y).toBeLessThanOrEqual(VOO.yMax);
  });
  it("pousa de volta na cidade (no piso), não atravessa a ilha", () => {
    const acima = { ...mundo({ x: 10, z: 0 }), y: CIDADE.pisoY + 20, yaw: 0, vx: 0, vy: 0, vz: 0 };
    const r = voar(acima, { wx: 0, wz: 0, subir: false, descer: true }, 5);
    expect(r.pousado).toBe(true); expect(r.s.y).toBe(CIDADE.pisoY);
  });
  it("marcos sólidos (Zaeon) desviam a nave", () => {
    const z = POIS.find((p) => p.id === "zaeon")!;
    const pilar = { x: z.x, z: z.z, r: z.nav!.bordaR, topo: z.nav!.pisoY + 8 };
    let s: EstadoVoo = { x: z.x + 30, y: 5, z: z.z, yaw: 0, vx: 0, vy: 0, vz: 0 };
    for (let i = 0; i < 400; i++) s = passoVoo(s, { wx: -1, wz: 0, subir: false, descer: false }, 1 / 60, [pilar]).s;
    expect(Math.hypot(s.x - z.x, s.z - z.z)).toBeGreaterThanOrEqual(z.nav!.bordaR - 1e-6);
  });
});

/** um ponto LOCAL da escada: `u` ao longo (0 = pé), `lat` de lado */
const naEscada = (u: number, lat = 0) => { const e = ESCADA_LOUNGE; return mundo({ x: e.dir.x * (e.ini + u) - e.dir.z * lat, z: e.dir.z * (e.ini + u) + e.dir.x * lat }); };

describe("Zaeon mega: o LOUNGE numa plataforma própria, lá no alto, ligada por uma escada", () => {
  const L = CIDADE.salas.lounge;
  it("a plataforma do lounge fica FORA da central, na altura do início da ponta da capela", () => {
    expect(Math.hypot(L.x, L.z) - L.r).toBeGreaterThan(CIDADE.bordaR + 30);
    expect(ALTURA_LOUNGE).toBe(Math.round(inicioDaPonta()));
    expect(ALTURA_LOUNGE).toBeGreaterThan(50);
    expect(Math.abs(Math.atan2(L.z, L.x) - LOUNGE_ANGULO)).toBeLessThan(1e-6);
    expect(Object.keys(CIDADE.salas)).toEqual(["lounge"]);
  });
  it("a ESCADA: rampa do piso central (0) até o lounge (ALTURA_LOUNGE), com inclinação de escada de verdade", () => {
    const e = ESCADA_LOUNGE;
    expect(e.ini).toBeLessThan(CIDADE.andavelR);                     // o pé fica no piso andável
    expect(alturaNaCidade(naEscada(0.01))).toBeCloseTo(0, 1);
    expect(alturaNaCidade(naEscada(e.len / 2))).toBeCloseTo(ALTURA_LOUNGE / 2, 5);
    expect(alturaNaCidade(naEscada(e.len - 0.01))).toBeCloseTo(ALTURA_LOUNGE, 1);
    expect(ALTURA_LOUNGE / e.len).toBeGreaterThan(0.5); expect(ALTURA_LOUNGE / e.len).toBeLessThan(0.8);
    expect(naEscadaLocal({ x: e.dir.x * (e.ini + 7), z: 2 }).u).toBeCloseTo(7, 6);
    // o topo da escada encosta na porta do lounge (o +z da sala)
    const porta = mundo(daSala(L, 0, L.r - 0.5)); expect(alturaNaCidade(porta)).toBe(ALTURA_LOUNGE);
  });
  it("corrimão: dos dois lados, do pé ao topo — só se entra pelo pé (ninguém sobe pela lateral nem passa por baixo)", () => {
    const cs = colisoresDaCidade(), e = ESCADA_LOUNGE;
    for (const u of [0.5, 10, e.len / 2, e.len - 1]) {
      expect(dentroDeAlgum(naEscada(u, 0), cs)).toBe(false);                    // o meio é livre
      for (const sl of [-1, 1]) expect(dentroDeAlgum(naEscada(u, sl * (e.meia + e.colR)), cs)).toBe(true);   // o corrimão é sólido
    }
    // andando escada acima (sempre pra −x, com a colisão), chega no lounge e a altura só sobe
    let p = naEscada(-2), hAnt = -1;
    for (let k = 0; k < 2400; k++) { p = resolverCidadeLivre({ x: p.x - 0.12, z: p.z + (k % 2 ? 0.08 : -0.08) }); const h = alturaNaCidade(p); expect(h).toBeGreaterThanOrEqual(hAnt - 1e-9); hAnt = h; }
    expect(hAnt).toBeGreaterThanOrEqual(ALTURA_LOUNGE);
    expect(naIlhaPrincipal(p)).toBe(true);
  });
  it("cair: do lado da escada (fora da central) não há piso; a escada e o lounge são piso; por baixo deles, quem voa passa", () => {
    const e = ESCADA_LOUNGE, meio = e.len * 0.7, aoLado = naEscada(meio, e.meia + 6);
    expect(naIlhaPrincipal(aoLado)).toBe(false);
    expect(naIlhaPrincipal(naEscada(meio))).toBe(true);
    expect(naIlhaPrincipal(mundo({ x: L.x + 10, z: L.z }))).toBe(true);
    const h = alturaNaCidade(naEscada(meio));
    expect(pisoNoAr(naEscada(meio), h + 3)).toBeCloseTo(h, 6);    // vindo de cima: pousa na escada
    expect(pisoNoAr(naEscada(meio), h - 10)).toBeNull();          // por baixo (fora da central): não há piso, cai
    expect(pisoNoAr(naEscada(3), 0.5)).toBe(0);                   // por baixo do pé (ainda na central): o piso central
    expect(pisoNoAr(mundo({ x: 30, z: 0 }), 5)).toBe(0);
    // clicar pra andar não te prende na borda central quando você está na escada ou no lounge
    const noLounge = mundo({ x: L.x, z: L.z + 5 }); expect(resolverCidade(noLounge)).toEqual(noLounge);
  });
  it("o clube: entrada (virada pra escada) livre, guarda-corpo sólido em volta", () => {
    const cs = colisoresDaCidade();
    for (const lz of [L.r + 0.5, L.r, L.r - 1.5]) expect(dentroDeAlgum(mundo(daSala(L, 0, lz)), cs)).toBe(false);
    const porta = daSala(L, 0, L.r); expect(Math.hypot(porta.x, porta.z)).toBeLessThan(Math.hypot(L.x, L.z));
    expect(dentroDeAlgum(mundo(daSala(L, 0, -L.r)), cs)).toBe(true);
    expect(dentroDeAlgum(mundo(daSala(L, L.r, 0)), cs)).toBe(true);
  });
  it("móveis: telão, palco alto, mesa do DJ, a TRELIÇA com as caixas SUSPENSAS, subs, pista e sofás; tudo dentro", () => {
    const tipos = MOVEIS.lounge.map((m) => m.tipo);
    expect(tipos).toEqual(expect.arrayContaining(["sofa", "tv", "caixaSom", "palco", "mesaDJ", "sub", "pista", "trelica"]));
    expect(MOVEIS.lounge.filter((m) => m.tipo === "caixaSom").every((m) => m.solido === false)).toBe(true);   // suspensas: o chão é livre
    for (const m of MOVEIS.lounge) for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const lx = (a! * m.larg) / 2, lz = (b! * m.prof) / 2, x = m.x + lx * Math.cos(m.rot) + lz * Math.sin(m.rot), z = m.z - lx * Math.sin(m.rot) + lz * Math.cos(m.rot);
      expect(Math.hypot(x, z)).toBeLessThan(L.r);
    }
    expect(PALCO.h).toBeGreaterThan(2);
  });
  it("FESTA: palco alto com borda sólida, sobe-se pela escadinha e a cabine do DJ fica livre atrás da mesa", () => {
    const cs = colisoresDaCidade(), W = (lx: number, lz: number) => mundo(daSala(L, lx, lz)), H = ALTURA_LOUNGE;
    const ida = daSala(L, 1.3, -4.2), volta = naSala(L, ida.x, ida.z); expect(volta.x).toBeCloseTo(1.3); expect(volta.z).toBeCloseTo(-4.2);
    expect(alturaNaCidade(W(0, 20))).toBe(H);
    const z0 = PALCO.z + PALCO.r - 0.3;
    expect(alturaNaCidade(W(0, z0 + PALCO.escada.len + 0.1))).toBe(H);
    expect(alturaNaCidade(W(0, z0 + PALCO.escada.len / 2))).toBeCloseTo(H + PALCO.h / 2);
    expect(alturaNaCidade(W(4, PALCO.z))).toBe(H + PALCO.h);
    for (const [lx, lz] of [[0, z0 + PALCO.escada.len - 0.2], [0, z0 + 0.4], [0, PALCO.z + 5], [5, PALCO.z + 1], [5, PALCO.z - 1], [2, PALCO.cabine.z]] as const) expect(dentroDeAlgum(W(lx, lz), cs)).toBe(false);
    expect(dentroDeAlgum(W(PALCO.cabine.x, PALCO.cabine.z), cs)).toBe(false);
    expect(dentroDeAlgum(W(PALCO.r, PALCO.z), cs)).toBe(true);
    expect(dentroDeAlgum(W(-PALCO.r * 0.7, PALCO.z + PALCO.r * 0.71), cs)).toBe(true);
    expect(dentroDeAlgum(W(MESA_DJ.x, MESA_DJ.z), cs)).toBe(true);
    expect(naCabineDJ(W(PALCO.cabine.x, PALCO.cabine.z))).toBe(true);
    expect(naCabineDJ(W(0, 2))).toBe(false);
    expect(PALCO.cabine.z).toBeLessThan(MESA_DJ.z - MESA_DJ.prof / 2);
    expect(rumoDoDJ()).toBeCloseTo(rotDaSala(L));
    const pc = pontoDaCabineDJ(), w = W(PALCO.cabine.x, PALCO.cabine.z); expect(pc.x).toBeCloseTo(w.x); expect(pc.z).toBeCloseTo(w.z);
    expect(alturaNaCidade(pc)).toBe(H + PALCO.h);
    expect(MESA_DJ.z - MESA_DJ.prof / 2 - PALCO.cabine.z).toBeLessThanOrEqual(0.5);
  });
  it("não há mais hangar (nem pilones) na ilha", () => {
    expect("hangar" in CIDADE).toBe(false);
  });
});

describe("todo ponto de NASCIMENTO / reaparecer na Zaeon continua valendo (chão firme, fora de colisor, longe da escada)", () => {
  const cs = colisoresDaCidade();
  const firme = (w: { x: number; z: number }, folga = 0) => {
    expect(naIlhaPrincipal(w)).toBe(true);
    expect(alturaNaCidade(w)).toBe(0);   // no piso da central (não na escada nem no lounge)
    expect(Math.hypot(w.x - CIDADE.centro.x, w.z - CIDADE.centro.z) + folga).toBeLessThan(CIDADE.andavelR);
    expect(cs.some((c) => Math.hypot(w.x - c.x, w.z - c.z) < c.r + folga)).toBe(false);
    expect(Math.abs(naEscadaLocal({ x: w.x - CIDADE.centro.x, z: w.z - CIDADE.centro.z }).lat) > ESCADA_LOUNGE.meia + 4 || naEscadaLocal({ x: w.x - CIDADE.centro.x, z: w.z - CIDADE.centro.z }).u < -4).toBe(true);
  };
  it("a chegada (portal), o portal de volta e um pátio", () => {
    for (const l of [CIDADE.chegada, PATIO]) firme(mundo(l), 1);
    firme(mundo(CIDADE.portalVolta));
    expect(noPortalVolta(mundo(CIDADE.chegada))).toBe(false);
  });
  it("as bases do dono (fora da capela) e o ponto de nascer de cada uma", () => {
    BASES_CEU_LOCAIS.forEach((l, i) => {
      firme(mundo(l), BASE_COLLIDER_R);
      expect(Math.hypot(l.x, l.z) - BASE_COLLIDER_R).toBeGreaterThan(CIDADE.cidadela.r + CIDADE.cidadela.pilarColR + 2);
      firme(spawnDaBase(baseNoCeu(i)));
    });
  });
  it("as vagas das motos na Zaeon e o fim da rampa da nave atracada", () => {
    for (const v of vagas().filter((x) => x.ceu)) firme(v, 1.2);
    firme(paraMundo(poseDaDoca(), NAVE_QG.saida));
  });
});

describe("céu livre: ilhotas com colisão e borda sem parede", () => {
  it("ilhotas FIXAS (o mesmo layout pra todos), fora da ilha principal, sem se encostar e longe da doca e da escada", () => {
    expect(ILHOTAS.length).toBeGreaterThanOrEqual(7);
    const angDe = (a: number, b: number) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
    for (const [k, il] of ILHOTAS.entries()) {
      expect(Math.hypot(il.x, il.z) - il.r).toBeGreaterThan(CIDADE.bordaR + 10);
      const a = Math.atan2(il.z, il.x);
      expect(angDe(a, LOUNGE_ANGULO)).toBeGreaterThan(LOUNGE_MEIA_ABERTURA - 1e-9); expect(angDe(a, DOCA_ANGULO)).toBeGreaterThan(DOCA_MEIA_ABERTURA - 1e-9);
      for (const o of ILHOTAS.slice(k + 1)) expect(Math.hypot(il.x - o.x, il.z - o.z)).toBeGreaterThan(il.r + o.r);
    }
    expect(alturaIlhota(0, 0)).toBe(alturaIlhota(0, 0));
    expect(Math.abs(alturaIlhota(2, 3) - (CIDADE.pisoY + ILHOTAS[2]!.dy))).toBeLessThanOrEqual(1.2 + 1e-9);
  });
  it("topo de ilhota: dentro do raio é ela; fora, nenhuma", () => {
    const il = ILHOTAS[3]!, w = mundo(il);
    expect(ilhotaEm(w)).toBe(3);
    expect(ilhotaEm({ x: w.x + il.r + 2, z: w.z })).toBe(-1);
  });
  it("a borda não tem mais parede invisível ao andar (passou dela = cai); clicar pra andar continua limitado", () => {
    const longe = mundo({ x: CIDADE.bordaR + 5, z: 0 });
    expect(resolverCidadeLivre(longe)).toEqual(longe);
    expect(naIlhaPrincipal(longe)).toBe(false);
    expect(naIlhaPrincipal(mundo({ x: 10, z: 0 }))).toBe(true);
    const r = resolverCidade(longe); expect(Math.hypot(r.x - CIDADE.centro.x, r.z - CIDADE.centro.z)).toBeLessThanOrEqual(CIDADE.andavelR + 1e-6);
  });
});

