import { describe, expect, it } from "vitest";
import { LARGURA, aplicarOps, boardInicial, filhosDe, lerCards, mesclarRemoto, posicaoDoFilho, profundidade, raizDe, sanitizarCard, urlSegura, type CardEstudo } from "./board";

const card = (o: Partial<CardEstudo> & { id: string }): CardEstudo => ({ tipo: "nota", x: 0, y: 0, w: 260, ...o });

describe("o board de MEUS ESTUDOS", () => {
  it("sanitiza: lixo some; tipo, posição, pai e fontes passam (só http/https)", () => {
    expect(sanitizarCard(null)).toBeNull(); expect(sanitizarCard({ id: "a b", tipo: "nota", x: 0, y: 0 })).toBeNull();
    expect(sanitizarCard({ id: "a", tipo: "titulo", x: 0, y: 0 })).toBeNull();   // (tipo da cartolina antiga)
    expect(sanitizarCard({ id: "a", tipo: "nota", x: "1", y: 0 })).toBeNull();
    const c = sanitizarCard({ id: "c1", tipo: "confirmacao", x: 1e9, y: 3, pai: "e1", fontes: [{ titulo: "Paper", url: "javascript:alert(1)", ano: 2021 }, { titulo: "Outro", url: "https://doi.org/10.1/x" }, { nada: 1 }] })!;
    expect(c.x).toBe(40000); expect(c.w).toBe(LARGURA.confirmacao); expect(c.pai).toBe("e1");
    expect(c.fontes).toEqual([{ titulo: "Paper", ano: 2021 }, { titulo: "Outro", url: "https://doi.org/10.1/x" }]);
    expect(sanitizarCard({ id: "e", tipo: "especulacao", x: 0, y: 0, fontes: [{ titulo: "x" }] })!.fontes).toBeUndefined();   // especulação não tem fonte
    expect(sanitizarCard({ id: "z", tipo: "nota", x: 0, y: 0, pai: "z" })!.pai).toBeUndefined();   // não é pai de si mesmo
    expect(urlSegura("ftp://x")).toBeUndefined(); expect(urlSegura("https://a.b/c")).toBe("https://a.b/c");
    expect(lerCards("x")).toEqual([]); expect(lerCards([{ id: "a", tipo: "nota", x: 0, y: 0 }, { quebrado: true }])).toHaveLength(1);
  });
  it("operações: remove, insere, atualiza — e os filhos de um card removido ficam soltos", () => {
    const base = [card({ id: "e", tipo: "estudo" }), card({ id: "f", tipo: "percurso", pai: "e" }), card({ id: "n" })];
    const r = aplicarOps(base, { remove: ["e"], upsert: [{ id: "n", tipo: "nota", x: 5, y: 6 }, { id: "novo", tipo: "pergunta", x: 1, y: 1 }] });
    expect(r.map((c) => c.id).sort()).toEqual(["f", "n", "novo"]);
    expect(r.find((c) => c.id === "f")!.pai).toBeUndefined(); expect(r.find((c) => c.id === "n")!.x).toBe(5);
  });
  it("mescla o remoto sem perder a minha edição em voo", () => {
    const local = [card({ id: "a", x: 99 }), card({ id: "b" })], remoto = [card({ id: "a", x: 1 }), card({ id: "c" })];
    const m = mesclarRemoto(local, remoto, new Set(["a"]));
    expect(m.find((c) => c.id === "a")!.x).toBe(99); expect(m.map((c) => c.id).sort()).toEqual(["a", "c"]);
  });
  it("as RAMIFICAÇÕES crescem da DIREITA pra ESQUERDA: o filho fica à esquerda do pai, os irmãos descem em leque", () => {
    const pai = card({ id: "e", tipo: "estudo", x: 1000, y: 100, w: 380 }), h = () => 120;
    const p1 = posicaoDoFilho(pai, [], "confirmacao", h); expect(p1.x + p1.w).toBeLessThan(pai.x); expect(p1.y).toBe(pai.y);
    const irmao = card({ id: "c1", tipo: "confirmacao", ...p1, pai: "e" });
    const p2 = posicaoDoFilho(pai, [irmao], "especulacao", h); expect(p2.y).toBeGreaterThan(irmao.y + 120); expect(p2.w).toBeLessThan(p1.w);   // especulação: menor
  });
  it("a PROFUNDIDADE conta confirmações com fonte muito mais que especulações; a raiz é o card de estudo", () => {
    const cs = [card({ id: "e", tipo: "estudo" }), card({ id: "p", tipo: "percurso", pai: "e" }), card({ id: "c", tipo: "confirmacao", pai: "p", fontes: [{ titulo: "A", url: "https://a" }] }),
      card({ id: "s", tipo: "especulacao", pai: "c" }), card({ id: "c2", tipo: "confirmacao", pai: "e" }), card({ id: "solta" })];
    const p = profundidade(cs, "e");
    expect(p).toMatchObject({ confirmacoes: 1, especulacoes: 1, passos: 1, fontes: 1 });   // (a confirmação sem fonte não conta)
    const so = profundidade([card({ id: "e", tipo: "estudo" }), ...Array.from({ length: 10 }, (_, i) => card({ id: `s${i}`, tipo: "especulacao", pai: "e" }))], "e");
    expect(so.nota).toBeLessThan(p.nota);
    expect(raizDe(cs, "s")!.id).toBe("e"); expect(raizDe(cs, "solta")).toBeNull(); expect(filhosDe(cs, "e").map((c) => c.id)).toEqual(["p", "c2"]);
    expect(profundidade(cs, "nada").nota).toBe(0);
  });
  it("o board inicial tem um estudo e uma nota válidos", () => {
    const b = boardInicial("u1"); expect(b.map((c) => sanitizarCard(c))).toEqual(b);
  });
});
