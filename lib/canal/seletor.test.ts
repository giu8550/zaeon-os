import { describe, it, expect } from "vitest";
import { podeApagar, textoConfirmarApagar, aposApagar, type CanalDoSeletor } from "./seletor";

const c = (id: string, souDono = true): CanalDoSeletor => ({ id, titulo: `Canal ${id}`, souDono });
const LISTA = [c("a"), c("b"), c("c")];

describe("seletor · quem pode apagar", () => {
  it("só o dono", () => {
    expect(podeApagar({ souDono: true })).toBe(true);
    expect(podeApagar({ souDono: false })).toBe(false);
  });
});

describe("seletor · texto do confirm", () => {
  it("cita o nome e avisa que não desfaz", () => {
    const t = textoConfirmarApagar("Projeto TCC");
    expect(t).toContain("Projeto TCC");
    expect(t).toContain("Não dá pra desfazer");
  });
  it("título vazio vira 'sem nome'", () => {
    expect(textoConfirmarApagar("   ")).toContain("sem nome");
  });
});

describe("seletor · depois de apagar", () => {
  it("apagou o ATIVO → abre o primeiro que sobrou", () => {
    const r = aposApagar(LISTA, "a", "a");
    expect(r.restantes.map((x) => x.id)).toEqual(["b", "c"]);
    expect(r.proximoAtivo).toBe("b");
    expect(r.eraAtivo).toBe(true);
  });

  it("apagou outro (não o ativo) → o ativo continua", () => {
    const r = aposApagar(LISTA, "c", "a");
    expect(r.restantes.map((x) => x.id)).toEqual(["a", "b"]);
    expect(r.proximoAtivo).toBe("a");
    expect(r.eraAtivo).toBe(false);
  });

  it("apagou o último que existia → ninguém ativo (a tela recria o primeiro)", () => {
    const r = aposApagar([c("a")], "a", "a");
    expect(r.restantes).toEqual([]);
    expect(r.proximoAtivo).toBeNull();
    expect(r.eraAtivo).toBe(true);
  });

  it("id que não está na lista → lista e ativo ficam como estavam", () => {
    const r = aposApagar(LISTA, "zzz", "b");
    expect(r.restantes).toHaveLength(3);
    expect(r.proximoAtivo).toBe("b");
    expect(r.eraAtivo).toBe(false);
  });

  it("sem ativo definido → cai no primeiro que sobrou", () => {
    const r = aposApagar(LISTA, "c", null);
    expect(r.proximoAtivo).toBe("a");
    expect(r.eraAtivo).toBe(false);
  });

  it("não muta a lista original", () => {
    const copia = [...LISTA];
    aposApagar(LISTA, "a", "a");
    expect(LISTA).toEqual(copia);
  });
});
