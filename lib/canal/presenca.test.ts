import { describe, it, expect, vi } from "vitest";
import {
  tipoDoAutor, textoEntrou, novosMembros, anunciarEntrada,
  deveAvisarDigitando, podarDigitando, textoDigitando, permitirDigitando,
  INTERVALO_DIGITANDO_MS, LIMITE_SERVIDOR_MS, quemDigita, MAX_BALOES_DIGITANDO, estaNoFim, MARGEM_FIM_PX,
} from "./presenca";

describe("presença · 'fulano entrou'", () => {
  it("tipo do autor: sistema é reconhecido; desconhecido continua humano", () => {
    expect(tipoDoAutor("sistema")).toBe("sistema");
    expect(tipoDoAutor("agente")).toBe("agente");
    expect(tipoDoAutor("humano")).toBe("humano");
    expect(tipoDoAutor("??")).toBe("humano");
  });

  it("frases", () => {
    expect(textoEntrou("Martinez")).toBe("Martinez entrou no escritório");
    expect(textoEntrou("Giulia", { conversa: true })).toBe("Giulia aceitou o convite e entrou na conversa");
    expect(textoEntrou("  ")).toBe("Alguém entrou no escritório");
  });

  it("só quem é NOVO ganha aviso (nem quem já estava, nem o dono, nem repetido)", () => {
    expect(novosMembros(["b"], ["b", "c", "c", "dono"], "dono")).toEqual(["c"]);
    expect(novosMembros(["b"], ["b"], "dono")).toEqual([]);
  });

  it("anunciarEntrada grava a linha do sistema e publica no canal", async () => {
    const criar = vi.fn(async () => ({ id: "m1", createdAt: new Date("2026-10-16T10:00:00Z") }));
    const publicar = vi.fn(async () => {});
    const w = await anunciarEntrada({ criar, publicar, evento: "mensagem" }, "c1", { id: "u1", nome: "Martinez" });
    expect(criar).toHaveBeenCalledWith({ canalId: "c1", autorTipo: "sistema", autorId: "u1", texto: "Martinez entrou no escritório", mencoes: [] });
    expect(publicar).toHaveBeenCalledWith("c1", "mensagem", w);
    expect(w).toMatchObject({ id: "m1", autorTipo: "sistema", autorNome: "Martinez", texto: "Martinez entrou no escritório" });
  });

  it("se o banco falhar, não lança (a pessoa entra mesmo assim) e não publica", async () => {
    const publicar = vi.fn();
    const w = await anunciarEntrada({ criar: async () => { throw new Error("db fora"); }, publicar, evento: "mensagem" }, "c1", { id: "u1", nome: "M" });
    expect(w).toBeNull();
    expect(publicar).not.toHaveBeenCalled();
  });
});

describe("presença · 'fulano está digitando'", () => {
  it("cliente avisa só com texto e no máximo a cada intervalo", () => {
    expect(deveAvisarDigitando(null, 1000, "o")).toBe(true);
    expect(deveAvisarDigitando(1000, 1000 + INTERVALO_DIGITANDO_MS - 1, "oi")).toBe(false);
    expect(deveAvisarDigitando(1000, 1000 + INTERVALO_DIGITANDO_MS, "oi")).toBe(true);
    expect(deveAvisarDigitando(null, 1000, "   ")).toBe(false);
  });

  it("o aviso some sozinho depois do prazo; sem nada a tirar, mesmo objeto", () => {
    const d = { a: { nome: "Giulia", ate: 5000 }, b: { nome: "Ana", ate: 9000 } };
    expect(podarDigitando(d, 6000)).toEqual({ b: { nome: "Ana", ate: 9000 } });
    expect(podarDigitando(d, 1000)).toBe(d);
  });

  it.each([
    [[], ""],
    [["Giulia"], "Giulia está digitando"],
    [["Giulia", "Ana"], "Giulia e Ana estão digitando"],
    [["Giulia", "Ana", "Bia", "Caio"], "Giulia, Ana e mais 2 estão digitando"],
    [[""], "Alguém está digitando"],
  ])("%j → %s", (nomes, txt) => {
    expect(textoDigitando(nomes)).toBe(txt);
  });

  it("servidor deixa passar 1 aviso por pessoa+canal a cada limite", () => {
    const m = new Map<string, number>();
    expect(permitirDigitando(m, "u1:c1", 1000)).toBe(true);
    expect(permitirDigitando(m, "u1:c1", 1000 + LIMITE_SERVIDOR_MS - 1)).toBe(false);
    expect(permitirDigitando(m, "u2:c1", 1001)).toBe(true); // outra pessoa não é barrada
    expect(permitirDigitando(m, "u1:c1", 1000 + LIMITE_SERVIDOR_MS)).toBe(true);
  });
});

describe("presença · #425 quem aparece em balão", () => {
  const pessoas = [{ id: "a", nome: "Giulia", avatar: "/g.png" }, { id: "b", nome: "Martinez", avatar: null }];
  it("cada pessoa digitando com a foto dela", () => {
    expect(quemDigita({ a: { nome: "Giulia", ate: 1 } }, pessoas)).toEqual([{ id: "a", nome: "Giulia", avatar: "/g.png" }]);
  });
  it("quem não está na lista de pessoas: sem foto (cai nas iniciais), com o nome do aviso", () => {
    expect(quemDigita({ z: { nome: "Visitante", ate: 1 } }, pessoas)).toEqual([{ id: "z", nome: "Visitante", avatar: null }]);
  });
  it("aviso sem nome: usa o nome do canal, ou 'Alguém'", () => {
    expect(quemDigita({ b: { nome: " ", ate: 1 }, z: { nome: "", ate: 1 } }, pessoas).map((p) => p.nome)).toEqual(["Martinez", "Alguém"]);
  });
  it("no máximo MAX_BALOES_DIGITANDO balões", () => {
    const d = Object.fromEntries(["a", "b", "c", "d", "e"].map((id) => [id, { nome: id, ate: 1 }]));
    expect(quemDigita(d, pessoas)).toHaveLength(MAX_BALOES_DIGITANDO);
  });
  it("ninguém digitando: lista vazia", () => {
    expect(quemDigita({}, pessoas)).toEqual([]);
  });
});

describe("presença · #427 descer até o balão de quem digita", () => {
  // lista de 1000px de conteúdo numa janela de 400px
  const lista = (scrollTop: number) => ({ scrollTop, scrollHeight: 1000, clientHeight: 400 });
  it("no fim da conversa: desce (o balão novo aparece)", () => {
    expect(estaNoFim(lista(600))).toBe(true);
  });
  it("quase no fim (o balão acabou de entrar e empurrou um pouco): ainda conta como fim", () => {
    expect(estaNoFim(lista(600 - MARGEM_FIM_PX))).toBe(true);
  });
  it("lendo mensagens antigas lá em cima: não puxa a pessoa pra baixo", () => {
    expect(estaNoFim(lista(100))).toBe(false);
    expect(estaNoFim(lista(600 - MARGEM_FIM_PX - 1))).toBe(false);
  });
  it("conversa curta (cabe toda na tela): está no fim", () => {
    expect(estaNoFim({ scrollTop: 0, scrollHeight: 300, clientHeight: 400 })).toBe(true);
  });
});
