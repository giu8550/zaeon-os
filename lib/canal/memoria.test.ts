/** #562 · de quem é a memória profunda num turno do Escritório — privacidade total. */
import { describe, it, expect } from "vitest";
import { escopoDaMemoria, conversaSoDaPessoa } from "./memoria";

const A = "a".repeat(24), B = "b".repeat(24), CANAL = "c".repeat(24);
const canal = (o: Partial<{ acesso: string; membros: string[]; dmCom: string | null }> = {}) => ({ id: CANAL, ownerId: A, acesso: "privado", membros: [], dmCom: null, ...o });

describe("memoria · conversa só da pessoa → a memória é dela", () => {
  it("privado, sem ninguém: relembra tudo dela (sem filtro de ala) e guarda com ela", () => {
    expect(escopoDaMemoria(canal(), A)).toEqual({ tipo: "pessoal", dono: A, alaLeitura: null });
  });
  it("'turma' sem membros também é só dela (turma só lê quem é membro)", () => {
    expect(escopoDaMemoria(canal({ acesso: "turma" }), A).tipo).toBe("pessoal");
  });
  it("com mentor: a ala do mentor, igual ao chat", () => {
    expect(escopoDaMemoria(canal(), A, `farmacia/${A}`)).toEqual({
      tipo: "pessoal", dono: A, alaLeitura: `farmacia/${A}`, alaEscrita: { kind: "agente", label: `farmacia/${A}` },
    });
  });
});

describe("memoria · com mais alguém → a memória é do ESCRITÓRIO, nunca de uma pessoa", () => {
  it.each([
    ["grupo (membro)", canal({ acesso: "turma", membros: [B] })],
    ["conversa de dois (dmCom)", canal({ dmCom: B })],
    ["aberto, mesmo sem membros (qualquer um lê)", canal({ acesso: "aberto" })],
  ] as const)("%s", (_n, c) => {
    const e = escopoDaMemoria(c, A, `farmacia/${A}`);
    expect(e).toEqual({ tipo: "escritorio", dono: CANAL, alaLeitura: "escritorio" });
    expect(JSON.stringify(e)).not.toContain(A); // nada da pessoa: nem dono, nem ala do mentor
  });
  it("quem manda num escritório aberto não é o dono: memória do escritório", () => {
    expect(escopoDaMemoria(canal({ acesso: "aberto" }), B).dono).toBe(CANAL);
  });
  it("conversa de dois que vira grupo: na próxima mensagem já é do escritório", () => {
    expect(conversaSoDaPessoa(canal())).toBe(true);
    expect(conversaSoDaPessoa(canal({ membros: [B] }))).toBe(false);
  });
});
