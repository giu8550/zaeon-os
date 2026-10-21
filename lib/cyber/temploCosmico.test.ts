import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALTURA_LOUNGE, CIDADE, alturaNaCidade, colisoresDaCidade, colisoresDoAndar, daSala, mundo, naIlhaPrincipal, naSala, rotDaSala, salaEm, solidosDaCidade } from "./ceu";
import { NOS } from "./buracos";
import { empurrarParaFora } from "./colisao";
import { FIO, saidaDaSala } from "./fiosCosmicos";
import { definirNivel } from "./nivelAtivo";
import { nivelDoPonto } from "./niveis";
import { ANDARES_ESTUDO, CARACOL, PLATS, aberturasDe, doEstudoLocal, noEstudoLocal, type PlatTC, ELEVADOR_TC, ESTACOES_TI, TORRE_TI, bocaDoElevadorTC, posElevadorTC, ESTUDO, ALCANCE_DUELO, ARVORE_RASTA, BOCA_SAIDA_SALAO, CASAIS, CYBER, NUCLEO_CYBER, barradoNaCupula, portaDaCupula, CHEGADA_SALAO, ESP, FESTAS, PIRAMIDE, PONTES, PONTE_LOUNGE, RASTA, SALAO, TEMPLO_RASTA, alturaDaEscadariaRasta, naPiramide } from "./temploCosmico";
import { ESCADARIA, TEMPLO, curvaDaEscadaria, noTemplo } from "./templo";
import { RotinaExaminer, lugarDeGuarda } from "./examiner";

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

  it("o LOUNGE RASTA fica à DIREITA de quem chega, no nível do pátio, e a ponte dele sobe do salão sem nada no caminho", () => {
    const ch = NOS.lounge.chegada, f = { x: Math.sin(ch.rumo), z: Math.cos(ch.rumo) }, dir = { x: -f.z, z: f.x }, r = W(RASTA.x, RASTA.z);
    expect((r.x - ch.x) * dir.x + (r.z - ch.z) * dir.z).toBeGreaterThan(100);
    expect(alturaNaCidade(W(RASTA.x + 10, RASTA.z + 10))).toBe(ALTURA_LOUNGE);
    const p = PONTES.find((x) => x.id === "rasta")!, cs = colisoresDaCidade();
    for (let u = -0.1; u <= 1.1; u += 0.02) { const q = W(p.a.x + (p.b.x - p.a.x) * u, p.a.z + (p.b.z - p.a.z) * u); expect(cs.every((c) => Math.hypot(c.x - q.x, c.z - q.z) > c.r + 0.6)).toBe(true); expect(salaEm(loc(q))).toBe("lounge"); }
  });
  it("a ESCADARIA DAS RAÍZES sobe do disco rasta até a capela maior, por igual e com guarda-corpo, e o caminho da ponte até ela é livre", () => {
    const { pts } = curvaDaEscadaria(), cs = colisoresDaCidade(); let ant = -Infinity;
    for (const pt of pts) {
      const q = ESP(pt), w = W(q.x, q.z), h = alturaNaCidade(w);
      expect(h).toBeGreaterThanOrEqual(ant - 0.5); ant = h;
      expect(cs.every((c) => Math.hypot(c.x - w.x, c.z - w.z) > c.r + 0.3)).toBe(true);
    }
    expect(alturaNaCidade(W(TEMPLO_RASTA.x, TEMPLO_RASTA.z))).toBe(ALTURA_LOUNGE + TEMPLO_RASTA.h);
    expect(alturaDaEscadariaRasta(0)).toBeCloseTo(0, 6); expect(alturaDaEscadariaRasta(curvaDaEscadaria().len)).toBeCloseTo(TEMPLO.h, 6);
    // da ponta da ponte rasta até o pé da escadaria, contornando a ÁRVORE do meio: nenhum móvel nem parede no caminho
    const pr = PONTES.find((x) => x.id === "rasta")!, pe = ESP(ESCADARIA.controle[0]!), volta = { x: RASTA.x, z: RASTA.z + ARVORE_RASTA.r + 9 };
    for (const [de, para] of [[pr.b, volta], [volta, pe]] as const) for (let u = 0; u <= 1; u += 0.02) { const w = W(de.x + (para.x - de.x) * u, de.z + (para.z - de.z) * u); expect(cs.every((c) => Math.hypot(c.x - w.x, c.z - w.z) > c.r + 0.4)).toBe(true); }
  });
  it("da capela maior: a ponte reta pro SALÃO DE FESTAS e a rampa subindo pro LOUNGE DOS CASAIS (tudo nível do lounge)", () => {
    for (const id of ["festas", "casais"]) {
      const p = PONTES.find((x) => x.id === id)!, cs = colisoresDaCidade(); let ant = -Infinity;
      for (let u = -0.05; u <= 1.05; u += 0.02) { const w = W(p.a.x + (p.b.x - p.a.x) * u, p.a.z + (p.b.z - p.a.z) * u), h = alturaNaCidade(w); expect(h).toBeGreaterThanOrEqual(ant - 1e-6); ant = h; expect(cs.every((c) => Math.hypot(c.x - w.x, c.z - w.z) > c.r + 0.5)).toBe(true); }
    }
    expect(alturaNaCidade(W(FESTAS.x, FESTAS.z))).toBe(ALTURA_LOUNGE + FESTAS.h); expect(alturaNaCidade(W(CASAIS.x, CASAIS.z))).toBe(ALTURA_LOUNGE + CASAIS.h);
    const w = W(CASAIS.x, CASAIS.z); expect(nivelDoPonto(w, CIDADE.pisoY + ALTURA_LOUNGE + CASAIS.h)).toBe("lounge");
  });

  it("o CAMINHO DO MEIO: o CAMPUS DE TI (estações dos dois lados, o corredor livre) até a TORRE alta, e o ELEVADOR até o topo", () => {
    expect(CYBER.x).toBe(PIRAMIDE.x); expect(CHEGADA_SALAO.x).toBe(PIRAMIDE.x);   // a mesma linha de quem chega
    expect(ESTACOES_TI.length).toBeGreaterThan(90); expect(ESTACOES_TI.filter((e) => e.ocupada).length).toBeGreaterThan(60);   // muitos estudantes de TI
    expect(CYBER.h).toBeGreaterThanOrEqual(100); expect(SALAO.z - TORRE_TI.z).toBeGreaterThan(280);   // mais alta e mais longe
    const cs = colisoresDaCidade();
    // o corredor do meio, de trás da pirâmide até o anel do elevador: livre e no nível do salão
    for (let z = PIRAMIDE.z - PIRAMIDE.meia - 3; z >= ELEVADOR_TC.base.z; z -= 1) {
      const w = W(CYBER.x, z); expect(alturaNaCidade(w)).toBe(ALTURA_LOUNGE - SALAO.desce);
      expect(cs.every((c) => Math.hypot(c.x - w.x, c.z - w.z) > c.r + 0.6), `z ${z}`).toBe(true); expect(salaEm(loc(w))).toBe("lounge");
    }
    // e entre as fileiras dá pra chegar numa estação
    const e = ESTACOES_TI[5]!, w = W(e.x, e.z + 2); expect(cs.every((c) => Math.hypot(c.x - w.x, c.z - w.z) > c.r)).toBe(true);
    // o ELEVADOR: o anel do pé sobe e entrega no topo (dentro do monumento? não — na plataforma, livre); o do topo desce
    const pe = ELEVADOR_TC.base, topo = ELEVADOR_TC.topo;
    expect(bocaDoElevadorTC(pe, -SALAO.desce)).toBe("sobe"); expect(bocaDoElevadorTC(topo, CYBER.h)).toBe("desce"); expect(bocaDoElevadorTC(pe, CYBER.h)).toBeNull();
    const fim = posElevadorTC("sobe", 1); expect(fim.h).toBeCloseTo(CYBER.h, 6); expect(alturaNaCidade(W(fim.x, fim.z))).toBe(ALTURA_LOUNGE + CYBER.h);
    const wt = W(topo.x, topo.z); expect(cs.every((c) => Math.hypot(c.x - wt.x, c.z - wt.z) > c.r)).toBe(true);   // (lá em cima, nada empurrando)
    expect(posElevadorTC("desce", 1).h).toBeCloseTo(-SALAO.desce, 6);
    // a COLUNA da torre é sólida (andando na base e voando) e o monumento lá em cima também
    const col = W(TORRE_TI.x, TORRE_TI.z + TORRE_TI.colR); expect(cs.some((c) => Math.hypot(c.x - col.x, c.z - col.z) <= c.r)).toBe(true);   // (o contorno barra quem anda na base)
    const nc = W(CYBER.x, CYBER.z); expect(solidosDaCidade().some((o) => Math.hypot(o.x - nc.x, o.z - nc.z) < 1 && o.topo > CIDADE.pisoY + ALTURA_LOUNGE + CYBER.h + 20)).toBe(true);
    expect(nivelDoPonto(W(CYBER.x, CYBER.z + 20), CIDADE.pisoY + ALTURA_LOUNGE + CYBER.h)).toBe("lounge");
  });
  it("a GUARDIÃ: a Examiner monta guarda na escadaria-veia, na frente da porta da cúpula, virada pra quem sobe; a cúpula barra quem não venceu", () => {
    const g = lugarDeGuarda(), q = naSala(L, g.x, g.z), porta = portaDaCupula();
    expect(noTemplo(q, 0)).toBe(false); expect(Math.hypot(q.x - porta.x, q.z - porta.z)).toBeLessThan(ALCANCE_DUELO);
    expect(alturaNaCidade(mundo(g))).toBeGreaterThan(ALTURA_LOUNGE + TEMPLO.h - 4);   // lá no alto da escadaria
    const f = { x: Math.sin(g.rumo), z: Math.cos(g.rumo) }, pd = daSala(L, porta.x, porta.z);
    expect((pd.x - g.x) * f.x + (pd.z - g.z) * f.z).toBeLessThan(0);   // de COSTAS pra porta (de frente pra escada)
    const r = new RotinaExaminer(() => 0.5); r.guardia = true; r.passo(10, true, true);
    expect(r.estado().pos).toEqual({ x: g.x, z: g.z }); expect(r.estado().andando).toBe(false);
    // a cúpula: dentro do templo sem ter vencido → de volta pra fora da porta; com a vitória (ou fora dele), nada
    const fora = barradoNaCupula({ x: TEMPLO.x, z: TEMPLO.z }, false)!; expect(noTemplo(fora, 0)).toBe(false);
    expect(barradoNaCupula({ x: TEMPLO.x, z: TEMPLO.z }, true)).toBeNull(); expect(barradoNaCupula({ x: 0, z: 0 }, false)).toBeNull();
    expect(colisoresDaCidade().every((c) => Math.hypot(c.x - mundo(daSala(L, fora.x, fora.z)).x, c.z - mundo(daSala(L, fora.x, fora.z)).z) > c.r + 0.3)).toBe(true);
  });
  it("os LOUNGES ESTUDANTIS: dos dois lados do salão, no nível dele, com rodas de sofá; depois deles a ESCADA sobe até a festa", () => {
    const cs = colisoresDaCidade();
    for (const [e, ida, escada] of [[ESTUDO, "estudoL", "lounge"], [{ ...ESP(ESTUDO), h: ESTUDO.h }, "estudoR", "rasta"]] as const) {
      expect(alturaNaCidade(W(e.x, e.z + 20))).toBe(ALTURA_LOUNGE + ESTUDO.h);
      // salão → lounge estudantil → escada → festa: sem nada no caminho (o corredor fica livre) e subindo sempre
      const a = PONTES.find((p) => p.id === ida)!, b = PONTES.find((p) => p.id === escada)!, pts = [a.a, a.b, b.a, b.b];
      let ant = -Infinity;
      for (let k = 0; k < pts.length - 1; k++) for (let u = 0; u <= 1; u += 0.02) {
        const p = W(pts[k]!.x + (pts[k + 1]!.x - pts[k]!.x) * u, pts[k]!.z + (pts[k + 1]!.z - pts[k]!.z) * u), h = alturaNaCidade(p);
        expect(h).toBeGreaterThanOrEqual(ant - 1e-6); ant = h;
        expect(cs.every((c) => Math.hypot(c.x - p.x, c.z - p.z) > c.r + 0.5), `${ida} ${k} ${u.toFixed(2)}`).toBe(true);
      }
      expect(ant).toBeGreaterThan(ALTURA_LOUNGE - 0.5);   // (chegou no pátio da festa)
    }
  });
});

describe("os ANDARES dos lounges estudantis: o caracol, o guarda-corpo e a parede", () => {
  beforeEach(() => definirNivel("lounge"));
  afterEach(() => definirNivel(null));
  const est = (id: string) => PLATS.find((p) => p.id === id)!;
  /** anda (com a colisão de verdade e o piso pela altura dos pés) por pontos LOCAIS do lounge estudantil */
  function andar(p: PlatTC, caminho: { x: number; z: number }[], y0: number) {
    const cs = colisoresDaCidade(); let w = W(doEstudoLocal(p, caminho[0]!).x, doEstudoLocal(p, caminho[0]!).z), y = y0, maxQueda = 0;
    for (let i = 1; i < caminho.length; i++) {
      const alvo = doEstudoLocal(p, caminho[i]!), aw = W(alvo.x, alvo.z);
      for (let s = 0; s < 600; s++) {
        const d = Math.hypot(aw.x - w.x, aw.z - w.z); if (d < 0.02) break;
        const k = Math.min(1, 0.05 / d), prop = { x: w.x + (aw.x - w.x) * k, z: w.z + (aw.z - w.z) * k };
        w = empurrarParaFora(prop, [...cs, ...colisoresDoAndar(prop, y)]);
        const ny = alturaNaCidade(w, y); maxQueda = Math.max(maxQueda, y - ny); y = ny;
      }
    }
    return { w, y, l: noEstudoLocal(p, naSala(L, loc(w).x, loc(w).z)), maxQueda };
  }
  /** o caminho: do corredor, entra no caracol pela boca, dá `voltas` voltas subindo e sai pelo outro lado da boca */
  const subindo = (voltas: number) => {
    const mid = (CARACOL.col + CARACOL.r) / 2, pt = (a: number, r: number) => ({ x: Math.cos(a) * r, z: Math.sin(a) * r }), out = [pt(CARACOL.boca + 0.25, 9), pt(CARACOL.boca + 0.25, mid)];
    for (let a = CARACOL.boca + 0.25; a <= CARACOL.boca + voltas * Math.PI * 2 - 0.25; a += 0.05) out.push(pt(a, mid));
    out.push(pt(CARACOL.boca + voltas * Math.PI * 2 - 0.25, mid), pt(CARACOL.boca - 0.25, 9));
    return out;
  };
  it("pelo CARACOL se sobe do térreo ao 2º e ao 3º andar, sem cair; e se desce de volta", () => {
    for (const id of ["estudoL", "estudoR"]) {
      const p = est(id), y0 = ALTURA_LOUNGE + p.h;
      const um = andar(p, subindo(1), y0); expect(um.y).toBeCloseTo(y0 + ANDARES_ESTUDO.pe, 6); expect(Math.hypot(um.l.x, um.l.z)).toBeGreaterThan(8.5); expect(um.maxQueda).toBeLessThan(0.6);
      const dois = andar(p, subindo(2), y0); expect(dois.y).toBeCloseTo(y0 + 2 * ANDARES_ESTUDO.pe, 6); expect(Math.hypot(dois.l.x, dois.l.z)).toBeGreaterThan(8.5);
      const desce = andar(p, [...subindo(2)].reverse(), y0 + 2 * ANDARES_ESTUDO.pe); expect(desce.y).toBeCloseTo(y0, 6);
    }
  });
  it("lá em cima o GUARDA-CORPO segura (não se cai no átrio) e a PAREDE fecha onde, no térreo, ficam as entradas", () => {
    const p = est("estudoL"), y2 = ALTURA_LOUNGE + p.h + 2 * ANDARES_ESTUDO.pe;
    const a = CARACOL.boca + Math.PI;   // (do lado oposto à boca)
    const r = andar(p, [{ x: Math.cos(a) * 10, z: Math.sin(a) * 10 }, { x: 0, z: 0 }], y2); expect(r.y).toBe(y2); expect(Math.hypot(r.l.x, r.l.z)).toBeGreaterThan(CARACOL.r);
    for (const ab of aberturasDe(p)) {   // rumo à entrada do térreo, no 3º andar: barrado na parede
      const fora = { x: p.x + Math.cos(ab.ang) * (p.r + 4), z: p.z + Math.sin(ab.ang) * (p.r + 4) }, l = noEstudoLocal(p, fora), l0 = noEstudoLocal(p, { x: p.x + Math.cos(ab.ang) * 18, z: p.z + Math.sin(ab.ang) * 18 });
      const s = andar(p, [l0, l], y2); expect(s.y).toBe(y2); expect(Math.hypot(s.l.x, s.l.z)).toBeLessThan(p.r);
    }
    // sem a altura dos pés (NPC, frota, teleporte): o térreo
    expect(alturaNaCidade(W(p.x + 15, p.z))).toBe(ALTURA_LOUNGE + p.h);
  });
});
