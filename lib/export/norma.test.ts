import { describe, it, expect } from "vitest";
import { prepararParaNorma } from "./norma";

const secoes = [
  { type: "introducao", title: "INTRODUÇÃO", content: "Economizam água (SOUZA, 2020).", subsections: [{ title: "Contexto", content: "Ver Lima (2019)." }] },
  { type: "referencias", title: "REFERÊNCIAS", content: "LIMA, Ana. Solos. Revista Solo, 2019.\nSOUZA, Carla. Água. Revista Botânica, 2020.", subsections: [] },
];

describe("prepararParaNorma", () => {
  it("ABNT passa intacto (o motor de sempre)", () => {
    expect(prepararParaNorma(secoes, [], "abnt")).toEqual({ sections: secoes, references: null });
  });
  it("Vancouver: REFERÊNCIAS sai do corpo, vira campos na ordem de citação; subseção também é convertida", () => {
    const r = prepararParaNorma(secoes, [], "vancouver");
    expect(r.sections.map((s) => s.title)).toEqual(["INTRODUÇÃO"]);
    expect(r.sections[0].content).toBe("Economizam água [1].");
    expect(r.sections[0].subsections[0].content).toBe("Ver Lima [2].");
    expect(r.references!.map((x) => x.title)).toEqual(["Água", "Solos"]);
  });
  it("citações salvas entram (estruturadas ou em texto) sem duplicar a mesma obra", () => {
    const r = prepararParaNorma(secoes, [{ text: "x", authors: ["Souza, Carla"], title: "Água", year: 2020 }, { text: "COSTA, João. Outra. Editora, 2018." }], "apa");
    expect(r.references!.map((x) => x.title)).toEqual(["Solos", "Água", "Outra"]);
    expect(r.sections[0].content).toBe("Economizam água (Souza, 2020).");
  });
});
