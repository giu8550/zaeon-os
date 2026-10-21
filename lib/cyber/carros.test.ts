import { describe, expect, it } from "vitest";
import { CIDADE, colisoresDaCidade, escadaEm } from "./ceu";
import { CARROS_NA_ZAEON, CARRO_PRACA, CORES_CARRO, LOTES_CARRO, vagaDoLote, vagasDeCarro } from "./carros";

describe("frota de carros", () => {
  const vagas = vagasDeCarro();
  it("a da praça continua sendo a 1ª, e cada lote da Zaeon tem filas × porFila vagas", () => {
    expect(vagas[0]).toMatchObject({ id: "praca", x: CARRO_PRACA.x, z: CARRO_PRACA.z, zaeon: false });
    expect(vagas.length).toBe(1 + (CARROS_NA_ZAEON ? LOTES_CARRO.reduce((s, l) => s + l.filas * l.porFila, 0) : 0));   // (sem os carros na Zaeon: só o da praça)
  });
  it("as vagas da Zaeon ficam no piso andável, longe dos colisores e das escadas, sem carro em cima de carro", () => {
    const col = colisoresDaCidade();
    for (const v of vagas.filter((x) => x.zaeon)) {
      const l = { x: v.x - CIDADE.centro.x, z: v.z - CIDADE.centro.z };
      expect(Math.hypot(l.x, l.z)).toBeLessThan(CIDADE.andavelR - 6);
      expect(escadaEm(l, 6)).toBeNull();
      expect(Math.min(...col.map((c) => Math.hypot(c.x - v.x, c.z - v.z) - c.r))).toBeGreaterThan(6);
      for (const o of vagas) if (o !== v) expect(Math.hypot(o.x - v.x, o.z - v.z)).toBeGreaterThan(4);
    }
  });
  it("o nariz aponta pra fora (pra borda) e as cores variam", () => {
    const l = LOTES_CARRO[0]!, v = vagaDoLote(l, 0, 0);
    const frente = { x: Math.sin(v.rumo), z: Math.cos(v.rumo) };
    expect(frente.x * v.x + frente.z * v.z).toBeGreaterThan(0);
    if (CARROS_NA_ZAEON) expect(new Set(vagas.map((x) => CORES_CARRO.indexOf(x.cor))).size).toBeGreaterThan(4);
  });
});

describe("carros online (presença)", () => {
  const A = "a".repeat(24), B = "b".repeat(24);
  it("saneia: só índices de carro que existem e números finitos", async () => {
    const { carroDe, carroLargadoDe, TOTAL_CARROS } = await import("./carros");
    expect(carroDe({ c: 0, y: 450.5, yaw: 1 })).toEqual({ carro: { c: 0, y: 450.5, yaw: 1 } });   // (o da praça — o único, sem os da Zaeon)
    expect(carroDe({ c: TOTAL_CARROS, y: 1, yaw: 0 })).toEqual({});
    expect(carroDe({ c: 1.5, y: 1, yaw: 0 })).toEqual({});
    expect(carroLargadoDe({ c: 0, x: 10, y: 450, z: -500, yaw: 0 })).toEqual({ carroLargado: { c: 0, x: 10, y: 450, z: -500, yaw: 0 } });
    expect(carroLargadoDe({ c: 0, x: "a", y: 450, z: -500, yaw: 0 })).toEqual({});
  });
  it("posse: dirigir vence estacionado; empate → o menor id; carro sem ninguém não aparece", async () => {
    const { posseDosCarros } = await import("./carros");
    const p = posseDosCarros([{ id: B, carro: { c: 1, y: 451, yaw: 0 } }, { id: A, carroLargado: { c: 1, x: 0, y: 450, z: 0, yaw: 0 } }, { id: A, carro: { c: 2, y: 452, yaw: 1 } }, { id: B, carro: { c: 2, y: 460, yaw: 0 } }]);
    expect(p.get(1)).toMatchObject({ dono: B, dirige: true });
    expect(p.get(2)).toMatchObject({ dono: A, dirige: true, y: 452 });
    expect(p.has(0)).toBe(false);
    expect(posseDosCarros([{ id: A, carroLargado: { c: 5, x: 1, y: 450, z: 2, yaw: 0 } }]).get(5)).toMatchObject({ dono: A, dirige: false, m: { x: 1, z: 2 } });
  });
});
