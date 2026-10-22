import { describe, it, expect } from "vitest";
import { alternarEnfase, alternarLista, aplicarEstilo, estiloNoCursor, montarPagina, trechosComEnfase, palavrasDaPagina } from "./pagina";

const s = (titulo: string, corpo = "") => ({ id: titulo.toLowerCase().replace(/\W+/g, "-"), titulo, corpo });

describe("montarPagina — a numeração ABNT", () => {
  it("textuais 1, 2, 3; resumo/referências sem número e centralizadas; subseção 1.1 pelo ##", () => {
    const p = montarPagina([
      s("RESUMO", "r."), s("INTRODUÇÃO", "a.\n\n## Contexto\n\nb.\n\n## Problema\n\nc."), s("METODOLOGIA", "m."), s("REFERÊNCIAS", "SILVA, A. Obra. 2020."),
    ]);
    expect(p.map((x) => x.numero)).toEqual([null, "1", "2", null]);
    expect(p.map((x) => x.centralizada)).toEqual([true, false, false, true]);
    expect(p[3].referencias).toBe(true);
    expect(p[1].blocos.map((b) => b.texto)).toEqual(["a."]);
    expect(p[1].subs.map((x) => [x.numero, x.titulo, x.blocos.map((b) => b.texto)])).toEqual([["1.1", "Contexto", ["b."]], ["1.2", "Problema", ["c."]]]);
  });
  it("figuras/tabelas/quadros numeram no trabalho inteiro (não por seção)", () => {
    const p = montarPagina([
      s("A", "%%tabela T1\n| a | b |\n| 1 | 2 |"),
      s("B", "%%tabela T2\n| a | b |\n| 1 | 2 |\n\n%%quadro Q1\n| x |\n| y |"),
    ]);
    expect(p[0].blocos[0].n).toBe(1);
    expect(p[1].blocos.map((b) => b.n)).toEqual([2, 1]);
  });
  it("conta palavras", () => expect(palavrasDaPagina([s("A", "um dois  três"), s("B", " ")])).toBe(3));
});

describe("ênfase inline (prévia = motor)", () => {
  it("negrito e itálico colados no texto; asterisco solto fica literal", () => {
    expect(trechosComEnfase("o *termo* tem **duas** leituras; p < 0,05* ok")).toEqual([
      { t: "o " }, { t: "termo", italico: true }, { t: " tem " }, { t: "duas", negrito: true }, { t: " leituras; p < 0,05* ok" },
    ]);
    expect(trechosComEnfase("sem nada")).toEqual([{ t: "sem nada" }]);
  });
});

describe("barra estilo Word", () => {
  it("negrito envolve a seleção (espaços das pontas ficam de fora) e de novo desfaz", () => {
    const e = alternarEnfase({ value: "um dois três", start: 3, end: 8 }, "**");
    expect(e).toEqual({ value: "um **dois** três", start: 5, end: 9 });
    expect(alternarEnfase(e, "**")).toEqual({ value: "um dois três", start: 3, end: 7 });
  });
  it("itálico sem seleção insere o par com o cursor no meio; não confunde com negrito", () => {
    expect(alternarEnfase({ value: "ab", start: 1, end: 1 }, "*")).toEqual({ value: "a**b", start: 2, end: 2 });
    const neg = { value: "x **y** z", start: 4, end: 5 };
    expect(alternarEnfase(neg, "*").value).toBe("x ***y*** z");
  });
  it("lista: liga nas linhas tocadas, numera a numerada, e desliga quando todas já são", () => {
    const v = "intro\nprimeiro\nsegundo\nfim";
    const e = alternarLista({ value: v, start: 7, end: 20 }, "marcadores");
    expect(e.value).toBe("intro\n- primeiro\n- segundo\nfim");
    expect(alternarLista(e, "marcadores").value).toBe(v);
    expect(alternarLista({ value: v, start: 7, end: 20 }, "numerada").value).toBe("intro\n1. primeiro\n2. segundo\nfim");
  });
  it("estilo do parágrafo: subseção (##), citação (aspas) e volta ao normal; a caixa lê o do cursor", () => {
    const v = "a\n\nUm trecho citado\n\nb";
    const sub = aplicarEstilo({ value: v, start: 5, end: 5 }, "subsecao");
    expect(sub.value).toBe("a\n\n## Um trecho citado\n\nb");
    expect(estiloNoCursor(sub.value, 6)).toBe("subsecao");
    const cit = aplicarEstilo(sub, "citacao");
    expect(cit.value).toBe("a\n\n“Um trecho citado”\n\nb");
    expect(estiloNoCursor(cit.value, 5)).toBe("citacao");
    expect(aplicarEstilo(cit, "normal").value).toBe(v);
  });
});
