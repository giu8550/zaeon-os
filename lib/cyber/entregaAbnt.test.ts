import { describe, it, expect } from "vitest";
import { REQUISITOS_ENTREGA, avaliarEntrega, contarCitacoes, contarReferencias, temModelo } from "./entregaAbnt";

const enche = (n: number, base = "a fotossíntese converte luz em energia química nas plantas verdes") => {
  const ws = base.split(" "); return Array.from({ length: n }, (_, i) => ws[i % ws.length]).join(" ");
};
const REFS = [
  "SILVA, João. Fotossíntese e clima. São Paulo: Ática, 2019.",
  "SOUZA, M. A.; LIMA, R. Cloroplastos. Revista X, v. 2, p. 10-20, 2021.",
  "OLIVEIRA, Ana. Plantas. Rio de Janeiro: Y, 2018.",
  "COSTA, P. Energia verde. Fortaleza: UFC, 2020.",
  "PEREIRA, Luiz. Biologia vegetal. 3. ed. Recife: Z, 2017.",
].join("\n");
const completa = [
  "# RESUMO", enche(80), "Palavras-chave: fotossíntese; clima; plantas.",
  "# INTRODUÇÃO", enche(300), "Segundo (SILVA, 2019), a luz é essencial. Souza (2021) mostra o mesmo.",
  "# DESENVOLVIMENTO", "## Metodologia", enche(500), "Como afirma (OLIVEIRA, 2018), há variações.", "## Resultados", enche(500),
  "# CONCLUSÃO", enche(200), "(COSTA, 2020)",
  "# REFERÊNCIAS", REFS,
].join("\n");

describe("a entrega ao Droid (ABNT completa)", () => {
  it("uma pesquisa completa e estruturada é aceita", () => {
    const a = avaliarEntrega({ titulo: "Fotossíntese e o clima", conteudo: completa });
    expect(a.faltando).toEqual([]); expect(a.aceito).toBe(true); expect(a.paginas).toBeGreaterThanOrEqual(5);
  });
  it("o esboço do tutorial (curto, sem referências/citações) é recusado — e o Droid diz o que falta", () => {
    const a = avaliarEntrega({ titulo: "Chocolate", conteudo: "# INTRODUÇÃO\nO chocolate vem do cacau.\n# METODOLOGIA\nRevisão.\n# REFERÊNCIAS\n" });
    expect(a.aceito).toBe(false);
    expect(a.faltando.join(" | ")).toMatch(/RESUMO.*INTRODUÇÃO.*DESENVOLVIMENTO.*CONCLUSÃO.*REFERÊNCIAS.*CITAÇÕES.*mais conteúdo/);
  });
  it("sem marcadores de seção: falta a estrutura ABNT", () => {
    expect(avaliarEntrega({ titulo: "Algo", conteudo: enche(2000) }).faltando[0]).toMatch(/estrutura ABNT/);
  });
  it("sem título, com trecho de modelo ou com poucas referências: recusa", () => {
    expect(avaliarEntrega({ titulo: "Pesquisa sem título", conteudo: completa }).faltando).toContain("um título de verdade");
    expect(avaliarEntrega({ titulo: "X título", conteudo: completa + "\n[Escreva aqui a discussão]" }).aceito).toBe(false);
    expect(avaliarEntrega({ titulo: "X título", conteudo: completa.replace(REFS, REFS.split("\n").slice(0, 2).join("\n")) }).faltando.join(" ")).toMatch(/REFERÊNCIAS.*tem 2/);
  });
  it("conta referências ABNT e citações nos formatos comuns", () => {
    expect(contarReferencias(REFS)).toBe(REQUISITOS_ENTREGA.refsMin);
    expect(contarReferencias("Um texto qualquer de 2020.")).toBe(0);
    expect(contarCitacoes("(SILVA, 2019) e (SOUZA; LIMA, 2021, p. 12) e Costa (2020) e Pereira et al. (2017)")).toBe(4);
    expect(temModelo("[Escreva aqui]")).toBe(true); expect(temModelo("texto normal")).toBe(false);
  });
});
