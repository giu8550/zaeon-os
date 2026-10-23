import { describe, expect, it } from "vitest";
import { lerPlano, mesclarComposicao, promptComposicao, type PlanoComposto } from "./compor";
import { docVazio, type Critico, type DocBlueprint } from "./tipos";

const entrega = { url: "https://github.com/voce/privado", em: 50, detalhe: "repo público" };
const provado: Critico = { id: "r1", fase: 2, titulo: "Transferência confidencial na devnet", prova: "repo", tipoProva: "repo", abertoEm: 3, status: "provado", entrega };
const doc = (o: Partial<DocBlueprint> = {}): DocBlueprint => ({ ...docVazio("Privacy on Solana", 0), fase: 2, ...o });
const plano = (o: Partial<PlanoComposto> = {}): PlanoComposto => lerPlano({ titulo: "Privacy on Solana", passos: [{ id: "p1", titulo: "Fundamentos", fase: 1 }], ...o })!;

describe("lerPlano", () => {
  it("sem título nem passos não é plano", () => { expect(lerPlano({})).toBeNull(); expect(lerPlano("x")).toBeNull(); });
  it("lê os passos e poda o que não presta", () => {
    const p = lerPlano({ titulo: "X", passos: [{ id: "p1", titulo: "a", fase: 1 }, { id: "p1", titulo: "dup", fase: 1 }, { titulo: "sem id" }] })!;
    expect(p.passos.map((x) => x.titulo)).toEqual(["a"]);
  });
});

describe("mesclarComposicao — a Zaeon reescreve tudo, menos a entrega provada", () => {
  it("o crítico provado sobrevive mesmo que o plano o esqueça", () => {
    const r = mesclarComposicao(doc({ criticos: [provado] }), plano(), 100);
    expect(r.criticos.find((c) => c.id === "r1")).toEqual(provado);
  });
  it("o plano não reabre um crítico provado de mesmo id", () => {
    const r = mesclarComposicao(doc({ criticos: [provado] }), plano({ criticos: [{ id: "r1", fase: 2, titulo: "outro", prova: "x", tipoProva: "link" }] }), 100);
    expect(r.criticos.filter((c) => c.id === "r1")).toEqual([provado]);
  });
  it("crítico de fase já passada é descartado", () => {
    const r = mesclarComposicao(doc(), plano({ criticos: [{ id: "r9", fase: 1, titulo: "velho", prova: "x", tipoProva: "link" }] }), 100);
    expect(r.criticos).toEqual([]);
  });
  it("aberto que continua guarda o abertoEm; novo nasce agora", () => {
    const aberto: Critico = { id: "r3", fase: 2, titulo: "medir", prova: "README", tipoProva: "link", abertoEm: 10, status: "aberto" };
    const r = mesclarComposicao(doc({ criticos: [aberto] }), plano({ criticos: [{ id: "r3", fase: 2, titulo: "medir CU", prova: "README", tipoProva: "link" }, { id: "r4", fase: 3, titulo: "no ar", prova: "url", tipoProva: "demo" }] }), 100);
    expect(r.criticos.find((c) => c.id === "r3")).toMatchObject({ abertoEm: 10, titulo: "medir CU", status: "aberto" });
    expect(r.criticos.find((c) => c.id === "r4")).toMatchObject({ abertoEm: 100, status: "aberto" });
  });
  it("fase, avaliações, notas e repos intactos; fixos de módulos que sumiram caem; turnos +1", () => {
    const antes = doc({ fixos: { "passo:p9": { x: 1, y: 1 }, "passo:p1": { x: 2, y: 2 }, repos: { x: 0, y: 0 } }, notas: [{ id: "n1", corpo: "minha" }], turnos: 4, repos: [{ nome: "a/b", url: "https://github.com/a/b" }] });
    const r = mesclarComposicao(antes, plano(), 100);
    expect(r.fase).toBe(2); expect(r.notas).toEqual(antes.notas); expect(r.repos).toEqual(antes.repos);
    expect(r.fixos).toEqual({ "passo:p1": { x: 2, y: 2 }, repos: { x: 0, y: 0 } });
    expect(r.turnos).toBe(5); expect(r.compostoEm).toBe(100);
  });
  it("crítico apontando pra peça que não existe perde o ponteiro", () => {
    const r = mesclarComposicao(doc(), plano({ pecas: [{ id: "zk", nome: "prova ZK", fase: 2 }], criticos: [{ id: "r5", fase: 2, titulo: "t", prova: "p", tipoProva: "repo", pecaId: "nada" }] }), 1);
    expect(r.criticos[0]!.pecaId).toBeUndefined();
  });
});

describe("promptComposicao", () => {
  it("marca o provado como IMUTÁVEL e corta mensagem longa", () => {
    const p = promptComposicao({ doc: doc({ criticos: [provado] }), conversa: [{ role: "user", text: "a".repeat(2000) }] });
    expect(p).toContain("IMUTÁVEL"); expect(p).toContain(provado.titulo);
    expect(p).not.toContain("a".repeat(601));
  });
});

describe("o teto de críticos nunca come entrega provada", () => {
  it("12 provados de fases passadas + plano novo: a fase atual ainda ganha críticos e nenhum provado some", () => {
    const provados = Array.from({ length: 12 }, (_, i): Critico => ({ ...provado, id: `v${i}`, fase: i < 6 ? 1 : 2 }));
    const r = mesclarComposicao(doc({ fase: 3, criticos: provados }), plano({ criticos: [{ id: "n1", fase: 3, titulo: "no ar", prova: "url", tipoProva: "demo" }] }), 1);
    expect(r.criticos.filter((c) => c.status === "provado")).toHaveLength(12);
    expect(r.criticos.find((c) => c.id === "n1")).toBeTruthy();
  });
  it("no máximo 3 abertos por fase vindos do plano", () => {
    const p = lerPlano({ titulo: "X", criticos: Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, fase: 2, titulo: "t", prova: "p", tipoProva: "link" })) })!;
    expect(p.criticos).toHaveLength(3);
  });
});

describe("documentos-base", () => {
  it("a Zaeon vê os documentos e marca a base; ids que não existem não marcam nada", () => {
    const antes = doc({ documentos: [{ id: "da", titulo: "Zether", tipo: "artigo", base: false }, { id: "db", titulo: "Apostila", tipo: "base", ref: "x", base: false }] });
    expect(promptComposicao({ doc: antes, conversa: [] })).toContain("da — artigo — Zether");
    const r = mesclarComposicao(antes, plano({ documentosBase: ["db", "nada"] }), 1);
    expect(r.documentos.map((d) => [d.id, d.base])).toEqual([["da", false], ["db", true]]);
  });
});

describe("a figura não some e o YouTube vem da Zaeon", () => {
  it("plano sem peças mantém a máquina anterior; com 3+ peças, troca", () => {
    const pecas = [{ id: "a", nome: "A", fase: 1 as const }, { id: "b", nome: "B", fase: 1 as const }, { id: "c", nome: "C", fase: 2 as const }];
    const antes = doc({ pecas, ligacoes: [["a", "b"]] });
    expect(mesclarComposicao(antes, plano({ pecas: [] }), 1).pecas).toEqual(pecas);
    const novas = [{ id: "x", nome: "X", fase: 1 as const }, { id: "y", nome: "Y", fase: 1 as const }, { id: "z", nome: "Z", fase: 2 as const }];
    expect(mesclarComposicao(antes, plano({ pecas: novas }), 1).pecas.map((p) => p.id)).toEqual(["x", "y", "z"]);
  });
  it("buscas do YouTube entram (até 4) e ficam se o plano não trouxer", () => {
    const r = mesclarComposicao(doc(), lerPlano({ titulo: "T", passos: [{ id: "p1", titulo: "a", fase: 1 }], buscasYoutube: ["zk proofs explicado", "token-2022 tutorial"] })!, 1);
    expect(r.buscasYoutube).toEqual(["zk proofs explicado", "token-2022 tutorial"]);
    expect(mesclarComposicao(r, plano(), 2).buscasYoutube).toEqual(r.buscasYoutube);
  });
});
