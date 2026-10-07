import { describe, it, expect } from "vitest";
import { artefatoDeAprender, assuntoDe, pedeAprender, pedeEngenhariaReversa } from "./aprender";
import { classifyHeuristic } from "./router";
import { resolveHarnessOutput } from "./aura-harness";

describe("regra de disparo do aprender interativo", () => {
  it("explicar_conceito → SEMPRE um diagrama interativo do assunto", () => {
    expect(artefatoDeAprender("explicar_conceito", "Como funciona o DNS?", {})).toEqual({ studioKind: "diagram", title: "Como funciona o DNS" });
  });
  it("dúvida rápida só vira diagrama se for de aprender", () => {
    expect(artefatoDeAprender("duvida_rapida", "como funciona a fotossíntese", {})).not.toBeNull();
    expect(artefatoDeAprender("duvida_rapida", "quantos ossos tem o corpo", {})).toBeNull();
  });
  it("conversa, trabalho, fontes e revisão não ganham diagrama", () => {
    for (const i of ["conversa", "criar_trabalho", "pesquisar_fontes", "revisar", "gerar_artefato"] as const) {
      expect(artefatoDeAprender(i, "me explica a revolução francesa", {})).toBeNull();
    }
  });
  it("nunca um segundo diagrama/mapa na mesma resposta", () => {
    expect(artefatoDeAprender("explicar_conceito", "x", { artifacts: [{ studioKind: "mindmap" }] })).toBeNull();
    expect(artefatoDeAprender("explicar_conceito", "x", { artifacts: [{ studioKind: "molecule", title: "cafeína" }] })).not.toBeNull();
  });
  it("engenharia reversa (modo leve) é explicação + diagrama", () => {
    expect(pedeEngenhariaReversa("faz engenharia reversa de como o Shazam reconhece música")).toBe(true);
    expect(pedeEngenhariaReversa("me explica a mitose")).toBe(false);
    expect(classifyHeuristic("faz engenharia reversa de como o Shazam reconhece música", { activeTab: "pesquisa" } as any).intent).toBe("explicar_conceito");
    expect(artefatoDeAprender("conversa", "faz engenharia reversa de como o Shazam reconhece música", {})?.title).toBe("como o Shazam reconhece música");
  });
  it("assunto sem o 'me explica' da frente", () => {
    expect(assuntoDe("Me explica como funciona a fotossíntese?")).toBe("como funciona a fotossíntese");
    expect(assuntoDe("quero aprender sobre buracos negros")).toBe("buracos negros");
    expect(pedeAprender("Quero entender melhor a inflação")).toBe(true);
  });
  it("o roteador manda 'quero aprender X' pra explicar_conceito", () => {
    expect(classifyHeuristic("quero aprender sobre buracos negros e relatividade", { activeTab: "estudos" } as any).intent).toBe("explicar_conceito");
  });
});

describe("resolveHarnessOutput leva o diagrama junto (sem trocar a resposta pelo artefato)", () => {
  const answer = { nucleo: "O DNS traduz nomes em IPs…", artifacts: [{ studioKind: "molecule", title: "x" }] };
  it("explicar_conceito: texto + molécula + diagrama", () => {
    const out = resolveHarnessOutput({ intent: "explicar_conceito", artifacts: [] } as any, answer as any, "estudos", "como funciona o DNS");
    expect(out.mode).toBe("structured");
    if (out.mode === "structured") {
      expect(out.answer.nucleo).toBe(answer.nucleo);
      expect(out.answer.artifacts?.map((a) => a.studioKind)).toEqual(["molecule", "diagram"]);
      expect(out.answer.artifacts?.[1].explicito).toBeUndefined(); // falha calado: ninguém pediu
    }
  });
  it("conversa fica sem diagrama", () => {
    const out = resolveHarnessOutput({ intent: "conversa", artifacts: [] } as any, { nucleo: "oi!" } as any, "estudos", "oi");
    expect(out.mode === "structured" && out.answer.artifacts).toBeFalsy();
  });
});
