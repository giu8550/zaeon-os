// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { faltandoPara, lerOpcoesSalvas } from "./ExportarTrabalho";

beforeEach(() => localStorage.clear());

describe("export — opções", () => {
  it("só a ABNT exige instituição e cidade", () => {
    const o = lerOpcoesSalvas("Fulano");
    expect(faltandoPara(o)).toEqual(["instituição", "cidade"]);
    expect(faltandoPara({ ...o, estilo: "vancouver" })).toEqual([]);
    expect(faltandoPara({ ...o, institution: "UFC", city: "Fortaleza" })).toEqual([]);
  });
  it("lembra o que foi salvo; lixo no storage cai no padrão", () => {
    localStorage.setItem("zaeon.export.meta.v1", JSON.stringify({ estilo: "apa", institution: "UFC", formato: "pdf", year: "" }));
    expect(lerOpcoesSalvas("Fulano")).toMatchObject({ estilo: "apa", institution: "UFC", formato: "pdf", author: "Fulano", year: String(new Date().getFullYear()) });
    localStorage.setItem("zaeon.export.meta.v1", JSON.stringify({ estilo: "mla", formato: "rtf" }));
    expect(lerOpcoesSalvas("x")).toMatchObject({ estilo: "abnt", formato: "docx" });
  });
});
