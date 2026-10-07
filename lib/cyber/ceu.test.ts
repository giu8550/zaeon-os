import { describe, expect, it } from "vitest";
import { BURACO_NEGRO, CIDADE, bibliotecaLocais, chaoDaNave, colisoresDaCidade, computadorPerto, computadoresLocais, foraDaIlha, mundo, noPortalEntrada, noPortalVolta, resolverCidade, resolverCidadeLivre, naIlhaPrincipal, ilhotaEm, alturaIlhota, ILHOTAS, servidoresLocais, daSala, paredeDaSala, MOVEIS, PALCO, MESA_DJ, alturaNaCidade, naCabineDJ, naSala, pontoDaCabineDJ, rumoDoDJ, rotDaSala, type NomeSala } from "./ceu";
import { VOO, passoVoo, type EstadoVoo } from "./voo";
import { dentroDeAlgum } from "./colisao";
import { POIS } from "./landmarks";

/** o pátio onde era o hangar: piso livre da ilha (local) */
const PATIO = { x: 34, z: 12 };

describe("cidade no céu", () => {
  it("fica BEEEM acima do buraco negro (flutuando nas alturas)", () => {
    expect(CIDADE.centro).toEqual({ x: BURACO_NEGRO.x, z: BURACO_NEGRO.z });
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
  it("andar: biblioteca (estantes e monitores), pilares e mesa são sólidos; não cai da borda", () => {
    const c0 = mundo(computadoresLocais()[0]!);
    const r = resolverCidade(c0);
    expect(Math.hypot(r.x - c0.x, r.z - c0.z)).toBeGreaterThanOrEqual(CIDADE.biblioteca.colR - 1e-6);
    const fora = resolverCidade(mundo({ x: 80, z: 0 }));
    expect(Math.hypot(fora.x - CIDADE.centro.x, fora.z - CIDADE.centro.z)).toBeLessThanOrEqual(CIDADE.andavelR + 1e-6);
  });
  it("biblioteca rodeando a sala: estantes + monitores virados pro centro, com vãos de passagem", () => {
    const mods = bibliotecaLocais();
    expect(mods).toHaveLength(CIDADE.biblioteca.n);
    expect(computadoresLocais().length).toBe(CIDADE.biblioteca.n / CIDADE.biblioteca.monitorCada);
    for (const m of mods) {
      expect(Math.hypot(m.x, m.z)).toBeCloseTo(CIDADE.biblioteca.r, 6);
      expect(Math.hypot(m.x, m.z)).toBeLessThan(CIDADE.cidadela.r - 1);   // dentro da cidadela
      const frente = { x: m.x + Math.sin(m.rot), z: m.z + Math.cos(m.rot) };
      expect(Math.hypot(frente.x, frente.z)).toBeLessThan(Math.hypot(m.x, m.z));   // +z local → centro
    }
    // dá pra entrar: o vão entre dois módulos vizinhos fica livre
    const a = ((0 + 1) / CIDADE.biblioteca.n) * Math.PI * 2, vao = mundo({ x: Math.cos(a) * CIDADE.biblioteca.r, z: Math.sin(a) * CIDADE.biblioteca.r });
    expect(colisoresDaCidade().some((c) => Math.hypot(c.x - vao.x, c.z - vao.z) < c.r)).toBe(false);
  });
  it("monitor da biblioteca mais perto (pra clicar e estudar)", () => {
    const c3 = computadoresLocais()[3]!;
    const k = (CIDADE.biblioteca.r - 2) / CIDADE.biblioteca.r, perto = mundo({ x: c3.x * k, z: c3.z * k });   // 2 m à frente
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
    expect(foraDaIlha({ ...mundo({ x: 10, z: 0 }), y: fundo + 20 })).toEqual({ ...mundo({ x: 10, z: 0 }), y: fundo + 20 });   // fora dela: livre
  });
  it("salas de servidores: 4 alas com corredores livres até a mesa, entre a mesa e a biblioteca", () => {
    const rs = servidoresLocais(), { n, vaoCada, r, colR } = CIDADE.servidores;
    expect(rs).toHaveLength(n - n / vaoCada);
    expect(r - colR).toBeGreaterThan(CIDADE.mesaHolo.r + 2);
    expect(r + colR).toBeLessThan(CIDADE.biblioteca.r - 2);
    for (const s of rs) { const f = { x: s.x + Math.sin(s.rot), z: s.z + Math.cos(s.rot) }; expect(Math.hypot(f.x, f.z)).toBeLessThan(Math.hypot(s.x, s.z)); }
    // os corredores (a cada `vaoCada`) ficam livres
    const cs = colisoresDaCidade();
    for (let i = 0; i < n; i += vaoCada) { const a = (i / n) * Math.PI * 2, v = mundo({ x: Math.cos(a) * r, z: Math.sin(a) * r }); expect(cs.some((c) => Math.hypot(c.x - v.x, c.z - v.z) < c.r + 0.4)).toBe(false); }
  });
});

describe("voo da nave", () => {
  const parada: EstadoVoo = { ...mundo(PATIO), y: CIDADE.pisoY, yaw: 0, vx: 0, vy: 0, vz: 0 };
  const voar = (s: EstadoVoo, cmd: Parameters<typeof passoVoo>[1], seg: number) => { let r = { s, pousado: true, chaoY: 0 }; for (let i = 0; i < seg * 60; i++) r = passoVoo(r.s, cmd, 1 / 60); return r; };
  it("decola da ilha, sobrevoa e pousa no chão do mapa", () => {
    const sobe = voar(parada, { wx: 0, wz: 0, subir: true, descer: false }, 2);
    expect(sobe.pousado).toBe(false); expect(sobe.s.y).toBeGreaterThan(CIDADE.pisoY + 5);
    const sai = voar(sobe.s, { wx: 0, wz: 1, subir: false, descer: false }, 5);   // vai pra +z (rumo à praça)
    expect(Math.hypot(sai.s.x - CIDADE.centro.x, sai.s.z - CIDADE.centro.z)).toBeGreaterThan(CIDADE.bordaR);
    const desce = voar(sai.s, { wx: 0, wz: 0, subir: false, descer: true }, 20);
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

describe("Zaeon ampliada: salas (sem hangar — a nave-QG atraca pairando ao lado)", () => {
  const nomes = Object.keys(CIDADE.salas) as NomeSala[];
  it("as salas cabem na ilha, fora da cidadela, das bases e dos portais", () => {
    for (const n of nomes) {
      const s = CIDADE.salas[n], d = Math.hypot(s.x, s.z);
      expect(d + s.r).toBeLessThan(CIDADE.andavelR);
      expect(d - s.r).toBeGreaterThan(CIDADE.cidadela.r + 2);
      for (const l of [CIDADE.chegada, CIDADE.portalVolta, { x: 0, z: 24 }, { x: 0, z: -24 }, { x: -24, z: -6 }]) expect(Math.hypot(s.x - l.x, s.z - l.z)).toBeGreaterThan(s.r + 3);
      const todas = CIDADE.salas as Record<string, { x: number; z: number; r: number }>;
      for (const o of Object.keys(todas)) if (o !== n) expect(Math.hypot(s.x - todas[o]!.x, s.z - todas[o]!.z)).toBeGreaterThan(s.r * 2 + 2);
    }
  });
  it("dá pra entrar: a porta (virada pro centro) e o miolo da sala ficam livres; a parede é sólida", () => {
    const cs = colisoresDaCidade();
    for (const n of nomes) {
      const s = CIDADE.salas[n];
      for (const lz of [s.r + 0.5, s.r, s.r - 1.5]) { const p = mundo(daSala(s, 0, lz)); expect(dentroDeAlgum(p, cs)).toBe(false); }
      const porta = daSala(s, 0, s.r); expect(Math.hypot(porta.x, porta.z)).toBeLessThan(Math.hypot(s.x, s.z));   // a porta dá pro centro
      expect(paredeDaSala(s).length).toBeGreaterThan(30);
      const fundo = mundo(daSala(s, 0, -s.r)); expect(dentroDeAlgum(fundo, cs)).toBe(true);
    }
  });
  it("móveis: o lounge virou clube (telão, palco, mesa do DJ, torres de som, subs, pista, sofás); tudo dentro da sala", () => {
    const tipos = (n: NomeSala) => MOVEIS[n].map((m) => m.tipo);
    expect(tipos("lounge")).toEqual(expect.arrayContaining(["sofa", "tv", "caixaSom", "palco", "mesaDJ", "sub", "pista"]));
    expect(Object.keys(CIDADE.salas)).toEqual(["lounge"]);
    for (const n of nomes) for (const m of MOVEIS[n]) for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {   // os 4 cantos da pegada
      const lx = (a * m.larg) / 2, lz = (b * m.prof) / 2, x = m.x + lx * Math.cos(m.rot) + lz * Math.sin(m.rot), z = m.z - lx * Math.sin(m.rot) + lz * Math.cos(m.rot);
      expect(Math.hypot(x, z)).toBeLessThan(CIDADE.salas[n].r);
    }
  });
  it("FESTA: palco de cristal com borda sólida, sobe-se pela escada e a cabine do DJ fica livre atrás da mesa", () => {
    const s = CIDADE.salas.lounge, cs = colisoresDaCidade(), W = (lx: number, lz: number) => mundo(daSala(s, lx, lz));
    // ida e volta sala ↔ ilha
    const ida = daSala(s, 1.3, -4.2), volta = naSala(s, ida.x, ida.z); expect(volta.x).toBeCloseTo(1.3); expect(volta.z).toBeCloseTo(-4.2);
    // alturas: chão, pé da escada, meio da escada, palco
    expect(alturaNaCidade(W(0, 4))).toBe(0);
    const z0 = PALCO.z + PALCO.r - 0.3;
    expect(alturaNaCidade(W(0, z0 + PALCO.escada.len + 0.1))).toBe(0);
    expect(alturaNaCidade(W(0, z0 + PALCO.escada.len / 2))).toBeCloseTo(PALCO.h / 2);
    expect(alturaNaCidade(W(2, PALCO.z))).toBe(PALCO.h);
    // o caminho pela escada até a cabine é livre (centro da escada, palco ao lado da mesa, cabine)
    for (const [lx, lz] of [[0, z0 + PALCO.escada.len - 0.2], [0, z0 + 0.4], [0, PALCO.z + 3.2], [3, PALCO.z + 0.6], [3, PALCO.z - 0.6], [1.5, PALCO.cabine.z]] as const) expect(dentroDeAlgum(W(lx, lz), cs)).toBe(false);
    expect(dentroDeAlgum(W(PALCO.cabine.x, PALCO.cabine.z), cs)).toBe(false);
    // a borda do palco é sólida (de lado não se sobe) e a mesa do DJ também
    expect(dentroDeAlgum(W(PALCO.r, PALCO.z), cs)).toBe(true);
    expect(dentroDeAlgum(W(-PALCO.r * 0.7, PALCO.z + PALCO.r * 0.71), cs)).toBe(true);
    expect(dentroDeAlgum(W(MESA_DJ.x, MESA_DJ.z), cs)).toBe(true);
    // a cabine: atrás da mesa, em cima do palco; o DJ olha pra pista (+z da sala)
    expect(naCabineDJ(W(PALCO.cabine.x, PALCO.cabine.z))).toBe(true);
    expect(naCabineDJ(W(0, 2))).toBe(false);
    expect(PALCO.cabine.z).toBeLessThan(MESA_DJ.z - MESA_DJ.prof / 2);
    expect(rumoDoDJ()).toBeCloseTo(rotDaSala(s));
    const pc = pontoDaCabineDJ(), w = W(PALCO.cabine.x, PALCO.cabine.z); expect(pc.x).toBeCloseTo(w.x); expect(pc.z).toBeCloseTo(w.z);
    expect(alturaNaCidade(pc)).toBe(PALCO.h);
    // da cabine até a borda de trás da mesa cabe o alcance do braço (≤ 0,5 m)
    expect(MESA_DJ.z - MESA_DJ.prof / 2 - PALCO.cabine.z).toBeLessThanOrEqual(0.5);
  });
  it("não há mais hangar (nem pilones) na ilha", () => {
    expect("hangar" in CIDADE).toBe(false);
  });
});

describe("céu livre: ilhotas com colisão e borda sem parede", () => {
  it("7 ilhotas FIXAS (o mesmo layout pra todos), fora da ilha principal e sem se encostar", () => {
    expect(ILHOTAS).toHaveLength(7);
    for (const [k, il] of ILHOTAS.entries()) {
      expect(Math.hypot(il.x, il.z) - il.r).toBeGreaterThan(CIDADE.bordaR + 10);
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

