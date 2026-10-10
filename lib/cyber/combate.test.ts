import { describe, expect, it } from "vitest";
import { COMBO, JANELA_COMBO, VIDA_MAX, acabou, acerta, codificarGolpe, cortando, cortouEntre, danoDoGolpe, decodificarGolpe, levarGolpe, proximoGolpe } from "./combate";
import { ESPACOS, ITENS, equipar, inventarioInicial, sanitizarInventario } from "./inventario";
import { ARENA, BONECOS, PILARES_ARENA, naArena, pontoDeRenascer } from "./arena";
import { PORTAL_PRACA, PRACA } from "./praca";
import { poseGolpe } from "./posesCombate";

describe("inventário", () => {
  it("começa com a Espada Espiritual nível 7 no 1º espaço, equipada", () => {
    const inv = inventarioInicial();
    expect(inv.espacos).toHaveLength(ESPACOS); expect(inv.espacos[0]).toBe("espada-espiritual"); expect(inv.equipado).toBe("espada-espiritual");
    expect(ITENS["espada-espiritual"].nivel).toBe(7);
  });
  it("o que vem do navegador é limpo; só equipa o que está nos espaços", () => {
    expect(sanitizarInventario({ espacos: ["xyz", "espada-espiritual"], equipado: "xyz" })).toEqual({ espacos: [null, "espada-espiritual", ...Array(ESPACOS - 2).fill(null)], equipado: null });
    expect(sanitizarInventario(null)).toEqual(inventarioInicial());
    const vazio = { espacos: Array(ESPACOS).fill(null), equipado: null };
    expect(equipar(vazio, "espada-espiritual").equipado).toBeNull();
    expect(equipar(inventarioInicial(), null).equipado).toBeNull();
  });
});

describe("combate", () => {
  it("o combo: 1 → 2 → 3 encadeando; parado depois da janela, volta pro 1º", () => {
    let a = { golpe: proximoGolpe(null, 0), ini: 0, seq: 1 };
    expect(a.golpe.n).toBe(1);
    a = { golpe: proximoGolpe(a, a.golpe.dur + 0.1), ini: a.golpe.dur + 0.1, seq: 2 }; expect(a.golpe.n).toBe(2);
    a = { golpe: proximoGolpe(a, a.ini + a.golpe.dur), ini: a.ini + a.golpe.dur, seq: 3 }; expect(a.golpe.n).toBe(3);
    expect(proximoGolpe(a, a.ini + a.golpe.dur + 0.1).n).toBe(1);
    expect(proximoGolpe(a, a.ini + a.golpe.dur + JANELA_COMBO + 0.5).n).toBe(1);
  });
  it("só corta na janela ativa; acaba no fim", () => {
    const a = { golpe: COMBO[0]!, ini: 10, seq: 1 };
    expect(cortando(a, 10.05)).toBe(false); expect(cortando(a, 10 + a.golpe.ativoIni + 0.01)).toBe(true); expect(cortando(a, 10 + a.golpe.ativoFim + 0.05)).toBe(false);
    expect(acabou(a, 10 + a.golpe.dur + 1e-6)).toBe(true);
    expect(cortouEntre(a, 10.05, 10.4)).toBe(true);   // um quadro LONGO que engole a janela inteira ainda corta
    expect(cortouEntre(a, 10.3, 10.4)).toBe(false);
  });
  it("acerta na frente, no alcance; não pega atrás nem longe", () => {
    const g = COMBO[0]!, at = { x: 0, z: 0, rumo: 0 };
    expect(acerta(at, { x: 0, z: 2 }, "espada-espiritual", g)).toBe(true);
    expect(acerta(at, { x: 1.4, z: 1.4 }, "espada-espiritual", g)).toBe(true);
    expect(acerta(at, { x: 0, z: -2 }, "espada-espiritual", g)).toBe(false);
    expect(acerta(at, { x: 0, z: 5 }, "espada-espiritual", g)).toBe(false);
    expect(acerta(at, { x: 0, z: 3.4 }, "espada-espiritual", COMBO[2]!)).toBe(true);   // o pesado alcança mais
  });
  it("levar golpe: tira vida e empurra pra longe; no dash (desviando) ou protegido não pega; zera = caiu", () => {
    const g = COMBO[2]!, o = { arma: "espada-espiritual" as const, golpe: g, de: { x: 0, z: 0 }, em: { x: 0, z: 2 } };
    const r = levarGolpe(VIDA_MAX, { ...o, desviando: false, protegido: false });
    expect(r.pegou).toBe(true); expect(r.vida).toBe(VIDA_MAX - danoDoGolpe("espada-espiritual", g)); expect(r.empurrao.z).toBeGreaterThan(0);
    expect(levarGolpe(VIDA_MAX, { ...o, desviando: true, protegido: false })).toMatchObject({ pegou: false, desviou: true, vida: VIDA_MAX });
    expect(levarGolpe(VIDA_MAX, { ...o, desviando: false, protegido: true }).pegou).toBe(false);
    expect(levarGolpe(10, { ...o, desviando: false, protegido: false }).caiu).toBe(true);
    // um combo inteiro tira um bom pedaço, mas não mata de uma vez
    const combo = COMBO.reduce((s, x) => s + danoDoGolpe("espada-espiritual", x), 0); expect(combo).toBeGreaterThan(40); expect(combo).toBeLessThan(VIDA_MAX);
  });
  it("o golpe na presença (rede) vai e volta", () => {
    expect(decodificarGolpe(codificarGolpe(37, 3))).toEqual({ seq: 37, n: 3 });
  });
});

describe("a arena (a praça inteira)", () => {
  it("cabe na praça; pilares na borda, longe do buraco negro; bonecos dentro", () => {
    expect(ARENA.r).toBeLessThan(PRACA.r);
    for (const p of PILARES_ARENA) { expect(naArena(p)).toBe(true); expect(Math.hypot(p.x - PORTAL_PRACA.x, p.z - PORTAL_PRACA.z)).toBeGreaterThan(8); }
    for (const b of BONECOS) expect(naArena(b)).toBe(true);
    const r = pontoDeRenascer({ x: 10, z: 0 }); expect(naArena(r)).toBe(true); expect(r.x).toBeLessThan(0);
  });
});

describe("as poses dos golpes", () => {
  it("a lâmina VARRE: o 1º da direita pra esquerda pela frente; o 3º de cima pra frente-baixo", () => {
    const g1 = (u: number) => poseGolpe(1, u, [0.3, 0.57]).lamina;
    expect(g1(0.3)[2]).toBeLessThan(-0.3); expect(g1(0.43)[0]).toBeGreaterThan(0.5); expect(g1(0.57)[2]).toBeGreaterThan(0.5);
    const g3 = (u: number) => poseGolpe(3, u, [0.36, 0.55]).lamina;
    expect(g3(0.36)[0]).toBeLessThan(-0.3); expect(g3(0.46)[1]).toBeGreaterThan(0.5); expect(g3(0.55)[1]).toBeLessThan(-0.5);
    for (const n of [1, 2, 3] as const) for (let u = 0; u <= 1; u += 0.05) { const p = poseGolpe(n, u, [0.3, 0.55]); for (const d of [p.lamina, p.bracoD, p.anteD, p.tronco]) expect(Math.hypot(...d)).toBeCloseTo(1, 5); }
  });
});
