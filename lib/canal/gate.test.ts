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
  it("#396 · conversa privada (dmCom): só as duas pessoas, qualquer que seja o acesso", () => {
    const dm = (acesso: string) => ({ ownerId: A, acesso, membros: [], dmCom: B });
    for (const acesso of ["privado", "turma", "aberto"]) {
      expect(podeLer(dm(acesso), A)).toBe(true);   // quem convidou
      expect(podeLer(dm(acesso), B)).toBe(true);   // quem aceitou
      expect(podeLer(dm(acesso), C)).toBe(false);  // ninguém mais, nem com "aberto"
      expect(podeEscrever(dm(acesso), C)).toBe(false);
    }
    expect(podeGerir(dm("privado"), B)).toBe(false); // o convidado conversa, mas não gere
  });
  it("#396 · membro em canal com dmCom não ganha acesso por ser membro", () => {
    expect(podeLer({ ownerId: A, acesso: "turma", membros: [C], dmCom: B }, C)).toBe(false);
  });
  it("sem dmCom o comportamento antigo não muda", () => {
    expect(podeLer({ ownerId: A, acesso: "privado", membros: [B], dmCom: null }, B)).toBe(false);
    expect(podeLer({ ownerId: A, acesso: "turma", membros: [B], dmCom: null }, B)).toBe(true);
  });
  it("acesso desconhecido cai em turma", () => {
    expect(normalizarAcesso("x")).toBe("turma");
    expect(normalizarAcesso("privado")).toBe("privado");
    expect(podeLer({ ownerId: A, acesso: "???", membros: [] }, C)).toBe(false);
  });
});
