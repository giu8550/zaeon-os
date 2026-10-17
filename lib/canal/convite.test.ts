import { describe, it, expect } from "vitest";
import {
  interpretarAlvo, podeResponder, statusDepois, saoContatos, conviteEmAberto, tituloConversa,
  abaDoCanal, filtrarPorAba, humanosNoCanal, ehConviteDeConversa, podeConvidarParaConversa, entrarNaConversa, type Convite,
} from "./convite";

const A = "a".repeat(24), B = "b".repeat(24), C = "c".repeat(24);
const cv = (deId: string, paraId: string, status: Convite["status"], id = "x"): Convite => ({ id, deId, paraId, status });

describe("convite · quem convidar", () => {
  it("e-mail é normalizado (minúsculo, sem espaços)", () => {
    expect(interpretarAlvo("  Ana@Zaeon.COM ")).toEqual({ email: "ana@zaeon.com" });
  });
  it("sem cara de e-mail vira nome (e tira o @ da frente)", () => {
    expect(interpretarAlvo("Martinez")).toEqual({ nome: "Martinez" });
    expect(interpretarAlvo("@Martinez")).toEqual({ nome: "Martinez" });
  });
  it("vazio, curto demais ou gigante → null", () => {
    expect(interpretarAlvo("")).toBeNull();
    expect(interpretarAlvo("   ")).toBeNull();
    expect(interpretarAlvo("a")).toBeNull();
    expect(interpretarAlvo("x".repeat(81))).toBeNull();
    expect(interpretarAlvo(undefined)).toBeNull();
  });
});

describe("convite · responder", () => {
  it("só quem foi convidado responde, e só se está pendente", () => {
    expect(podeResponder(cv(A, B, "pendente"), B)).toBe(true);
    expect(podeResponder(cv(A, B, "pendente"), A)).toBe(false); // quem convidou não aceita por ninguém
    expect(podeResponder(cv(A, B, "pendente"), C)).toBe(false);
    expect(podeResponder(cv(A, B, "aceito"), B)).toBe(false);
    expect(podeResponder(cv(A, B, "recusado"), B)).toBe(false);
    expect(podeResponder(cv(A, B, "pendente"), null)).toBe(false);
  });
  it("ação → status", () => {
    expect(statusDepois("aceitar")).toBe("aceito");
    expect(statusDepois("recusar")).toBe("recusado");
    expect(statusDepois("apagar")).toBeNull();
    expect(statusDepois(undefined)).toBeNull();
  });
});

describe("convite · contatos e duplicados", () => {
  it("aceito em qualquer direção = contatos", () => {
    expect(saoContatos([cv(A, B, "aceito")], A, B)).toBe(true);
    expect(saoContatos([cv(B, A, "aceito")], A, B)).toBe(true);
  });
  it("pendente ou recusado ainda não é contato", () => {
    expect(saoContatos([cv(A, B, "pendente")], A, B)).toBe(false);
    expect(saoContatos([cv(A, B, "recusado")], A, B)).toBe(false);
    expect(saoContatos([cv(A, C, "aceito")], A, B)).toBe(false);
  });
  it("não deixa duplicar convite pendente/aceito (nas duas direções); recusado libera um novo", () => {
    expect(conviteEmAberto([cv(A, B, "pendente", "p")], A, B)?.id).toBe("p");
    expect(conviteEmAberto([cv(B, A, "aceito", "q")], A, B)?.id).toBe("q");
    expect(conviteEmAberto([cv(A, B, "recusado")], A, B)).toBeNull();
    expect(conviteEmAberto([], A, B)).toBeNull();
  });
  it("título da conversa", () => {
    expect(tituloConversa("Giulia", "Martinez")).toBe("Giulia e Martinez");
    expect(tituloConversa(null, "")).toBe("Alguém e Alguém");
  });
});

describe("convite · abas (mesmo espaço, sem misturar)", () => {
  const canais = [
    { id: "dm", acesso: "privado", dmCom: B },
    { id: "meu", acesso: "privado", dmCom: null },
    { id: "t", acesso: "turma" },
    { id: "ab", acesso: "aberto" },
    { id: "velho", acesso: "qualquer-coisa" },
  ];
  it("cada canal cai em uma aba só", () => {
    expect(canais.map((c) => abaDoCanal(c))).toEqual(["privado", "privado", "turma", "aberto", "turma"]);
  });
  it("conversa privada é sempre do privado, mesmo se o acesso dizer outra coisa", () => {
    expect(abaDoCanal({ acesso: "aberto", dmCom: B })).toBe("privado");
  });
  it("filtrar devolve só os da aba e não repete canal entre abas", () => {
    const p = filtrarPorAba(canais, "privado").map((c) => c.id);
    const t = filtrarPorAba(canais, "turma").map((c) => c.id);
    const ab = filtrarPorAba(canais, "aberto").map((c) => c.id);
    expect(p).toEqual(["dm", "meu"]);
    expect(t).toEqual(["t", "velho"]);
    expect(ab).toEqual(["ab"]);
    expect(p.length + t.length + ab.length).toBe(canais.length);
  });
});

describe("convite · humanos no canal", () => {
  it("conversa privada conta as duas pessoas (a IA não responde sozinha a conversa de duas pessoas)", () => {
    expect(humanosNoCanal({ ownerId: A, membros: [], dmCom: B })).toBe(2);
  });
  it("dono sozinho = 1; dono + membros sem repetir", () => {
    expect(humanosNoCanal({ ownerId: A, membros: [] })).toBe(1);
    expect(humanosNoCanal({ ownerId: A, membros: [A, B, B] })).toBe(2);
  });
});

describe("convite · #425 chamar alguém para a conversa", () => {
  it("convite com canalId é pra uma conversa; sem, é de contato", () => {
    expect(ehConviteDeConversa({ canalId: "c1" })).toBe(true);
    expect(ehConviteDeConversa({ canalId: null })).toBe(false);
    expect(ehConviteDeConversa({})).toBe(false);
  });

  it("só o dono da conversa convida pra ela", () => {
    expect(podeConvidarParaConversa({ ownerId: "a" }, "a")).toBe(true);
    expect(podeConvidarParaConversa({ ownerId: "a" }, "b")).toBe(false);
    expect(podeConvidarParaConversa({ ownerId: "a" }, null)).toBe(false);
  });

  it("conversa de dois + alguém = grupo privado com os três (o outro lado vira membro, a trava sai)", () => {
    expect(entrarNaConversa({ membros: [], dmCom: "b" }, "c")).toEqual({ membros: ["b", "c"], dmCom: null });
  });

  it("escritório com membros: só acrescenta, sem repetir", () => {
    expect(entrarNaConversa({ membros: ["b", "c"], dmCom: null }, "c")).toEqual({ membros: ["b", "c"], dmCom: null });
    expect(entrarNaConversa({ membros: ["b"] }, "d")).toEqual({ membros: ["b", "d"], dmCom: null });
  });
});
