import { describe, expect, it } from "vitest";
import { itensDosBoards, proximaRaridade } from "./itens";
import type { CardEstudo } from "./board";

const estudo = (id: string, n: number): CardEstudo[] => [
  { id, tipo: "estudo", x: 0, y: 0, w: 380, titulo: `Estudo ${id}` },
  ...Array.from({ length: n }, (_, i): CardEstudo => ({ id: `${id}-c${i}`, tipo: "confirmacao", x: 0, y: 0, w: 320, pai: id, titulo: `f${i}`, fontes: [{ titulo: `P${id}${i}`, url: `https://x.org/${id}/${i}` }] })),
];

describe("os estudos viram ITENS do game (livros que evoluem)", () => {
  it("um item por estudo, os mais fortes primeiro, com a raridade e o nível do blueprint", () => {
    const itens = itensDosBoards([{ id: "b1", cards: [...estudo("e1", 1), ...estudo("e2", 5)] }, { id: "b2", cards: [{ id: "n", tipo: "nota", x: 0, y: 0, w: 260 }] }]);
    expect(itens.map((i) => i.cardId)).toEqual(["e2", "e1"]); expect(itens[0]!.id).toBe("b1:e2");
    expect(itens[0]!.nivel).toBeGreaterThan(itens[1]!.nivel); expect(itens[0]!.componentes).toBe(5);
  });
  it("a EVOLUÇÃO: quanto falta pra próxima raridade; lendária não tem próxima", () => {
    expect(proximaRaridade(10)).toEqual({ raridade: "rara", faltam: 15 }); expect(proximaRaridade(30)).toEqual({ raridade: "epica", faltam: 20 });
    expect(proximaRaridade(60)).toEqual({ raridade: "lendaria", faltam: 15 }); expect(proximaRaridade(80)).toBeNull();
  });
});
