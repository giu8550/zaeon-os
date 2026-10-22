// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { consumirPedidoChat, gravarModoPesquisa, modoPesquisaDa, pedidoDoLink, pedirAoChat } from "./chatUnico";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe("modo pesquisa por conversa", () => {
  it("liga/desliga só na conversa pedida; lixo no storage = desligado", () => {
    const s = mem();
    expect(modoPesquisaDa(s, "a1")).toBe(false);
    gravarModoPesquisa(s, "a1", true);
    gravarModoPesquisa(s, "a2", true);
    expect(modoPesquisaDa(s, "a1")).toBe(true);
    gravarModoPesquisa(s, "a1", false);
    expect([modoPesquisaDa(s, "a1"), modoPesquisaDa(s, "a2"), modoPesquisaDa(s, null)]).toEqual([false, true, false]);
    s.setItem("zaeon.chat.modoPesquisa.v1", "{quebrado");
    expect(modoPesquisaDa(s, "a2")).toBe(false);
  });
});

describe("pedidos de fora do chat", () => {
  beforeEach(() => localStorage.clear());
  it("bilhete: chat que monta depois lê UMA vez; id de trabalho inválido some", () => {
    pedirAoChat({ modoPesquisa: true, trabalhoId: "a".repeat(24) });
    expect(consumirPedidoChat()).toEqual({ modoPesquisa: true, trabalhoId: "a".repeat(24) });
    expect(consumirPedidoChat()).toBeNull();
    pedirAoChat({ trabalhoId: "../x" });
    expect(consumirPedidoChat()).toEqual({});
  });
  it("deep-links antigos da Sala de Pesquisa ligam o modo pesquisa (e ?work abre o trabalho)", () => {
    const q = (s: string) => new URLSearchParams(s);
    expect(pedidoDoLink(q("tab=pesquisa"))).toEqual({ modoPesquisa: true });
    expect(pedidoDoLink(q("worktype=TCC"))).toEqual({ modoPesquisa: true });
    expect(pedidoDoLink(q(`work=${"b".repeat(24)}`))).toEqual({ modoPesquisa: true, trabalhoId: "b".repeat(24) });
    expect(pedidoDoLink(q("tab=sala-de-estudos"))).toBeNull();
  });
});
