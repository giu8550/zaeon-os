import { describe, expect, it } from "vitest";
import { AREAS_CONHECIMENTO, areasDaRodada } from "@/components/main/ZaeonFlowDiagram";

describe("'ideia' do Como funciona: áreas de conhecimento (ninguém fica de fora)", () => {
  it("cada rodada traz 4 áreas da lista, sem repetir dentro da rodada", () => {
    for (let r = 0; r < 60; r++) {
      const a = areasDaRodada(r, 4);
      expect(a).toHaveLength(4); expect(new Set(a).size).toBe(4);
      for (const x of a) expect(AREAS_CONHECIMENTO).toContain(x);
    }
  });
  it("TODAS as áreas aparecem antes de alguma repetir", () => {
    const rodadas = Math.ceil(AREAS_CONHECIMENTO.length / 4);
    const vistas = new Set(Array.from({ length: rodadas }, (_, r) => areasDaRodada(r, 4)).flat());
    expect(vistas.size).toBe(AREAS_CONHECIMENTO.length);
  });
  it("a mesma rodada desenha igual (desktop e celular batem)", () => {
    expect(areasDaRodada(9, 4)).toEqual(areasDaRodada(9, 4));
  });
});
