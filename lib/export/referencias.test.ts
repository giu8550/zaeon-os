import { describe, it, expect } from "vitest";
import { lerReferencia, linhasDeReferencia, sobrenome } from "./referencias";

describe("referência ABNT em texto → campos", () => {
  it("artigo de periódico com DOI", () => {
    const r = lerReferencia("SOUZA, Carla; LIMA, Pedro Henrique. Água e plantas C4: uma revisão. Revista Brasileira de Botânica, v. 42, n. 2, p. 10-20, 2019. DOI: 10.1000/rbb.2019.1.");
    expect(r).toMatchObject({ authors: ["SOUZA, Carla", "LIMA, Pedro Henrique"], title: "Água e plantas C4: uma revisão", venue: "Revista Brasileira de Botânica", year: 2019, doi: "10.1000/rbb.2019.1" });
  });
  it("iniciais no nome não fecham o bloco de autores; livro (Cidade: Editora) não vira veículo", () => {
    const r = lerReferencia("SILVA, A. B. Fisiologia vegetal. 2. ed. São Paulo: Editora UFC, 2021.");
    expect(r.authors).toEqual(["SILVA, A. B"]);
    expect(r.title).toBe("Fisiologia vegetal");
    expect(r.venue).toBeUndefined();
    expect(r.year).toBe(2021);
  });
  it("site com URL e 'Acesso em' (o ano do acesso não conta)", () => {
    const r = lerReferencia("IBGE. Censo agro. Rio de Janeiro, 2017. Disponível em: https://www.ibge.gov.br/censo. Acesso em: 3 mar. 2026.");
    expect(r.url).toBe("https://www.ibge.gov.br/censo");
    expect(r.year).toBe(2017);
  });
  it("linha que não segue a norma fica só com o texto", () => {
    const r = lerReferencia("artigo sem formato nenhum de alguém");
    expect(r.authors).toEqual([]);
    expect(r.text).toBe("artigo sem formato nenhum de alguém");
  });
  it("linhas da seção e sobrenomes", () => {
    expect(linhasDeReferencia("- SILVA, A. Obra. 2020.\n\n2. SOUZA, C. Outra. 2021.\n")).toEqual(["SILVA, A. Obra. 2020.", "SOUZA, C. Outra. 2021."]);
    expect([sobrenome("SILVA, Ana"), sobrenome("Ana Beatriz Silva")]).toEqual(["SILVA", "Silva"]);
  });
});
