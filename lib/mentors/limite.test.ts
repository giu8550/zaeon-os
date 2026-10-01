import { describe, it, expect } from "vitest";
import { limiteContratacao, podeContratar, mensagemTeto, LIMITE_ALUNO, LIMITE_PROFESSOR } from "./limite";

describe("limite · contratação por papel", () => {
  it("aluno 3 / professor 10 / sem sessão 3", () => {
    expect(limiteContratacao({ user: { role: "student", email: "a@b.c" } })).toBe(LIMITE_ALUNO);
    expect(limiteContratacao({ user: { role: "teacher", email: "a@b.c" } })).toBe(LIMITE_PROFESSOR);
    expect(limiteContratacao({ user: { role: "professor", email: "a@b.c" } })).toBe(LIMITE_PROFESSOR);
    expect(limiteContratacao(null)).toBe(3);
  });
  it("podeContratar e mensagem", () => {
    expect(podeContratar(2, 3)).toBe(true);
    expect(podeContratar(3, 3)).toBe(false);
    expect(mensagemTeto(3)).toContain("3 mentores");
  });
});
