import { describe, it, expect } from "vitest";
import { segmentarBlocos, segmentarInline, temMatematica } from "./matematica";

describe("segmentarBlocos", () => {
  it("$$…$$ e \\[…\\] multilinha viram fórmula em destaque", () => {
    expect(segmentarBlocos("a\n$$\nx^2 + 1\n$$\nb")).toEqual([
      { tipo: "texto", conteudo: "a\n" }, { tipo: "formula", conteudo: "x^2 + 1" }, { tipo: "texto", conteudo: "\nb" },
    ]);
    expect(segmentarBlocos("\\[ \\int_0^1 x\\,dx \\]")).toEqual([{ tipo: "formula", conteudo: "\\int_0^1 x\\,dx" }]);
  });
  it("```grafico vira bloco de gráfico", () => {
    const b = segmentarBlocos('veja:\n```grafico\n{"funcoes":["x^2"]}\n```\nfim');
    expect(b[1]).toEqual({ tipo: "grafico", conteudo: '{"funcoes":["x^2"]}' });
  });
  it("delimitador sem par (streaming) fica texto", () => {
    expect(segmentarBlocos("a $$x^2")).toEqual([{ tipo: "texto", conteudo: "a $$x^2" }]);
  });
});

describe("segmentarInline", () => {
  it("$…$ e \\(…\\)", () => {
    expect(segmentarInline("seja $f(x)=x^2$ e \\(g\\) ok")).toEqual([
      { tipo: "texto", conteudo: "seja " }, { tipo: "formula", conteudo: "f(x)=x^2" },
      { tipo: "texto", conteudo: " e " }, { tipo: "formula", conteudo: "g" }, { tipo: "texto", conteudo: " ok" },
    ]);
  });
  it("dinheiro não é fórmula", () => {
    for (const s of ["custa R$ 10,00 e R$20", "de $5 a $10", "US$ 3 milhões", "paguei $ 4 e $ 5", "de $5 e $10 dólares"]) {
      expect(segmentarInline(s).every((p) => p.tipo === "texto"), s).toBe(true);
    }
  });
  it("número sozinho entre $ é fórmula (catetos $3$ e $4$)", () => {
    expect(segmentarInline("catetos $3$ e $4$").filter((p) => p.tipo === "formula").map((p) => p.conteudo)).toEqual(["3", "4"]);
  });
  it("cifrão escapado e $ sem par", () => {
    expect(segmentarInline("\\$5")).toEqual([{ tipo: "texto", conteudo: "$5" }]);
    expect(segmentarInline("a $x^2 sem fim")).toEqual([{ tipo: "texto", conteudo: "a $x^2 sem fim" }]);
  });
  it("temMatematica", () => {
    expect(temMatematica("a $x^2$")).toBe(true);
    expect(temMatematica("```grafico\n{}\n```")).toBe(true);
    expect(temMatematica("R$ 10")).toBe(false);
  });
});
