/**
 * Gate do PR02 (§13.1): a heurística do router classifica SEM rede.
 * Roda com: npx vitest run lib/agent/__tests__/router.test.ts
 *
 * A API real é `classifyHeuristic(objective, ctx)` — o contexto é OBRIGATÓRIO e a sala vem
 * em `ctx.activeTab` (é dela que sai o academicMode). Uma versão anterior deste teste
 * importava `heuristicClassify`/`detectWorkKind` (nomes que nunca existiram no router) e
 * passava `{ surface }`: ficou 7 testes vermelhos sem que nada de produção estivesse errado.
 */
import { describe, it, expect } from "vitest";
import { classifyHeuristic, isQuickPrompt } from "@/lib/agent/router";
import type { AgentContext } from "@/lib/agent/context";

const ctx = (activeTab?: string): AgentContext => ({ activeTab } as AgentContext);

describe("router / classifyHeuristic", () => {
  it("frase curta sem pergunta = conversa (quick)", () => {
    const c = classifyHeuristic("bom dia, tudo certo?", ctx());
    expect(["conversa", "duvida_rapida"]).toContain(c.intent);
    expect(c.mode).toBe("quick");
  });

  it("pergunta curta = duvida_rapida", () => {
    // "o que é" é sinal de EXPLICAÇÃO e vence o "curto" na precedência; uma pergunta curta
    // que não pede explicação é o que cai em duvida_rapida.
    const c = classifyHeuristic("quando foi a Revolução Francesa?", ctx());
    expect(c.intent).toBe("duvida_rapida");
  });

  it("pedir artefato do Studio = gerar_artefato", () => {
    const c = classifyHeuristic("gera um podcast sobre a Revolução Francesa", ctx());
    expect(c.intent).toBe("gerar_artefato");
    expect(c.mode).toBe("elaborated");
  });

  it("pedir trabalho na pesquisa = criar_trabalho + enforced + kind", () => {
    const c = classifyHeuristic("faz um artigo sobre redes neurais", ctx("pesquisa"));
    expect(c.intent).toBe("criar_trabalho");
    expect(c.academicMode).toBe("enforced");
    expect(c.kind).toBe("artigo");
  });

  it("estudos = academicMode flexible", () => {
    const c = classifyHeuristic("me explica cálculo diferencial em detalhes por favor", ctx("sala-de-estudos"));
    expect(c.academicMode).toBe("flexible");
  });

  it("pedir revisão = revisar", () => {
    const c = classifyHeuristic("revise este parágrafo e aponte melhorias", ctx());
    expect(c.intent).toBe("revisar");
  });

  it("reconhece TCC como tipo de trabalho", () => {
    const c = classifyHeuristic("escreva um TCC sobre energia solar", ctx("pesquisa"));
    expect(c.intent).toBe("criar_trabalho");
    expect(c.kind).toBe("tcc");
  });

  it("isQuickPrompt conta palavras", () => {
    expect(isQuickPrompt("oi")).toBe(true);
    expect(isQuickPrompt("uma frase bem longa que claramente passa de oito palavras aqui")).toBe(false);
  });
});
