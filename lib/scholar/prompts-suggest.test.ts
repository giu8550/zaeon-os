import { describe, it, expect } from "vitest";
import { buildSuggestSystemPrompt, buildSuggestUserMessage } from "./prompts-suggest";

describe("prompts-suggest", () => {
  it("inclui o bloco de calibração do nível pedido", () => {
    expect(buildSuggestSystemPrompt("msc", [])).toMatch(/MESTRANDO/);
    expect(buildSuggestSystemPrompt("phd", [])).toMatch(/DOUTORANDO/);
  });
  it("injeta os títulos a excluir como restrição", () => {
    const p = buildSuggestSystemPrompt("grad", ["Título A", "Título B"]);
    expect(p).toMatch(/RESTRIÇÃO/);
    expect(p).toMatch(/Título A/);
    expect(p).toMatch(/Título B/);
  });
  it("nível inválido cai no grad", () => {
    expect(buildSuggestSystemPrompt("xxx" as any, [])).toMatch(/GRADUANDO/);
  });
  it("a mensagem do usuário carrega o tópico", () => {
    expect(buildSuggestUserMessage("redes neurais")).toMatch(/redes neurais/);
  });
  it("pede JSON puro no formato esperado", () => {
    const p = buildSuggestSystemPrompt("postdoc", []);
    expect(p).toMatch(/"gap_score"/);
    expect(p).toMatch(/JSON/);
  });
});
