import { describe, it, expect } from "vitest";
import { pedeGraficoMatematico, DIRETRIZ_MATEMATICA } from "./matematica";

describe("pedeGraficoMatematico", () => {
  it.each([
    "faz o gráfico de f(x) = x² - 4", "esboça a parábola y = x^2", "desenha o gráfico da função seno",
    "plota a reta 2x+1", "me mostra o gráfico de x^2-4", "desenhe um triângulo retângulo de catetos 3 e 4",
    "desenha o vetor (2,1) no plano cartesiano", "gráfico da função exponencial",
  ])("%s → true", (s) => expect(pedeGraficoMatematico(s)).toBe(true));
  it.each([
    "faz um gráfico de pizza das vendas", "desenha um gato", "crie um mapa mental de funções orgânicas",
    "qual a fórmula da área do círculo?", "faz uma imagem de uma floresta",
  ])("%s → false", (s) => expect(pedeGraficoMatematico(s)).toBe(false));
});

describe("DIRETRIZ_MATEMATICA", () => {
  it("ensina $…$, $$…$$ e o bloco ```grafico com JSON válido", () => {
    expect(DIRETRIZ_MATEMATICA).toContain("$...$");
    expect(DIRETRIZ_MATEMATICA).toContain("$$...$$");
    const json = /```grafico\n(.+)\n```/.exec(DIRETRIZ_MATEMATICA)?.[1];
    expect(() => JSON.parse(json!)).not.toThrow();
  });
});

describe("roteamento de gráfico matemático", () => {
  it("heurística: gráfico de função vai pra explicação (texto com ```grafico), não pra artefato de imagem", async () => {
    const { classifyHeuristic } = await import("./router");
    expect(classifyHeuristic("faz o gráfico de f(x) = x^2 - 4", {}).intent).toBe("explicar_conceito");
    expect(classifyHeuristic("cria um mapa mental de funções", {}).intent).toBe("gerar_artefato");
  });
  it("sem diagrama archify de brinde quando o pedido é gráfico de função", async () => {
    const { artefatoDeAprender } = await import("./aprender");
    expect(artefatoDeAprender("explicar_conceito", "esboça a parábola y = x^2", {})).toBeNull();
    expect(artefatoDeAprender("explicar_conceito", "como funciona a fotossíntese", {})).not.toBeNull();
  });
  it("fórmula nunca vira imagem no pickStudioKind", async () => {
    const { pickStudioKind } = await import("./aura-harness");
    expect(pickStudioKind("gere a fórmula de bhaskara")).not.toBe("image");
  });
});
