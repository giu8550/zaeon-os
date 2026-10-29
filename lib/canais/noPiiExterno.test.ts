import { describe, it, expect } from "vitest";
import { verificarConteudoPublico, conteudoPublicoLiberado, motivoDoBloqueio, mascarar } from "./noPiiExterno";

const tipos = (t: string, o?: Parameters<typeof verificarConteudoPublico>[1]) => {
  const v = verificarConteudoPublico(t, o);
  return v.ok ? [] : [...new Set(v.achados.map((a) => a.tipo))];
};

describe("noPiiExterno · bloqueia dado pessoal em conteúdo público", () => {
  it("e-mail, telefone, CPF e credencial em URL", () => {
    expect(tipos("fala com joao.silva@gmail.com")).toContain("email");
    expect(tipos("zap 11 99999-8888")).toContain("telefone");
    expect(tipos("meu +55 (11) 98765-4321")).toContain("telefone");
    expect(tipos("cpf 123.456.789-00")).toContain("cpf");
    expect(tipos("banco em mongodb+srv://u:senha@host/db")).toContain("url_credencial");
  });

  it("@handle de pessoa bloqueia, @zaeon não", () => {
    expect(tipos("parabéns @joaozinho123")).toContain("handle");
    expect(tipos("somos @zaeon")).toEqual([]);
    expect(tipos("veja @parceiro_x", { handlesLiberados: ["@parceiro_x"] })).toEqual([]);
    expect(tipos("veja @joaozinho123", { checarHandles: false })).toEqual([]);
  });

  it("credencial chumbada (reusa a trava do Octa)", () => {
    expect(tipos('post com API_KEY="abcd1234efgh"')).toContain("segredo");
    expect(tipos("token sk-abcdefghijklmnopqrstuvwx")).toContain("segredo");
  });

  it("lista de proibidos: nome de aluno não se detecta por formato", () => {
    expect(tipos("o aluno Maria Aparecida arrasou", { proibidos: ["Maria Aparecida"] })).toContain("proibido");
    expect(tipos("texto neutro", { proibidos: ["Maria Aparecida"] })).toEqual([]);
    expect(tipos("MARIA APARECIDA em caixa alta", { proibidos: ["maria aparecida"] })).toContain("proibido");
    expect(tipos("qualquer coisa", { proibidos: ["ab", ""] })).toEqual([]);  // curto demais: ignora
  });

  it("junta TODOS os achados (quem reescreve precisa da lista inteira)", () => {
    const v = verificarConteudoPublico("joao@x.com, 11 99999-8888, cpf 123.456.789-00");
    expect(v.ok).toBe(false);
    if (!v.ok) expect([...new Set(v.achados.map((a) => a.tipo))].sort()).toEqual(["cpf", "email", "telefone"]);
  });
});

describe("noPiiExterno · não estraga conteúdo legítimo", () => {
  it("post normal da Zaeon passa", () => {
    const posts = [
      "Como a cafeína antagoniza receptores de adenosina — um fio curto. — Kekulé, mentor de Farmácia · Zaeon",
      "Nova sala de estudos de Matemática no ar. Demonstração passo a passo, do jeito certo.",
      "Publicamos o guia de ABNT atualizado para 2026. Link na bio.",
      "3 erros comuns em TCC de Enfermagem (e como a SAE resolve).",
    ];
    for (const p of posts) expect(conteudoPublicoLiberado(p), p).toBe(true);
  });

  it("data não é telefone", () => {
    expect(tipos("evento em 2026-10-29")).toEqual([]);
    expect(tipos("prazo 29/10/2026")).toEqual([]);
  });

  it("número comprido (id/ISBN/hash) não é telefone nem CPF", () => {
    expect(tipos("ISBN 9780306406157")).toEqual([]);
    expect(tipos("id 1234567890123456789")).toEqual([]);
  });

  it("vazio e espaço passam", () => {
    expect(conteudoPublicoLiberado("")).toBe(true);
    expect(conteudoPublicoLiberado("   ")).toBe(true);
  });

  it("e-mail institucional também bloqueia (conservador de propósito)", () => {
    // regra é por FORMATO: não dá pra saber se contato@zaeon.com é público sem lista explícita
    expect(tipos("escreva para contato@zaeon.com")).toContain("email");
  });
});

describe("noPiiExterno · relatório nunca repete o dado", () => {
  it("amostra é mascarada", () => {
    const v = verificarConteudoPublico("joao.silva@gmail.com");
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.achados[0].amostra).not.toContain("joao.silva@gmail.com");
      expect(v.achados[0].amostra).toContain("*");
    }
  });

  it("mascarar mostra só as pontas", () => {
    expect(mascarar("joao.silva@gmail.com")).toMatch(/^jo\*+om$/);
    expect(mascarar("abc")).toBe("***");
    expect(mascarar("")).toBe("");
  });

  it("motivoDoBloqueio: frase acionável, sem o dado, e null quando passa", () => {
    const m = motivoDoBloqueio(verificarConteudoPublico("joao@x.com"));
    expect(m).toContain("email");
    expect(m).toMatch(/Reescreva/);
    expect(m).not.toContain("joao@x.com");
    expect(motivoDoBloqueio({ ok: true })).toBeNull();
  });

  it("nunca lança", () => {
    for (const lixo of ["", "@@@", "\u0000", "a".repeat(20_000), "@".repeat(500)]) {
      expect(() => verificarConteudoPublico(lixo)).not.toThrow();
    }
  });
});
