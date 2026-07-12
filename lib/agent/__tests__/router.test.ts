/**
 * Gate do PR02 (§13.1): a heurística do router classifica SEM rede.
 * Roda com: npx vitest run lib/agent/__tests__/router.test.ts
 */
import { describe, it, expect } from "vitest";
import { heuristicClassify, detectWorkKind, isQuickPrompt } from "@/lib/agent/router";

describe("router / heuristicClassify", () => {
  it("frase curta sem pergunta = conversa (quick)", () => {
    const c = heuristicClassify("bom dia, tudo certo?");
    expect(["conversa", "duvida_rapida"]).toContain(c.intent);
    expect(c.mode).toBe("quick");
  });

  it("pergunta curta = duvida_rapida", () => {
    const c = heuristicClassify("o que é fotossíntese?");
    expect(c.intent).toBe("duvida_rapida");
  });

  it("pedir artefato do Studio = gerar_artefato", () => {
    const c = heuristicClassify("gera um podcast sobre a Revolução Francesa");
    expect(c.intent).toBe("gerar_artefato");
    expect(c.mode).toBe("elaborated");
  });

  it("pedir trabalho na pesquisa = criar_trabalho + enforced + kind", () => {
    const c = heuristicClassify("faz um artigo sobre redes neurais", { surface: "pesquisa" });
    expect(c.intent).toBe("criar_trabalho");
    expect(c.academicMode).toBe("enforced");
    expect(c.kind).toBe("artigo");
  });

  it("estudos = academicMode flexible", () => {
    const c = heuristicClassify("me explica cálculo diferencial em detalhes por favor", { surface: "sala-de-estudos" });
    expect(c.academicMode).toBe("flexible");
  });

  it("pedir revisão = revisar", () => {
    const c = heuristicClassify("revise este parágrafo e aponte melhorias");
    expect(c.intent).toBe("revisar");
  });

  it("detectWorkKind reconhece TCC", () => {
    expect(detectWorkKind("preciso de um TCC sobre X")).toBe("tcc");
  });

  it("isQuickPrompt conta palavras", () => {
    expect(isQuickPrompt("oi")).toBe(true);
    expect(isQuickPrompt("uma frase bem longa que claramente passa de oito palavras aqui")).toBe(false);
  });
});
