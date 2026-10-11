import { describe, expect, it } from "vitest";
import { VALIDADE_LINKS_MS, linksDoBlueprint, montarBlueprint, raridadeDe } from "./blueprint";
import { aplicarOps, sanitizarCard, type CardEstudo } from "./board";

const T = 1_790_000_000_000;
const base = (o: Partial<CardEstudo> = {}): CardEstudo[] => [
  { id: "e", tipo: "estudo", x: 0, y: 0, w: 380, titulo: "Engenharia reversa do PS5", corpo: "Entender o boot", ...o },
  { id: "p1", tipo: "percurso", x: 0, y: 0, w: 300, pai: "e", titulo: "1. Mapear o hardware" },
  ...Array.from({ length: 5 }, (_, i): CardEstudo => ({ id: `c${i}`, tipo: "confirmacao", x: 0, y: 0, w: 320, pai: "p1", titulo: `Fato ${i}`, fontes: [{ titulo: `Paper ${i}`, url: `https://doi.org/10.1/${i}` }] })),
  { id: "s1", tipo: "especulacao", x: 0, y: 0, w: 230, pai: "e", titulo: "Brecha no hypervisor?" },
];

describe("o BLUEPRINT do estudo", () => {
  it("monta a prancha: componentes numerados (as confirmações com fonte), o caminho, o em aberto e as fontes únicas", () => {
    const b = montarBlueprint(base(), "e", T)!;
    expect(b.componentes.map((c) => c.codigo)).toEqual(["C-01", "C-02", "C-03", "C-04", "C-05"]);
    expect(b.passos.map((p) => p.titulo)).toEqual(["1. Mapear o hardware"]); expect(b.abertos).toHaveLength(1);
    expect(b.fontes).toHaveLength(5); expect(montarBlueprint(base(), "p1", T)).toBeNull();
  });
  it("os SELOS: sem checagem os links ficam pendentes; checados e todos ok valem por 30 dias; um quebrado = falhou", () => {
    expect(montarBlueprint(base(), "e", T)!.selos.links).toBe("pendente");
    expect(montarBlueprint(base({ selos: { links: { ok: 5, total: 5, em: T - 1000 } } }), "e", T)!.selos.links).toBe("ok");
    expect(montarBlueprint(base({ selos: { links: { ok: 4, total: 5, em: T - 1000 } } }), "e", T)!.selos.links).toBe("falhou");
    expect(montarBlueprint(base({ selos: { links: { ok: 5, total: 5, em: T - VALIDADE_LINKS_MS - 1 } } }), "e", T)!.selos.links).toBe("pendente");
  });
  it("a RARIDADE sobe com a profundidade e os selos; VENDÁVEL só com base pra entregar (produto + links ok + entregável)", () => {
    expect([0, 24, 25, 50, 75, 100].map(raridadeDe)).toEqual(["comum", "comum", "rara", "epica", "lendaria", "lendaria"]);
    const crua = montarBlueprint(base(), "e", T)!;
    const pronta = montarBlueprint(base({ produto: "Um curso de 8 aulas + o dump comentado", repo: "https://github.com/x/privado", selos: { links: { ok: 6, total: 6, em: T } } }), "e", T)!;
    expect(pronta.pontos).toBeGreaterThan(crua.pontos); expect(crua.vendavel).toBe(false); expect(pronta.vendavel).toBe(true);
    expect(pronta.selos.codigo).toBe("ok"); expect(linksDoBlueprint(pronta)).toContain("https://github.com/x/privado");
  });
  it("o cliente NÃO forja selo: só o servidor grava; editar o estudo mantém os selos do banco", () => {
    const atual = base({ selos: { links: { ok: 2, total: 5, em: T } } });
    const forjado = aplicarOps(atual, { upsert: [{ ...atual[0], titulo: "novo", selos: { links: { ok: 5, total: 5, em: T } } }] });
    expect(forjado.find((c) => c.id === "e")!.selos).toEqual({ links: { ok: 2, total: 5, em: T } }); expect(forjado.find((c) => c.id === "e")!.titulo).toBe("novo");
    const novoForjado = aplicarOps([], { upsert: [{ id: "e2", tipo: "estudo", x: 0, y: 0, selos: { links: { ok: 1, total: 1, em: T } } }] });
    expect(novoForjado[0]!.selos).toBeUndefined();
    expect(aplicarOps(atual, { upsert: [{ ...atual[0], selos: { links: { ok: 5, total: 5, em: T } } }] }, { servidor: true }).find((c) => c.id === "e")!.selos!.links!.ok).toBe(5);
    expect(sanitizarCard({ id: "n", tipo: "nota", x: 0, y: 0, produto: "x", repo: "https://a.b" })).toEqual({ id: "n", tipo: "nota", x: 0, y: 0, w: 260 });   // (só o estudo tem)
  });
});
