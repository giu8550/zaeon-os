import { describe, it, expect } from "vitest";
import { prioridadeDe, deveNotificar, tituloComBadge, tituloBase, trecho, Agrupador } from "./notificacoes";

const EU = "e".repeat(24), OUTRO = "o".repeat(24);

describe("notificacoes · prioridade", () => {
  it("minha própria mensagem = nenhuma", () => {
    expect(prioridadeDe({ autorTipo: "humano", autorId: EU, texto: "oi" }, { meuId: EU })).toBe("nenhuma");
  });
  it("#423 · aviso de que EU entrei não me notifica; o de outra pessoa entrando, sim (normal)", () => {
    expect(prioridadeDe({ autorTipo: "sistema", autorId: EU, texto: "Giulia entrou no escritório" }, { meuId: EU })).toBe("nenhuma");
    expect(prioridadeDe({ autorTipo: "sistema", autorId: OUTRO, texto: "Martinez entrou no escritório" }, { meuId: EU })).toBe("normal");
  });
  it("resposta do MEU agente = alta; de outro agente = normal", () => {
    expect(prioridadeDe({ autorTipo: "agente", autorId: "aura", texto: "..." }, { meuId: EU, meusAgentes: ["aura"] })).toBe("alta");
    expect(prioridadeDe({ autorTipo: "agente", autorId: "nina", texto: "..." }, { meuId: EU, meusAgentes: ["aura"] })).toBe("normal");
  });
  it("@mention a mim = alta; humano comum = normal", () => {
    expect(prioridadeDe({ autorTipo: "humano", autorId: OUTRO, texto: "ei @Don olha" }, { meuId: EU, meusAliases: ["don"] })).toBe("alta");
    expect(prioridadeDe({ autorTipo: "humano", autorId: OUTRO, texto: "ei pessoal" }, { meuId: EU, meusAliases: ["don"] })).toBe("normal");
  });
});

describe("notificacoes · deveNotificar", () => {
  it("só fora da tela e nunca pra mim", () => {
    expect(deveNotificar({ prioridade: "normal", abaVisivel: true, canalAberto: true })).toBe(false);
    expect(deveNotificar({ prioridade: "normal", abaVisivel: false, canalAberto: true })).toBe(true);
    expect(deveNotificar({ prioridade: "normal", abaVisivel: true, canalAberto: false })).toBe(true);
    expect(deveNotificar({ prioridade: "nenhuma", abaVisivel: false, canalAberto: false })).toBe(false);
  });
});

describe("notificacoes · badge/trecho/agrupador", () => {
  it("título com badge zera limpo", () => {
    expect(tituloComBadge("Zaeon", 3)).toBe("(3) Zaeon");
    expect(tituloComBadge("(3) Zaeon", 0)).toBe("Zaeon");
    expect(tituloComBadge("(99+) Zaeon", 120)).toBe("(99+) Zaeon");
    expect(tituloBase("(2) X")).toBe("X");
  });
  it("trecho corta com reticência", () => {
    expect(trecho("a\n b   c")).toBe("a b c");
    expect(trecho("x".repeat(100), 10)).toHaveLength(10);
    expect(trecho("x".repeat(100), 10).endsWith("…")).toBe(true);
  });
  it("agrupa por canal na janela; alta fura", () => {
    const g = new Agrupador(4000);
    expect(g.deveDisparar("c1", "normal", 0)).toBe(true);
    expect(g.deveDisparar("c1", "normal", 1000)).toBe(false);
    expect(g.deveDisparar("c2", "normal", 1000)).toBe(true);
    expect(g.deveDisparar("c1", "alta", 2000)).toBe(true);
    expect(g.deveDisparar("c1", "normal", 6001)).toBe(true);
  });
});
