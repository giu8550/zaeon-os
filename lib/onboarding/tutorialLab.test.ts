import { describe, it, expect } from "vitest";
import { ETAPAS_LAB, avancarTutorialLab, contarPalavras, encerrarTutorialLab, falaDaEtapa, iniciarTutorialLab, lerTutorialLab, paginasDe, temaDoTexto, temaNoTutorial, SUGESTOES_CONVERSA } from "./tutorialLab";

describe("tutorial do tablet", () => {
  it("a ordem pedida: tema → pesquisa na tela roxa → referências → relacionados → bandeja → gerar → abrir → salvar", () => {
    expect(ETAPAS_LAB.map((e) => e.id)).toEqual(["tema", "pesquisando", "referencias", "relacionados", "bandeja", "gerar", "abrir", "salvar", "fim"]);
    expect(ETAPAS_LAB[0]!.fala).toMatch(/chocolate, morango, o vento, cachoeiras/);
    // as etapas obrigatórias só andam com a ação (evento); as de "ver" andam no Próximo
    const pa = (id: string) => ETAPAS_LAB.find((e) => e.id === id)!;
    for (const id of ["tema", "pesquisando", "gerar", "abrir", "salvar"]) expect(pa(id).avancaEm.length).toBeGreaterThan(0);
    for (const id of ["referencias", "relacionados", "bandeja"]) expect(pa(id).avancaEm).toEqual([]);
  });
  it("o estado anda e guarda o tema; no tema, a mensagem não vai pro chat", () => {
    iniciarTutorialLab(); expect(temaNoTutorial()).toBe(true);
    avancarTutorialLab({ tema: "chocolate" });
    expect(lerTutorialLab()).toMatchObject({ ativo: true, etapa: "pesquisando", tema: "chocolate" });
    expect(temaNoTutorial()).toBe(false);
    expect(falaDaEtapa(ETAPAS_LAB[1]!, "chocolate")).toMatch(/“chocolate”/);
    encerrarTutorialLab(); expect(lerTutorialLab().ativo).toBe(false);
    avancarTutorialLab(); expect(lerTutorialLab().etapa).toBe("fim");   // encerrado, não anda
  });
  it("o tema sai sem o começo da sugestão", () => {
    expect(temaDoTexto("Quero estudar sobre: chocolate.")).toBe("chocolate");
    expect(temaDoTexto("Me ensina a fazer pão")).toBe("fazer pão");
    expect(temaDoTexto("Faz isso aqui pra mim: um resumo de cachoeiras!")).toBe("um resumo de cachoeiras");
    expect(temaDoTexto("o vento")).toBe("o vento");
    expect(SUGESTOES_CONVERSA).toHaveLength(3);
  });
  it("páginas do livro: ~300 palavras por página, no mínimo 1", () => {
    expect(paginasDe(0)).toBe(1); expect(paginasDe(300)).toBe(1); expect(paginasDe(301)).toBe(2);
    expect(contarPalavras("A fotossíntese — luz, água e CO₂ (2024).")).toBe(7);
  });
});

describe("o tour não trava esperando uma ação que já aconteceu", () => {
  it("pula pra frente (nunca volta): gerar durante as referências leva direto pro abrir", async () => {
    const { iniciarTutorialLab, avancarTutorialLab, avancarAte, lerTutorialLab, SALTOS_LAB } = await import("./tutorialLab");
    iniciarTutorialLab(); avancarTutorialLab({ tema: "chocolate" }); avancarAte("referencias");
    expect(lerTutorialLab().etapa).toBe("referencias");
    avancarAte(SALTOS_LAB["zaeon:research:draftdone"]!); expect(lerTutorialLab().etapa).toBe("abrir");
    avancarAte("referencias"); expect(lerTutorialLab().etapa).toBe("abrir");   // não volta
    avancarAte(SALTOS_LAB["zaeon:research:newdoc"]!); expect(lerTutorialLab().etapa).toBe("salvar");
  });
});
