import { describe, it, expect } from "vitest";
import { classifyHeuristic, isQuickPrompt } from "./router";
import { isIntentId, INTENTS } from "./contracts";
import type { AgentContext } from "./context";

// Gate do PR02: cobre a HEURÍSTICA (classifyHeuristic) — determinística e SEM rede.
// O caminho Flash (classify) não é exercitado aqui de propósito (não bate na rede).
const ctx = (activeTab?: string): AgentContext => ({ activeTab });

describe("router · classifyHeuristic (sem rede)", () => {
  it("frase curta factual → dúvida rápida (mode quick)", () => {
    const r = classifyHeuristic("qual a capital da França?", ctx("estudos"));
    expect(r.intent).toBe("duvida_rapida");
    expect(r.mode).toBe("quick");
    expect(r.academicMode).toBe("flexible");
  });

  it("saudação curta → conversa (mode quick)", () => {
    const r = classifyHeuristic("oi, tudo bem?", ctx("estudos"));
    expect(r.intent).toBe("conversa");
    expect(r.mode).toBe("quick");
  });

  it('"gera um artigo sobre X" na pesquisa → criar_trabalho + enforced (gate canônico)', () => {
    const r = classifyHeuristic("gera um artigo sobre biotecnologia", ctx("pesquisa"));
    expect(r.intent).toBe("criar_trabalho");
    expect(r.mode).toBe("research");
    expect(r.academicMode).toBe("enforced");
    expect(r.kind).toBe("artigo");
  });

  it("normaliza acento em substantivo de trabalho (relatório → relatorio)", () => {
    // Só passa se `norm` remover o diacrítico antes de casar WORK_NOUNS/workKind.
    const r = classifyHeuristic("escreva um relatório sobre gestão pública", ctx("estudos"));
    expect(r.intent).toBe("criar_trabalho");
    expect(r.kind).toBe("relatorio");
  });

  it("verbo de geração + artefato de estudo → gerar_artefato (elaborated)", () => {
    const r = classifyHeuristic("crie um mapa mental sobre a Revolução Francesa", ctx("estudos"));
    expect(r.intent).toBe("gerar_artefato");
    expect(r.mode).toBe("elaborated");
  });

  it('pedido visual ("gera a molécula de X") → gerar_artefato (gate G1 anti-recusa)', () => {
    // Trava o patch visual: o pedido de imagem/molécula NÃO cai em explicar_conceito
    // (que faria a Aura "recusar" gerar visual) — vira artefato do Studio.
    const r = classifyHeuristic("gera a molécula de serotonina", ctx("estudos"));
    expect(r.intent).toBe("gerar_artefato");
  });

  it("pedido de fontes → pesquisar_fontes", () => {
    const r = classifyHeuristic("me indique fontes sobre mudanças climáticas", ctx("pesquisa"));
    expect(r.intent).toBe("pesquisar_fontes");
    expect(r.academicMode).toBe("enforced");
  });

  it("pedido de revisão → revisar", () => {
    const r = classifyHeuristic("revise meu texto por favor", ctx("estudos"));
    expect(r.intent).toBe("revisar");
  });

  it("explicação de conceito → explicar_conceito", () => {
    const r = classifyHeuristic("explique como funciona a fotossíntese", ctx("estudos"));
    expect(r.intent).toBe("explicar_conceito");
  });

  it("academicMode segue a sala: pesquisa=enforced, resto=flexible", () => {
    expect(classifyHeuristic("oi", ctx("pesquisa")).academicMode).toBe("enforced");
    expect(classifyHeuristic("oi", ctx("aula")).academicMode).toBe("flexible");
    expect(classifyHeuristic("oi", ctx(undefined)).academicMode).toBe("flexible");
  });

  it('força "a fundo" sobe o modo (explicar_conceito elaborated → research)', () => {
    const r = classifyHeuristic("me explique a fundo a relatividade", ctx("estudos"));
    expect(r.intent).toBe("explicar_conceito");
    expect(r.mode).toBe("research");
  });

  it("toda saída respeita os contratos (intent válido; mode compatível com a intenção)", () => {
    const samples = [
      "oi",
      "qual a capital da França?",
      "gera um artigo sobre economia",
      "crie um quiz sobre a Roma Antiga",
      "cite fontes sobre inteligência artificial",
      "revise meu ensaio",
      "explique o que é entropia",
    ];
    for (const s of samples) {
      const r = classifyHeuristic(s, ctx("estudos"));
      expect(isIntentId(r.intent)).toBe(true);
      expect(["quick", "elaborated", "research"]).toContain(r.mode);
      expect(["enforced", "flexible"]).toContain(r.academicMode);
      // sem sinal de "a fundo", o modo é exatamente o da tabela INTENTS
      if (!/a fundo|aprofund|detalhad|minucios|exaustiv|passo a passo/.test(s)) {
        expect(r.mode).toBe(INTENTS[r.intent].mode);
      }
    }
  });
});

describe("router · isQuickPrompt", () => {
  it("≤8 palavras = true; vazio/só-espaço = false; >8 = false", () => {
    expect(isQuickPrompt("qual a capital da França?")).toBe(true);
    expect(isQuickPrompt("um dois tres quatro cinco seis sete oito")).toBe(true); // 8
    expect(isQuickPrompt("um dois tres quatro cinco seis sete oito nove")).toBe(false); // 9
    expect(isQuickPrompt("")).toBe(false);
    expect(isQuickPrompt("   ")).toBe(false);
  });
});
