import { describe, it, expect } from "vitest";
import { criarOrcamento, PRIORIDADE } from "./vida";

describe("avatares · orçamento de vida", () => {
  it("no máximo N vivos; prioridade maior ganha; empate → quem pediu antes", () => {
    const o = criarOrcamento(2);
    const vivo: Record<string, boolean> = {};
    const cb = (id: string) => (v: boolean) => { vivo[id] = v; };
    o.pedir("a", PRIORIDADE.ambiente, cb("a"));
    o.pedir("b", PRIORIDADE.ambiente, cb("b"));
    o.pedir("c", PRIORIDADE.ambiente, cb("c"));
    expect(o.vivos()).toEqual(["a", "b"]);
    o.pedir("c", PRIORIDADE.ativo, cb("c")); // c começou a falar → toma a vaga do mais novo
    expect(o.vivos().sort()).toEqual(["a", "c"]);
    expect(vivo.b).toBe(false);
  });
  it("no celular (1 vaga) o rosto da conversa ganha da bolinha da aba", () => {
    const o = criarOrcamento(1);
    o.pedir("aba", PRIORIDADE.ativo, () => {});
    o.pedir("resposta", PRIORIDADE.protagonista, () => {});
    expect(o.vivos()).toEqual(["resposta"]);
  });
  it("soltar libera a vaga; prioridade 0 não pede; setMax reduz (celular = 1)", () => {
    const o = criarOrcamento(2);
    const n = () => {};
    o.pedir("a", PRIORIDADE.interacao, n);
    o.pedir("b", PRIORIDADE.ambiente, n);
    o.pedir("z", PRIORIDADE.nenhuma, n);
    expect(o.vivos()).toEqual(["a", "b"]);
    o.setMax(1);
    expect(o.vivos()).toEqual(["a"]);
    o.soltar("a");
    expect(o.vivos()).toEqual(["b"]);
  });
});
