import { describe, it, expect } from "vitest";
import { layoutCartolina, cardsFromAura, gerarCartolina, TIPOS, type AuraCartolina } from "./cartolina";

const AURA_OK: AuraCartolina = {
  titulo: "O Ciclo da Água",
  itens: [
    { tipo: "nota", titulo: "Evaporação", corpo: "O sol transforma água em vapor." },
    { tipo: "nota", titulo: "Condensação", corpo: "O vapor esfria e vira nuvem." },
    { tipo: "pergunta", corpo: "Por que chove mais no verão?" },
    { tipo: "exercicio", corpo: "Liste as 4 fases.", resposta: "Evaporação, condensação, precipitação, escoamento." },
    { tipo: "prancha", legenda: "diagrama do ciclo da água" },
    { tipo: "video", titulo: "Ciclo em 3 min", legenda: "visão geral rápida" },
  ],
};

describe("layoutCartolina", () => {
  it("põe o título primeiro, no topo-esquerda", () => {
    const cards = layoutCartolina(AURA_OK);
    expect(cards[0].tipo).toBe("titulo");
    expect(cards[0].titulo).toBe("O Ciclo da Água");
    expect(cards[0].x).toBeLessThan(200);
  });

  it("é determinístico: mesmos itens → mesmas posições", () => {
    const a = layoutCartolina(AURA_OK);
    const b = layoutCartolina(AURA_OK);
    expect(a).toEqual(b);
  });

  it("gera um card por item (+1 do título) e sem sobreposição exata", () => {
    const cards = layoutCartolina(AURA_OK);
    expect(cards.length).toBe(AURA_OK.itens.length + 1);
    const chaves = new Set(cards.map((c) => `${c.x},${c.y}`));
    expect(chaves.size).toBe(cards.length); // posições distintas
  });

  it("ignora itens de tipo inválido ou 'titulo' repetido", () => {
    const cards = layoutCartolina({ titulo: "X", itens: [{ tipo: "titulo" as any }, { tipo: "lixo" as any }, { tipo: "nota", corpo: "ok" }] });
    expect(cards.filter((c) => c.tipo === "titulo").length).toBe(1);
    expect(cards.some((c) => c.tipo === "nota")).toBe(true);
    expect(cards.length).toBe(2); // título + 1 nota
  });
});

describe("cardsFromAura (robustez)", () => {
  it("lida com lixo/undefined sem quebrar (cai no título padrão)", () => {
    expect(cardsFromAura(undefined)[0].tipo).toBe("titulo");
    expect(cardsFromAura({})[0].titulo).toBe("Estudo");
    expect(cardsFromAura({ titulo: "  ", itens: "nope" as any }).length).toBe(1);
  });
  it("todos os tipos emitidos são válidos", () => {
    const cards = cardsFromAura(AURA_OK);
    expect(cards.every((c) => TIPOS.includes(c.tipo))).toBe(true);
  });
});

describe("gerarCartolina (gen injetável, LLM mockado)", () => {
  it("usa o JSON do gen e aplica layout", async () => {
    const gen = async () => AURA_OK;
    const cards = await gerarCartolina("ciclo da água", gen);
    expect(cards[0].titulo).toBe("O Ciclo da Água");
    expect(cards.length).toBe(AURA_OK.itens.length + 1);
  });

  it("tópico vazio → nenhuma geração", async () => {
    const cards = await gerarCartolina("   ", async () => AURA_OK);
    expect(cards).toEqual([]);
  });

  it("erro do gen → degrada numa cartolina mínima com o título do tópico", async () => {
    const gen = async () => { throw new Error("vertex 404"); };
    const cards = await gerarCartolina("harmonia musical", gen);
    expect(cards.length).toBe(1);
    expect(cards[0].tipo).toBe("titulo");
    expect(cards[0].titulo).toBe("harmonia musical");
  });

  it("título genérico vindo da Aura é substituído pelo tópico", async () => {
    const gen = async () => ({ titulo: "Estudo", itens: [{ tipo: "nota", corpo: "x" }] });
    const cards = await gerarCartolina("fotossíntese", gen);
    expect(cards[0].titulo).toBe("fotossíntese");
  });
});
