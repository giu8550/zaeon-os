import { describe, it, expect } from "vitest";
import { ETAPAS_LAB, avancarTutorialLab, contarPalavras, encerrarTutorialLab, falaDaEtapa, iniciarTutorialLab, lerTutorialLab, paginasDe, temaDoTexto, temaNoTutorial, SUGESTOES_CONVERSA } from "./tutorialLab";

describe("tutorial do tablet", () => {
  it("a 1ª vez é SÓ gerar a pesquisa: tema → pesquisa na tela roxa → gerar → abrir → chat → salvar (o resto é o tour da sala)", () => {
    expect(ETAPAS_LAB.map((e) => e.id)).toEqual(["tema", "pesquisando", "gerar", "abrir", "chat-pesquisa", "salvar", "fim"]);
    expect(ETAPAS_LAB[0]!.fala).toMatch(/chocolate, morango, o vento, cachoeiras/);
    // as etapas obrigatórias só andam com a ação (evento); as de "ver" andam no Próximo
    const pa = (id: string) => ETAPAS_LAB.find((e) => e.id === id)!;
    for (const id of ["tema", "pesquisando", "gerar", "abrir", "salvar"]) expect(pa(id).avancaEm.length).toBeGreaterThan(0);
    expect(pa("chat-pesquisa").avancaEm).toEqual([]);
    // o balão do salvar não pode cobrir o modal de salvar
    expect(pa("salvar").evitar).toContain('[data-tour="modal-salvar"]');
    expect(pa("chat-pesquisa").fala).toMatch(/volte aqui depois pra continuar essa pesquisa se quiser.*Hoje você só deve entregar pra mim/);
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
  it("pula pra frente (nunca volta): a pesquisa pronta leva pro gerar; gerar ainda pesquisando leva direto pro abrir", async () => {
    const { iniciarTutorialLab, avancarTutorialLab, avancarAte, lerTutorialLab, SALTOS_LAB } = await import("./tutorialLab");
    iniciarTutorialLab(); avancarTutorialLab({ tema: "chocolate" });
    expect(lerTutorialLab().etapa).toBe("pesquisando");
    avancarAte(SALTOS_LAB["zaeon:research:done"]!); expect(lerTutorialLab().etapa).toBe("gerar");
    avancarAte(SALTOS_LAB["zaeon:research:draftdone"]!); expect(lerTutorialLab().etapa).toBe("abrir");
    avancarAte("gerar"); expect(lerTutorialLab().etapa).toBe("abrir");   // não volta
    avancarAte(SALTOS_LAB["zaeon:research:newdoc"]!); expect(lerTutorialLab().etapa).toBe("chat-pesquisa");
  });
});

describe("o balão do Droid não cobre o caminho", async () => {
  const { posicaoDoBalao, uniaoDe } = await import("./tutorialLab");
  const b = { w: 440, h: 170 }, W = 1280, H = 800;
  const cobre = (p: { left: number; top: number; w: number }, c: { x: number; y: number; w: number; h: number }) =>
    p.left < c.x + c.w && p.left + p.w > c.x && p.top < c.y + c.h && p.top + b.h * (b.w / p.w) > c.y;
  it("embaixo do destaque quando cabe; em cima quando não", () => {
    const a = { x: 400, y: 100, w: 200, h: 40 };
    expect(posicaoDoBalao(a, W, H, b).top).toBeGreaterThan(a.y + a.h);
    const baixo = { x: 400, y: 700, w: 200, h: 40 };
    expect(posicaoDoBalao(baixo, W, H, b).top + b.h).toBeLessThan(baixo.y);
  });
  it("o MODAL de salvar no meio da tela: o balão vai pro lado ou pro canto, sem cobrir nada (o bug do “Salvar”)", () => {
    const modal = { x: 340, y: 60, w: 600, h: 680 };
    const p = posicaoDoBalao(modal, W, H, b);
    expect(cobre(p, modal)).toBe(false);
    expect(p.w).toBeLessThan(b.w); expect(p.w).toBeGreaterThanOrEqual(250);
    expect(p.left).toBeGreaterThanOrEqual(12); expect(p.left + p.w).toBeLessThanOrEqual(W - 12);
  });
  it("tela toda tomada: fica dentro da tela, no lugar que menos cobre", () => {
    const p = posicaoDoBalao({ x: 0, y: 0, w: W, h: H }, W, H, b);
    expect(p.top).toBeGreaterThanOrEqual(12); expect(p.top + b.h).toBeLessThanOrEqual(H - 12);
  });
  it("sem destaque, no pé da tela; a união cobre o alvo e o modal", () => {
    expect(posicaoDoBalao(null, W, H, b)).toEqual({ left: (W - b.w) / 2, top: H - b.h - 24, w: b.w });
    expect(uniaoDe([{ x: 10, y: 10, w: 10, h: 10 }, null, { x: 50, y: 0, w: 10, h: 40 }])).toEqual({ x: 10, y: 0, w: 50, h: 40 });
    expect(uniaoDe([null])).toBeNull();
  });
});
