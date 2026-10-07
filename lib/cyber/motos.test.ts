import { describe, expect, it } from "vitest";
import { FABRICA, LOTES, MOTO, TOTAL_VAGAS, baseDoRobo, esvaziou, fabricaNova, largadasValidas, motoDe, motoLargadaDe, motoParaMontar, moverRobo, passoFabrica, progressoDaVaga, tamanhoDoLote, vagas } from "./motos";
import { CIDADE, colisoresDaCidade, mundo, naIlhaPrincipal, noPortalVolta } from "./ceu";
import { BASES_CEU_LOCAIS } from "./bases";
import { HELIPORTO, POIS } from "./landmarks";

const ID_A = "a".repeat(24), ID_B = "b".repeat(24);

describe("motos voadoras — estacionamentos (chão + Zaeon)", () => {
  it("chão: 1 fila de 4; ZAEON: no mínimo 12 vagas (2 filas de 6)", () => {
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
      const alvo = x.ceu ? CIDADE.centro : { x: 0, z: 0 }, fx = Math.sin(x.yaw), fz = Math.cos(x.yaw), dx = alvo.x - x.x, dz = alvo.z - x.z;
      expect((fx * dx + fz * dz) / Math.hypot(dx, dz)).toBeGreaterThan(0.9);   // a frente aponta pro centro
    }
  });
  it("o lote da Zaeon (e a base do robô) fica no piso andável, longe do portal de volta, das bases do dono e dos colisores da cidade", () => {
    const zaeon = LOTES.find((l) => l.id === "zaeon")!, base = baseDoRobo(zaeon);
    for (const v of [...vagas().filter((x) => x.ceu), base]) {
      expect(naIlhaPrincipal(v)).toBe(true);
      expect(Math.hypot(v.x - CIDADE.centro.x, v.z - CIDADE.centro.z)).toBeLessThan(CIDADE.andavelR - 3);
      expect(noPortalVolta(v)).toBe(false);
      for (const b of BASES_CEU_LOCAIS) { const w = mundo(b); expect(Math.hypot(v.x - w.x, v.z - w.z)).toBeGreaterThan(8); }
      for (const c of colisoresDaCidade()) expect(Math.hypot(v.x - c.x, v.z - c.z)).toBeGreaterThan(c.r + 2);
    }
  });
  it("o lote do chão não encosta no heliporto nem em marcos sólidos", () => {
    const l = LOTES[0]!, r = tamanhoDoLote(l).r;
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
  it("vaga esvaziou → o robô vai até ela, fabrica em FABRICA.fabrica s e ela fica pronta; uma de cada vez, em ordem", () => {
    const f = fabricaNova(); esvaziou(f, 4); esvaziou(f, 6); esvaziou(f, 4);
    expect(f.fila).toEqual([4, 6]);
    expect(passoFabrica(f, 0.1, false)).toBeNull(); expect(f.tarefa).toMatchObject({ s: 4, fase: "ida" });
    expect(progressoDaVaga(f, 4)).toBe(0); expect(progressoDaVaga(f, 6)).toBe(0); expect(progressoDaVaga(f, 5)).toBe(1);
    expect(passoFabrica(f, 5, false)).toBeNull();   // ainda voando (só fabrica ao CHEGAR)
    passoFabrica(f, 0.1, true); expect(f.tarefa).toMatchObject({ s: 4, fase: "fabrica" });
    passoFabrica(f, FABRICA.fabrica / 2, true); expect(progressoDaVaga(f, 4)).toBeCloseTo(0.5, 1);
    expect(passoFabrica(f, FABRICA.fabrica, true)).toBe(4);
    expect(progressoDaVaga(f, 4)).toBe(1);
    passoFabrica(f, 0.1, false); expect(f.tarefa).toMatchObject({ s: 6, fase: "ida" });
  });
  it("o robô voa até o alvo (sem passar dele) e para em cima", () => {
    let p = { x: 0, y: 3, z: 0 }; const alvo = { x: 20, y: 3, z: 0 };
    for (let i = 0; i < 30; i++) p = moverRobo(p, alvo, 1 / 30);
    expect(p.x).toBeGreaterThan(5); expect(p.x).toBeLessThan(20);
    for (let i = 0; i < 300; i++) p = moverRobo(p, alvo, 1 / 30);
    expect(Math.hypot(p.x - alvo.x, p.z - alvo.z)).toBeLessThan(0.01);
  });
});
