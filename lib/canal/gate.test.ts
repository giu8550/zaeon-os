import { describe, it, expect } from "vitest";
import { podeLer, podeEscrever, podeGerir, normalizarAcesso } from "./gate";

const A = "a".repeat(24), B = "b".repeat(24), C = "c".repeat(24);
const canal = (acesso: string) => ({ ownerId: A, acesso, membros: [B] });

describe("gate · author gate (A dono, B membro, C fora)", () => {
  it("privado: só o dono", () => {
    expect(podeLer(canal("privado"), A)).toBe(true);
    expect(podeLer(canal("privado"), B)).toBe(false);
    expect(podeLer(canal("privado"), C)).toBe(false);
  });
  it("turma: dono + membros", () => {
    expect(podeEscrever(canal("turma"), A)).toBe(true);
    expect(podeEscrever(canal("turma"), B)).toBe(true);
    expect(podeEscrever(canal("turma"), C)).toBe(false);
  });
  it("aberto: qualquer logado; anônimo nunca", () => {
    expect(podeLer(canal("aberto"), C)).toBe(true);
    expect(podeLer(canal("aberto"), null)).toBe(false);
    expect(podeLer(canal("aberto"), undefined)).toBe(false);
  });
  it("gerir = só dono", () => {
    expect(podeGerir(canal("aberto"), A)).toBe(true);
    expect(podeGerir(canal("aberto"), B)).toBe(false);
    expect(podeGerir(canal("aberto"), null)).toBe(false);
  });
  it("acesso desconhecido cai em turma", () => {
    expect(normalizarAcesso("x")).toBe("turma");
    expect(normalizarAcesso("privado")).toBe("privado");
    expect(podeLer({ ownerId: A, acesso: "???", membros: [] }, C)).toBe(false);
  });
});
