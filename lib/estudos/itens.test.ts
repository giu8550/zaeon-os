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

describe("pesquisa como item do inventário", () => {
  it("conta as páginas pelas palavras (mínimo 1) e limpa o título", async () => {
    const { pesquisaComoItem } = await import("./itens");
    const it1 = pesquisaComoItem({ id: "w1", title: "Chocolate.pdf", content: "uma frase curta", updatedAt: new Date("2026-10-11T00:00:00Z") });
    expect(it1).toMatchObject({ id: "w1", titulo: "Chocolate", paginas: 1, palavras: 3, atualizadoEm: "2026-10-11T00:00:00.000Z" });
    const it2 = pesquisaComoItem({ id: "w2", title: null, content: Array(650).fill("palavra").join(" "), updatedAt: null });
    expect(it2).toMatchObject({ titulo: "Pesquisa sem título", paginas: 3, atualizadoEm: null });
  });
});
