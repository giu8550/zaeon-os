import { describe, it, expect, vi } from "vitest";
import { comporMensagem, INSTRUCOES_ZAEON, mensagemPadrao, objetivoDa } from "./template";
import type { Contexto } from "./contexto";

const ctx: Contexto = {
  nome: "Ana", estudosRecentes: ["Mitose e meiose"], perguntasRecentes: ["o que é crossing-over?"], aulasConcluidas: [], aulasEmAndamento: [],
  trabalhos: [], agendaHoje: "", lembretesHoje: ["19:00 — estudar biologia"], prazos: [], revisoes: "", conversaWhatsApp: [], respondeuDesdeUltimaProativa: false,
};

describe("template da Zaeon", () => {
  it("as instruções do harness carregam a proatividade e a regra da rotina", () => {
    expect(INSTRUCOES_ZAEON).toMatch(/PROATIVIDADE/);
    expect(INSTRUCOES_ZAEON).toMatch(/não tem lembretes nem agenda, você NÃO sabe quando ela estuda/);
    expect(INSTRUCOES_ZAEON).toMatch(/Nunca invente/);
  });
  it("cada momento tem seu objetivo (aula do dia, check-in, resumo + condensado, descoberta)", () => {
    expect(objetivoDa({ tipo: "momento", momento: "manha", chave: "k" })).toMatch(/aula do dia/);
    expect(objetivoDa({ tipo: "momento", momento: "tarde", chave: "k" })).toMatch(/CHECK-IN/);
    expect(objetivoDa({ tipo: "momento", momento: "noite", chave: "k" })).toMatch(/CONDENSADO/);
    expect(objetivoDa({ tipo: "descoberta", chave: "k", tentativa: 3 })).toMatch(/tentativa 3/);
  });
  it("usa o modelo com o retrato real da pessoa no prompt", async () => {
    const gerar = vi.fn(async () => ({ mensagem: "Bom dia, Ana! Hoje a aula do dia é crossing-over..." }));
    const r = await comporMensagem({ tipo: "momento", momento: "manha", chave: "k" }, ctx, gerar);
    expect(r).toEqual({ texto: "Bom dia, Ana! Hoje a aula do dia é crossing-over...", doModelo: true });
    const { user, system } = (gerar.mock.calls[0] as any)[0];
    expect(system).toContain("JSON");
    expect(user).toContain("Mitose e meiose");
    expect(user).toContain("19:00 — estudar biologia");
  });
  it("modelo falhou ou veio vazio → mensagem padrão útil (nunca fica muda)", async () => {
    const r1 = await comporMensagem({ tipo: "descoberta", chave: "k", tentativa: 1 }, ctx, async () => { throw new Error("429"); });
    expect(r1.doModelo).toBe(false);
    expect(r1.texto).toMatch(/seg a sex 19h/);
    const r2 = await comporMensagem({ tipo: "lembrete", lembrete: { id: "l", texto: "revisar", minutos: 600, dias: [], ativo: true }, chave: "k" }, ctx, async () => ({ mensagem: "ok" }));
    expect(r2.texto).toMatch(/revisar/);
    expect(mensagemPadrao({ tipo: "momento", momento: "noite", chave: "k" }, ctx)).toMatch(/Mitose e meiose/);
  });
});
