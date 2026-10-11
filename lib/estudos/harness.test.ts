import { describe, expect, it } from "vitest";
import { MAX_CONFIRMACOES, MAX_ESPECULACOES, MAX_PASSOS, alturaEstimada, cardsDaResposta, cardsDoPercurso, temaDoCard } from "./harness";
import { sanitizarCard, type CardEstudo } from "./board";

const estudo: CardEstudo = { id: "e1", tipo: "estudo", x: 1000, y: 100, w: 380, titulo: "Engenharia reversa do PS5", corpo: "Como o boot funciona?" };

describe("o HARNESS: percurso e resposta certeira viram ramificações", () => {
  it("o tema sai do título + texto do card", () => { expect(temaDoCard(estudo)).toBe("Engenharia reversa do PS5 — Como o boot funciona?"); });
  it("o PERCURSO: um card por passo, numerado, à esquerda do estudo, em leque (sem sobrepor) e válido", () => {
    const passos = Array.from({ length: 12 }, (_, i) => ({ label: `Passo ${i}`, corpo: i % 2 ? "detalhe" : undefined }));
    const cs = cardsDoPercurso(estudo, [estudo], passos, "u1");
    expect(cs).toHaveLength(MAX_PASSOS); expect(cs[0]!.titulo).toBe("1. Passo 0");
    for (const c of cs) { expect(c.pai).toBe("e1"); expect(c.x + c.w).toBeLessThan(estudo.x); expect(sanitizarCard(c)).toEqual(c); }
    for (let i = 1; i < cs.length; i++) expect(cs[i]!.y).toBeGreaterThanOrEqual(cs[i - 1]!.y + alturaEstimada(cs[i - 1]!));
    expect(cardsDoPercurso(estudo, [estudo], [{ label: "  " }])).toEqual([]);
  });
  it("a RESPOSTA CERTEIRA: confirmações agrupadas por afirmação, com as fontes; derrubadas e lacunas viram especulações menores", () => {
    const artigos = [{ id: "a", title: "Paper A", year: 2020, doi: "10.1/a" }, { id: "b", title: "Paper B", url: "https://b.org/x" }];
    const r = cardsDaResposta(estudo, [estudo], {
      confirmadas: [{ claim: "O boot usa uma ROM", quote: "boot ROM", paperId: "a" }, { claim: "o boot usa uma rom", quote: "a ROM", paperId: "b" }, { claim: "Fantasma", quote: "x", paperId: "zzz" }],
      derrubadas: [{ claim: "Há uma brecha no hypervisor", quote: "?", paperId: "a" }, { claim: "O boot usa uma ROM", quote: "?", paperId: "b" }],
      lacunas: ["Ninguém mediu o tempo de boot"], artigos,
    }, "u1");
    const conf = r.filter((c) => c.tipo === "confirmacao"), esp = r.filter((c) => c.tipo === "especulacao");
    expect(conf).toHaveLength(1);   // (a mesma afirmação, duas fontes; a de artigo desconhecido some)
    expect(conf[0]!.fontes).toEqual([{ titulo: "Paper A", url: "https://doi.org/10.1/a", ano: 2020 }, { titulo: "Paper B", url: "https://b.org/x" }]);
    expect(esp.map((e) => e.titulo)).toEqual(["Há uma brecha no hypervisor", "Lacuna aberta"]);   // (o que foi confirmado não vira especulação)
    expect(esp[0]!.w).toBeLessThan(conf[0]!.w);
    for (const c of r) expect(sanitizarCard(c)).toEqual(c);
  });
  it("sem artigos nas bases: a resposta inteira fica como UMA especulação", () => {
    const r = cardsDaResposta(estudo, [estudo], { confirmadas: [], derrubadas: [], lacunas: [], artigos: [], semFontes: "Pela web, parece que…" });
    expect(r).toHaveLength(1); expect(r[0]!.tipo).toBe("especulacao"); expect(r[0]!.titulo).toMatch(/Sem fonte/);
  });
  it("tetos: no máximo N confirmações e N especulações por resposta", () => {
    const artigos = [{ id: "a", title: "A" }];
    const r = cardsDaResposta(estudo, [estudo], { confirmadas: Array.from({ length: 20 }, (_, i) => ({ claim: `c${i}`, quote: "q", paperId: "a" })), derrubadas: Array.from({ length: 20 }, (_, i) => ({ claim: `d${i}`, quote: "q", paperId: "a" })), lacunas: [], artigos });
    expect(r.filter((c) => c.tipo === "confirmacao")).toHaveLength(MAX_CONFIRMACOES); expect(r.filter((c) => c.tipo === "especulacao")).toHaveLength(MAX_ESPECULACOES);
  });
});
