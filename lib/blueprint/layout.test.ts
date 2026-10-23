import { describe, expect, it } from "vitest";
import { layoutBlueprint, modulosDo, type Caixa } from "./layout";
import { docVazio, type Critico, type DocBlueprint } from "./tipos";

const critico = (id: string, o: Partial<Critico> = {}): Critico => ({ id, fase: 2, titulo: id, prova: "p", tipoProva: "repo", abertoEm: 0, status: "aberto", ...o });
const cheio = (o: Partial<DocBlueprint> = {}): DocBlueprint => ({
  ...docVazio("Privacy on Solana", 0), fase: 2,
  passos: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, titulo: `passo ${i}`, fase: 1 as const, fontes: [] })),
  pecas: [{ id: "zk", nome: "prova ZK", fase: 2 }],
  criticos: [critico("r1", { passoId: "p2" }), critico("r2")],
  repos: [{ nome: "a/b", url: "https://github.com/a/b" }], participantes: [{ id: "aura", nome: "Aura", papel: "agente" }],
  produto: { titulo: "Carteira privada" }, proximos: ["fechar R-01"],
  ...o,
});
const alt = () => 120;
const sobrepoe = (a: Caixa, b: Caixa) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const doId = (cs: Caixa[], id: string) => cs.find((c) => c.id === id)!;

describe("layoutBlueprint — simetria, nunca caos", () => {
  it("nenhuma caixa sobreposta", () => {
    const { caixas } = layoutBlueprint(cheio(), alt);
    for (let i = 0; i < caixas.length; i++) for (let j = i + 1; j < caixas.length; j++) expect(sobrepoe(caixas[i]!, caixas[j]!), `${caixas[i]!.id} × ${caixas[j]!.id}`).toBe(false);
  });
  it("esquerda→direita: percurso à esquerda do estudo, prática à direita", () => {
    const { caixas } = layoutBlueprint(cheio(), alt); const e = doId(caixas, "estudo");
    for (const c of caixas.filter((c) => c.lado === "esq")) expect(c.x + c.w).toBeLessThan(e.x);
    for (const c of caixas.filter((c) => c.lado === "dir")) expect(c.x).toBeGreaterThan(e.x + e.w);
  });
  it("os dois lados centrados no meio do estudo", () => {
    const { caixas } = layoutBlueprint(cheio(), alt); const e = doId(caixas, "estudo"), meio = e.y + e.h / 2;
    for (const lado of ["esq", "dir"] as const) {
      const cs = caixas.filter((c) => c.lado === lado), topo = Math.min(...cs.map((c) => c.y)), fundo = Math.max(...cs.map((c) => c.y + c.h));
      expect(Math.abs((topo + fundo) / 2 - meio)).toBeLessThanOrEqual(1);
    }
  });
  it("críticos da fase empilhados no eixo, um embaixo do outro", () => {
    const { caixas } = layoutBlueprint(cheio(), alt); const a = doId(caixas, "critico:r1"), b = doId(caixas, "critico:r2");
    expect(a.x + a.w / 2).toBeCloseTo(0); expect(b.y).toBeGreaterThan(a.y + a.h);
  });
  it("crítico ligado ao passo que trava", () => {
    const { fios } = layoutBlueprint(cheio(), alt);
    expect(fios).toContainEqual({ de: "critico:r1", para: "passo:p2", tipo: "critico" });
    expect(fios).toContainEqual({ de: "estudo", para: "passo:p0", tipo: "percurso" });
    expect(fios).toContainEqual({ de: "estudo", para: "repos", tipo: "pratica" });
  });
  it("blueprint recém-nascido (sem passos) não quebra; o YouTube aparece desde o começo", () => {
    const ids = modulosDo(docVazio("X", 0)).map((m) => m.id);
    expect(ids).toEqual(["estudo", "youtube"]);
    expect(() => layoutBlueprint(docVazio("X", 0), alt)).not.toThrow();
  });
  it("o que a pessoa arrastou fica onde ela soltou", () => {
    const { caixas } = layoutBlueprint(cheio({ fixos: { repos: { x: 5000, y: 7 } } }), alt);
    expect(doId(caixas, "repos")).toMatchObject({ x: 5000, y: 7 });
  });
  it("críticos provados saem da faixa; sem abertos e com avaliação, a avaliação ocupa o lugar", () => {
    const d = cheio({ criticos: [critico("r1", { status: "provado", entrega: { url: "https://x.org", em: 1, detalhe: "" } })], avaliacoes: [{ fase: 1, em: 2, nota: { rigor: 80, originalidade: 70, usabilidade: 70, viabilidade: 70, impacto: 70 }, parecer: "ok", aprovada: true }] });
    const ids = modulosDo(d).map((m) => m.id);
    expect(ids).not.toContain("critico:r1"); expect(ids).toContain("avaliacao");
  });
});

describe("foco da fase — não panorâmico", () => {
  it("passos das próximas fases ficam recolhidos num card só; a demo só aparece na fase 3", () => {
    const d = cheio({ fase: 1, passos: [1, 1, 2, 3, 4].map((f, i) => ({ id: `p${i}`, titulo: `p${i}`, fase: f as 1 | 2 | 3 | 4, fontes: [] })), criticos: [] });
    const ids = modulosDo(d).map((m) => m.id);
    expect(ids.filter((x) => x.startsWith("passo:"))).toEqual(["passo:p0", "passo:p1"]); expect(ids).toContain("futuro");
    expect(ids).not.toContain("demo"); expect(modulosDo({ ...d, fase: 3 }).map((m) => m.id)).toContain("demo");
  });
  it("a figura é a protagonista: larga, no topo do eixo, sem encostar nos lados", () => {
    const { caixas } = layoutBlueprint(cheio(), alt); const f = doId(caixas, "figura");
    expect(f.y).toBe(Math.min(...caixas.filter((c) => c.lado === "centro").map((c) => c.y)));
    for (const c of caixas.filter((k) => k.lado !== "centro")) expect(sobrepoe(f, c)).toBe(false);
  });
  it("o enquadramento inicial é o eixo central", async () => {
    const { caixaDoFoco } = await import("./layout");
    const { caixas } = layoutBlueprint(cheio(), alt); const f = caixaDoFoco(caixas)!;
    expect(f.x1 - f.x0).toBeLessThan(1000);
  });
});
