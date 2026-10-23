import { describe, it, expect } from "vitest";
import { converterCitacoes } from "./citacoes";
import { lerReferencia } from "./referencias";

const refs = [
  lerReferencia("LIMA, Ana. Solos tropicais. Revista Solo, 2019."),
  lerReferencia("SOUZA, Carla; SILVA, Pedro. Água e plantas C4. Revista Botânica, 2020."),
  lerReferencia("COSTA, João. Não citado. Editora, 2018."),
];
const texto = "As C4 economizam água (SOUZA; SILVA, 2020, p. 12). Lima (2019) mostrou o contrário (LIMA, 2019; SOUZA; SILVA, 2020). Outro (FULANO, 2001).";

describe("chamadas no texto → norma do export", () => {
  it("Vancouver: número na ordem de 1ª citação, lista reordenada (não citadas no fim), desconhecida fica", () => {
    const r = converterCitacoes([texto], refs, "vancouver");
    expect(r.textos[0]).toBe("As C4 economizam água [1]. Lima [2] mostrou o contrário [1,2]. Outro (FULANO, 2001).");
    expect(r.refs.map((x) => x.title)).toEqual(["Água e plantas C4", "Solos tropicais", "Não citado"]);
  });
  it("APA: autor-data em caixa normal, & entre dois autores, página mantida", () => {
    const r = converterCitacoes([texto], refs, "apa");
    expect(r.textos[0]).toBe("As C4 economizam água (Souza & Silva, 2020, p. 12). Lima (2019) mostrou o contrário (Lima, 2019; Souza & Silva, 2020). Outro (Fulano, 2001).");
    expect(r.refs).toBe(refs);
  });
  it("APA: 3+ autores ou et al. = 'et al.'; parêntese comum não é tocado", () => {
    expect(converterCitacoes(["(SILVA et al., 2019) e (veja o anexo 2020)"], [], "apa").textos[0]).toBe("(Silva et al., 2019) e (veja o anexo 2020)");
    expect(converterCitacoes(["(LIMA; SOUZA; COSTA, 2019)"], [], "apa").textos[0]).toBe("(Lima et al., 2019)");
  });
  it("ABNT: nada muda", () => {
    expect(converterCitacoes([texto], refs, "abnt").textos[0]).toBe(texto);
  });
});
