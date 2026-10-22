import { describe, expect, it } from "vitest";
import { ALTURA_LANCAMENTO, FABRICA, LOTES, MOTO, PLATAFORMA_MOTO, TOTAL_VAGAS, lookDaVaga, baseDoRobo, esvaziou, fabricaNova, largadasValidas, motoDe, motoLargadaDe, motoParaMontar, moverRobo, passoFabrica, progressoDaVaga, tamanhoDoLote, vagas } from "./motos";
import { ALTURA_LOUNGE, CIDADE, alturaNaCidade, colisoresDaCidade, mundo, naIlhaPrincipal } from "./ceu";
import { NOS } from "./buracos";
import { PRACA } from "./praca";
import { BASES_CEU_LOCAIS } from "./bases";
import { HELIPORTO, POIS } from "./landmarks";
import { VOO } from "./voo";

const ID_A = "a".repeat(24), ID_B = "b".repeat(24);

describe("motos voadoras — estacionamentos (chão + GARAGEM da Zaeon)", () => {
  it("chão: 1 fila de 4; a GARAGEM: todas as outras (no mínimo 12); na plataforma central da Zaeon, nenhuma", () => {
    const v = vagas();
    expect(v).toHaveLength(TOTAL_VAGAS);
    expect(v.filter((x) => !x.ceu)).toHaveLength(4);
    expect(v.filter((x) => x.ceu).length).toBeGreaterThanOrEqual(12);
    expect(v.slice(0, 4).every((x) => !x.ceu)).toBe(true);
  });
  it("vagas BEM espaçadas (nada de moto encostando na outra) e todas viradas pro centro do lote", () => {
    const v = vagas();
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (v[i]!.lote === v[j]!.lote) expect(Math.hypot(v[i]!.x - v[j]!.x, v[i]!.z - v[j]!.z)).toBeGreaterThanOrEqual(4.5);
    for (const x of v) {
      const alvo = x.ceu ? CIDADE.centro : PRACA, fx = Math.sin(x.yaw), fz = Math.cos(x.yaw), dx = alvo.x - x.x, dz = alvo.z - x.z;
      expect((fx * dx + fz * dz) / Math.hypot(dx, dz)).toBeGreaterThan(0.9);   // a frente aponta pro centro
    }
  });
  it("os lotes da GARAGEM (e as bases dos robôs) ficam no disco da garagem, na altura das salas, longe das paredes e dos móveis", () => {
    const g = CIDADE.salas.garagem, gw = mundo(g), cs = colisoresDaCidade();
    for (const l of LOTES.filter((x) => x.id === "garagem")) {
      expect(l.alt).toBeCloseTo(ALTURA_LOUNGE + 0.16, 6);
      for (const v of [...vagas().filter((x) => x.lote === LOTES.indexOf(l)), baseDoRobo(l)]) {
        expect(Math.hypot(v.x - gw.x, v.z - gw.z)).toBeLessThan(g.r - 6);   // dentro da garagem, longe do guarda-corpo
        for (const c of cs) expect(Math.hypot(v.x - c.x, v.z - c.z)).toBeGreaterThan(c.r + 2);
      }
    }
    const zaeon = LOTES.findIndex((l) => l.id === "zaeon");
    for (const v of vagas().filter((x) => x.ceu && x.lote !== zaeon)) expect(Math.hypot(v.x - CIDADE.centro.x, v.z - CIDADE.centro.z)).toBeGreaterThan(CIDADE.bordaR);   // (a garagem fica fora da central)
  });
  it("o lote da PLATAFORMA da Zaeon (out/2026): no piso da central, longe dos colisores e de onde se chega; o total cabe no servidor (32)", () => {
    const cs = colisoresDaCidade(), z = LOTES.findIndex((l) => l.id === "zaeon"), ch = NOS.zaeon.chegada;
    expect(z).toBeGreaterThan(0); expect(TOTAL_VAGAS).toBeLessThanOrEqual(32);
    for (const v of vagas().filter((x) => x.lote === z)) {
      expect(naIlhaPrincipal(v)).toBe(true); expect(alturaNaCidade(v)).toBe(0);
      for (const c of cs) expect(Math.hypot(v.x - c.x, v.z - c.z)).toBeGreaterThan(c.r + 2);
      expect(Math.hypot(v.x - ch.x, v.z - ch.z)).toBeGreaterThan(15);
    }
  });
  it("o lote da praça cabe na ilha (sem chão!) e não encosta no heliporto nem em marcos sólidos", () => {
    const l = LOTES[0]!, r = tamanhoDoLote(l).r;
    expect(Math.hypot(l.x - PRACA.x, l.z - PRACA.z) + r).toBeLessThan(PRACA.r - 2);
    expect(Math.hypot(l.x - HELIPORTO.x, l.z - HELIPORTO.z)).toBeGreaterThan(HELIPORTO.r + r);
    for (const p of POIS.filter((x) => x.solido !== false && x.preset !== "estacionamento")) expect(Math.hypot(l.x - p.x, l.z - p.z)).toBeGreaterThan(p.footprintR + r);
  });
});

describe("presença da moto", () => {
  it("motoDe: vaga inteira válida, altura com teto, rumo finito, `de` só se for um id de verdade", () => {
    expect(motoDe({ s: 6, y: 231.5, yaw: 1 })).toEqual({ moto: { s: 6, y: 231.5, yaw: 1 } });
    expect(motoDe({ s: 3, y: 1, yaw: 0, de: ID_A })).toEqual({ moto: { s: 3, y: 1, yaw: 0, de: ID_A } });
    expect(motoDe({ s: 3, y: 1, yaw: 0, de: "<script>" })).toEqual({ moto: { s: 3, y: 1, yaw: 0 } });
    expect(motoDe({ s: TOTAL_VAGAS, y: 1, yaw: 0 })).toEqual({});
    expect(motoDe({ s: 1.5, y: 1, yaw: 0 })).toEqual({});
    expect(motoDe({ s: 0, y: 9999, yaw: 99 })).toEqual({ moto: { s: 0, y: MOTO.teto, yaw: 10 } });
    expect(motoDe("lixo")).toEqual({}); expect(motoDe(null)).toEqual({});
  });
  it("motoLargadaDe: só números válidos; lixo → nada", () => {
    expect(motoLargadaDe({ s: 2, x: 10, y: 450, z: -700, yaw: 1 })).toEqual({ motoLargada: { s: 2, x: 10, y: 450, z: -700, yaw: 1 } });
    expect(motoLargadaDe({ s: 99, x: 0, y: 0, z: 0, yaw: 0 })).toEqual({});
    expect(motoLargadaDe({ s: 1, x: "a", y: 0, z: 0, yaw: 0 })).toEqual({});
  });
  it("estacionada que alguém PEGOU (presença com `de`) some — ninguém vê a moto em dobro", () => {
    const l = { s: 1, x: 5, y: 0, z: 6, yaw: 0 };
    expect(largadasValidas([{ id: ID_A, motoLargada: l }])).toEqual([{ dono: ID_A, m: l }]);
    expect(largadasValidas([{ id: ID_A, motoLargada: l }, { id: ID_B, moto: { s: 1, y: 3, yaw: 0, de: ID_A } }])).toEqual([]);
  });
});

describe("montar", () => {
  const v = vagas(), yV = (x: { ceu: boolean }) => (x.ceu ? CIDADE.pisoY : 0);
  it("a vaga PRONTA mais perto, no alcance e no MESMO nível (no chão não pega a da Zaeon)", () => {
    expect(motoParaMontar({ x: v[1]!.x + 1, z: v[1]!.z }, 0, () => true, yV, [])).toEqual({ tipo: "vaga", s: 1 });
    expect(motoParaMontar({ x: v[1]!.x + 1, z: v[1]!.z }, 0, (i) => i !== 1, yV, [])?.s).not.toBe(1);   // sendo fabricada: não
    expect(motoParaMontar({ x: v[5]!.x, z: v[5]!.z }, CIDADE.pisoY, () => true, yV, [])).toEqual({ tipo: "vaga", s: 5 });
    expect(motoParaMontar({ x: v[5]!.x, z: v[5]!.z }, 0, () => true, yV, [])).toBeNull();
  });
  it("uma ESTACIONADA ganha da vaga se estiver mais perto", () => {
    const l = { dono: ID_A, m: { s: 7, x: v[0]!.x + 0.5, y: 0, z: v[0]!.z, yaw: 0 } };
    expect(motoParaMontar({ x: v[0]!.x + 0.6, z: v[0]!.z }, 0, () => true, yV, [l])).toEqual({ tipo: "largada", dono: ID_A, s: 7 });
  });
});

describe("a FÁBRICA (o robô que repõe as motos)", () => {
  it("NÃO sai na hora: espera a vaga ficar livre por FABRICA.espera s seguidos (quem levou a moto vai embora primeiro)", () => {
    const f = fabricaNova(); esvaziou(f, 4); esvaziou(f, 4);
    expect(f.fila.map((x) => x.s)).toEqual([4]);
    let ocupada = true; const livre = () => !ocupada;
    for (let i = 0; i < 100; i++) passoFabrica(f, 0.1, false, livre);   // 10 s com o piloto em cima: nada
    expect(f.tarefa).toBeNull();
    ocupada = false; passoFabrica(f, FABRICA.espera - 0.5, false, livre); expect(f.tarefa).toBeNull();
    ocupada = true; passoFabrica(f, 0.1, false, livre); ocupada = false;   // voltou alguém: o relógio zera
    passoFabrica(f, FABRICA.espera - 0.5, false, livre); expect(f.tarefa).toBeNull();
    passoFabrica(f, 1, false, livre); expect(f.tarefa).toMatchObject({ s: 4, fase: "ida" });
  });
  it("vai até a vaga, fabrica em FABRICA.fabrica s e ela fica pronta; uma de cada vez", () => {
    const f = fabricaNova(); esvaziou(f, 4); esvaziou(f, 6);
    passoFabrica(f, FABRICA.espera + 0.1, false); expect(f.tarefa).toMatchObject({ s: 4, fase: "ida" });
    expect(progressoDaVaga(f, 4)).toBe(0); expect(progressoDaVaga(f, 6)).toBe(0); expect(progressoDaVaga(f, 5)).toBe(1);
    expect(passoFabrica(f, 5, false)).toBeNull();   // ainda voando (só fabrica ao CHEGAR)
    passoFabrica(f, 0.1, true); expect(f.tarefa).toMatchObject({ s: 4, fase: "fabrica" });
    passoFabrica(f, FABRICA.fabrica / 2, true); expect(progressoDaVaga(f, 4)).toBeCloseTo(0.5, 1);
    expect(passoFabrica(f, FABRICA.fabrica, true)).toBe(4);
    expect(progressoDaVaga(f, 4)).toBe(1);
    passoFabrica(f, 0.1, false); expect(f.tarefa).toMatchObject({ s: 6, fase: "ida" });   // a 6 já esperou o bastante
  });
  it("o robô voa até o alvo (sem passar dele) e para em cima — devagar (vel ≤ 7 m/s)", () => {
    let p = { x: 0, y: 3, z: 0 }; const alvo = { x: 20, y: 3, z: 0 };
    for (let i = 0; i < 30; i++) p = moverRobo(p, alvo, 1 / 30);
    expect(p.x).toBeGreaterThan(3); expect(p.x).toBeLessThanOrEqual(7.01);
    for (let i = 0; i < 300; i++) p = moverRobo(p, alvo, 1 / 30);
    expect(Math.hypot(p.x - alvo.x, p.z - alvo.z)).toBeLessThan(0.01);
  });
});

describe("look das motos (cor + carenagem)", () => {
  it("cores DIFERENTES em cada vaga de um estacionamento (e vizinhas nunca iguais); carenagens variando", () => {
    for (const l of [0, 1]) {
      const ids = vagas().map((v, i) => ({ v, i })).filter((x) => x.v.lote === l).map((x) => x.i);
      const cores = ids.map((i) => lookDaVaga(i).cor);
      expect(new Set(cores).size).toBe(cores.length);
      expect(new Set(ids.map((i) => lookDaVaga(i).estilo)).size).toBeGreaterThan(1);
    }
    expect(lookDaVaga(3)).toEqual(lookDaVaga(3));   // o mesmo pra todo mundo
  });
  it("a plataforma de lançamento: a moto parada fica em cima dela e, montada, sai acima do 'rente ao chão' (anda na hora)", () => {
    expect(PLATAFORMA_MOTO.altura).toBeGreaterThan(0.5);
    expect(ALTURA_LANCAMENTO).toBeGreaterThan(VOO.decolar);
  });
});
