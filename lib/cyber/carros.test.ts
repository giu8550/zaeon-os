import { describe, expect, it } from "vitest";
import { CIDADE, colisoresDaCidade, escadaEm } from "./ceu";
import { CARRO_PRACA, CORES_CARRO, LOTES_CARRO, vagaDoLote, vagasDeCarro } from "./carros";

describe("frota de carros", () => {
  const vagas = vagasDeCarro();
  it("a da praça continua sendo a 1ª, e cada lote da Zaeon tem filas × porFila vagas", () => {
    expect(vagas[0]).toMatchObject({ id: "praca", x: CARRO_PRACA.x, z: CARRO_PRACA.z, zaeon: false });
    expect(vagas.length).toBe(1 + LOTES_CARRO.reduce((s, l) => s + l.filas * l.porFila, 0));
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
    expect(new Set(vagas.map((x) => CORES_CARRO.indexOf(x.cor))).size).toBeGreaterThan(4);
  });
});
