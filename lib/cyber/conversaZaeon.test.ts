import { describe, expect, it } from "vitest";
import { ABERTURA, MAX_RESPOSTA, PERGUNTAS, fechamento, limparPerfil, limparResposta, reacao } from "./conversaZaeon";
import { GLOBO_CAPELA, CIDADE } from "./ceu";

describe("a conversa com a Zaeon (o holograma do globo da capela)", () => {
  it("ela quer conhecer a pessoa: nome, se estuda/trabalha, a área, o objetivo e como aprende — falas curtas (cabem no balão)", () => {
    expect(PERGUNTAS.map((p) => p.id)).toEqual(["nome", "ocupacao", "area", "objetivo", "estilo"]);
    for (const p of PERGUNTAS) { expect(p.fala.length).toBeLessThanOrEqual(160); if (p.tipo === "escolha") expect(p.opcoes!.length).toBeGreaterThanOrEqual(3); }
    expect(PERGUNTAS.find((p) => p.id === "ocupacao")!.opcoes).toEqual(expect.arrayContaining(["Estudo", "Trabalho", "Os dois"]));
    for (const f of [...ABERTURA, ...fechamento({ nome: "Ana" })]) expect(f.length).toBeLessThanOrEqual(160);
  });
  it("cada resposta ganha uma reação curta que usa o que a pessoa disse", () => {
    expect(reacao("nome", "Ana", { nome: "Ana" })).toContain("Ana");
    expect(reacao("area", "Medicina", {})).toContain("Medicina");
    expect(reacao("objetivo", "Escrever meu TCC", { nome: "Ana" })).toMatch(/Ana.*escrever meu TCC/);
    for (const o of PERGUNTAS[1]!.opcoes!) expect(reacao("ocupacao", o, {}).length).toBeGreaterThan(5);
    expect(fechamento({ nome: "Ana" })[0]).toContain("Ana"); expect(fechamento({})[0]).toContain("viajante");
  });
  it("respostas limpas: sem HTML/controles, espaços colapsados, com teto; o perfil só leva chaves conhecidas", () => {
    expect(limparResposta("  Ana\n<b>Clara</b>  ")).toBe("Ana b Clara /b");
    expect(limparResposta("x".repeat(500))).toHaveLength(MAX_RESPOSTA);
    expect(limparResposta(42)).toBe("");
    expect(limparPerfil({ nome: " Ana ", area: "", senha: "x", estilo: "Lendo" })).toEqual({ nome: "Ana", estilo: "Lendo" });
    expect(limparPerfil(null)).toEqual({});
  });
  it("o rosto sai do globo no centro da capela (lá dentro, acima da mesa)", () => {
    expect(GLOBO_CAPELA.y).toBeGreaterThan(GLOBO_CAPELA.r); expect(GLOBO_CAPELA.r).toBeLessThan(CIDADE.cidadela.r / 3);
  });
});
