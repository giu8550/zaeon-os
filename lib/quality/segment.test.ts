import { describe, it, expect } from "vitest";
import { splitParagraphs, mapAcademicLevel, buildScoreRequest } from "@/lib/quality/segment";

describe("splitParagraphs", () => {
  it("divide por linhas em branco e ignora marcadores # / ##", () => {
    expect(splitParagraphs("# INTRO\nPar um.\n\n## Sub\nPar dois.")).toEqual([
      "Par um.",
      "Par dois.",
    ]);
  });

  it("retorna vazio para conteúdo só de espaços", () => {
    expect(splitParagraphs("   \n\n  ")).toEqual([]);
  });
});

describe("mapAcademicLevel", () => {
  it("mapeia rótulos PT para o enum do motor", () => {
    expect(mapAcademicLevel("Graduação")).toBe("grad");
    expect(mapAcademicLevel("Mestrado")).toBe("msc");
    expect(mapAcademicLevel("Doutorado")).toBe("phd");
    expect(mapAcademicLevel("Pós-Doutorado")).toBe("postdoc");
  });

  it("usa grad como padrão para desconhecido/ausente", () => {
    expect(mapAcademicLevel(undefined)).toBe("grad");
    expect(mapAcademicLevel("xpto")).toBe("grad");
  });
});

describe("buildScoreRequest", () => {
  it("usa o parser ABNT quando há marcadores", () => {
    const doc = "# INTRODUÇÃO\nTexto da intro.\n\n# CONCLUSÃO\nTexto da conclusão.";
    const req = buildScoreRequest(doc, "Meu título", "TCC", "grad");
    expect(req.title).toBe("Meu título");
    expect(req.work_type).toBe("TCC");
    expect(req.sections.length).toBe(2);
    expect(req.sections[0].type).toBe("introducao");
    expect(req.sections[1].type).toBe("conclusao");
  });

  it("cai para seção única quando não há marcadores", () => {
    const req = buildScoreRequest("Só um texto corrido.", "T", "Artigo", "msc");
    expect(req.sections.length).toBe(1);
    expect(req.sections[0].type).toBe("desenvolvimento");
  });
});
