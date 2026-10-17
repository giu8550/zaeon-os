/** #427 · perfil de outra pessoa: quem pode ver e o que dos cérebros nunca aparece. */
import { describe, it, expect } from "vitest";
import { FONTES_DE_CEREBRO, ehDeCerebro, recentesSemCerebro, podeVerPerfil, CAMPOS_USUARIO_VISITANTE } from "./visitante";

describe("perfil visitante · extrato 'Recentes' sem os cérebros", () => {
  const ev = (id: string, source: string) => ({ id, source });
  it("tira as linhas que vêm dos cérebros e deixa o resto", () => {
    const l = [ev("1", "node_learned"), ev("2", "credential_verified"), ev("3", "brain_completed"), ev("4", "node_validated"), ev("5", "node_applied"), ev("6", "mentor_session")];
    expect(recentesSemCerebro(l).map((e) => e.id)).toEqual(["2", "6"]);
  });
  it("as quatro origens dos cérebros", () => {
    expect([...FONTES_DE_CEREBRO].sort()).toEqual(["brain_completed", "node_applied", "node_learned", "node_validated"]);
    expect(ehDeCerebro("credential_verified")).toBe(false);
  });
  it("no máximo 10, contados DEPOIS de tirar os dos cérebros", () => {
    const l = [...Array.from({ length: 5 }, (_, i) => ev(`c${i}`, "node_learned")), ...Array.from({ length: 12 }, (_, i) => ev(`t${i}`, "credential_verified"))];
    const r = recentesSemCerebro(l);
    expect(r).toHaveLength(10);
    expect(r.every((e) => e.source === "credential_verified")).toBe(true);
  });
});

describe("perfil visitante · quem pode ver", () => {
  const canais = [
    { ownerId: "eu", membros: ["ana"], dmCom: null },
    { ownerId: "bia", membros: ["eu"], dmCom: null },
    { ownerId: "caio", membros: [], dmCom: "eu" },
  ];
  it("a própria pessoa sempre", () => {
    expect(podeVerPerfil([], "eu", "eu")).toBe(true);
  });
  it("quem divide escritório: membro, dono, outro lado da conversa", () => {
    expect(podeVerPerfil(canais, "eu", "ana")).toBe(true);
    expect(podeVerPerfil(canais, "eu", "bia")).toBe(true);
    expect(podeVerPerfil(canais, "eu", "caio")).toBe(true);
  });
  it("quem não divide escritório nenhum: não vê", () => {
    expect(podeVerPerfil(canais, "eu", "estranho")).toBe(false);
    expect(podeVerPerfil([], "eu", "ana")).toBe(false);
  });
  it("um canal onde EU não estou não conta (mesmo que a pessoa esteja)", () => {
    expect(podeVerPerfil([{ ownerId: "x", membros: ["ana"], dmCom: null }], "eu", "ana")).toBe(false);
  });
});

describe("perfil visitante · o que se lê do usuário", () => {
  it("nada de cérebro/mapas, documento de curso ou senha no select", () => {
    expect(Object.keys(CAMPOS_USUARIO_VISITANTE).sort()).toEqual(["academicLevel", "course", "eduVerified", "email", "id", "image", "name", "plan", "referredBy", "role"]);
  });
});
