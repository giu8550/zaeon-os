/** #425 · perfil pela foto: quem é do canal, os campos públicos (sem cérebros) e quando o "Remover" aparece. */
import { describe, it, expect } from "vitest";
import { estaNoCanal, perfilPublico, podeRemover, textoConfirmarRemover, CAMPOS_PERFIL } from "./perfil";

describe("perfil · quem é do canal", () => {
  const canal = { ownerId: "dono", membros: ["m1"], dmCom: null };
  it("dono e membros sim; quem é de fora não", () => {
    expect(estaNoCanal(canal, "dono")).toBe(true);
    expect(estaNoCanal(canal, "m1")).toBe(true);
    expect(estaNoCanal(canal, "fora")).toBe(false);
  });
  it("conversa privada: o outro lado também", () => {
    expect(estaNoCanal({ ownerId: "a", membros: [], dmCom: "b" }, "b")).toBe(true);
  });
});

describe("perfil · só campos públicos", () => {
  it("o select do banco não pede cérebros, e-mail, aura nem nada fora da lista", () => {
    expect(Object.keys(CAMPOS_PERFIL).sort()).toEqual(["academicLevel", "bio", "course", "id", "image", "institution", "name"]);
  });

  it("mesmo que venha mais coisa, o perfil só copia os campos da lista", () => {
    const vazado = {
      id: "u1", name: "Martinez", image: "/m.png", course: "Engenharia", academicLevel: "Mestrado", institution: "USP", bio: "Oi",
      email: "m@z.com", cerebros: [{ id: "c1", titulo: "segredo" }], aura: 999, mapas: ["x"],
    };
    const p = perfilPublico(vazado);
    expect(p).toEqual({ id: "u1", nome: "Martinez", avatar: "/m.png", curso: "Engenharia", nivel: "Mestrado", instituicao: "USP", bio: "Oi" });
    expect(JSON.stringify(p)).not.toMatch(/cerebro|segredo|email|aura|mapas/i);
  });

  it("campos vazios viram null; sem nome = 'Alguém'; bio longa é cortada", () => {
    const p = perfilPublico({ id: "u", name: "  ", course: "", bio: "x".repeat(500) });
    expect(p.nome).toBe("Alguém");
    expect(p.curso).toBeNull();
    expect(p.avatar).toBeNull();
    expect(p.bio).toHaveLength(280);
  });
});

describe("perfil · Remover do escritório", () => {
  const base = { meuId: "dono", donoId: "dono", alvoId: "m1", conversaDeDois: false, membros: ["m1", "m2"] };
  it("dono vê o Remover num membro", () => {
    expect(podeRemover(base)).toBe(true);
  });
  it("quem não é dono nunca vê", () => {
    expect(podeRemover({ ...base, meuId: "m2" })).toBe(false);
    expect(podeRemover({ ...base, meuId: null })).toBe(false);
  });
  it("nunca na própria foto nem na do dono", () => {
    expect(podeRemover({ ...base, alvoId: "dono" })).toBe(false);
  });
  it("conversa privada de dois: não tem Remover", () => {
    expect(podeRemover({ ...base, conversaDeDois: true })).toBe(false);
  });
  it("quem não é membro (ex.: visitante de escritório aberto): não tem Remover", () => {
    expect(podeRemover({ ...base, alvoId: "visitante" })).toBe(false);
  });
  it("a confirmação diz o nome e o que acontece", () => {
    expect(textoConfirmarRemover("Ana")).toBe("Remover Ana do escritório? Ela perde o acesso às mensagens na hora.");
  });
});
