import { describe, it, expect, vi } from "vitest";
import { retrievePapers, mergeDisplayReferences } from "./retrieve";
import type { Paper } from "./types";
import type { SourceName, SourceResult } from "./sources";

const mk = (id: string, over: Partial<Paper> = {}): Paper => ({
  id, title: `t-${id}`, authors: [], openAccess: false, sources: ["x"], ...over,
});
// devolve N papers únicos para uma dada fonte
const papersFor = (src: SourceName, n: number, offset = 0): Paper[] =>
  Array.from({ length: n }, (_, i) => mk(`${src}-${offset + i}`, { sources: [src] }));

describe("retrievePapers", () => {
  it("dedup + atinge o mínimo só com as fontes primárias", async () => {
    const search = vi.fn(async (_q: string, sources: SourceName[]): Promise<SourceResult[]> =>
      sources.map((s) => ({ source: s, papers: papersFor(s, 5), status: "ok" as const })));
    const r = await retrievePapers("ia", { domain: undefined, minResults: 12, search });
    expect(r.papers.length).toBeGreaterThanOrEqual(12);
    expect(r.reachedMin).toBe(true);
    expect(search).toHaveBeenCalledTimes(1); // sem top-up
  });

  it("faz top-up nas fontes restantes quando as primárias não bastam", async () => {
    const search = vi.fn(async (_q: string, sources: SourceName[]): Promise<SourceResult[]> => {
      return sources.map((s) =>
        s === "pubmed"
          ? { source: s, papers: papersFor(s, 20), status: "ok" as const }
          : { source: s, papers: papersFor(s, 2), status: "ok" as const });
    });
    const r = await retrievePapers("medicina", { minResults: 12, search });
    expect(search).toHaveBeenCalledTimes(2); // primárias + top-up
    expect(r.reachedMin).toBe(true);
    expect(r.papers.length).toBeGreaterThanOrEqual(12);
  });

  it("degrada graciosamente (reachedMin=false) quando todas as fontes trazem pouco", async () => {
    const search = vi.fn(async (_q: string, sources: SourceName[]): Promise<SourceResult[]> =>
      sources.map((s) => ({ source: s, papers: papersFor(s, 1), status: "ok" as const })));
    const r = await retrievePapers("tópico raro", { minResults: 12, search });
    expect(r.reachedMin).toBe(false);
    expect(r.papers.length).toBeLessThan(12);
  });

  it("chama onSource para cada fonte e reporta perSource", async () => {
    const seen: string[] = [];
    const search = async (_q: string, sources: SourceName[]): Promise<SourceResult[]> =>
      sources.map((s) => ({ source: s, papers: papersFor(s, 4), status: "ok" as const }));
    const r = await retrievePapers("dados", { minResults: 12, search, onSource: (x) => seen.push(x.source) });
    expect(seen.length).toBe(r.perSource.length);
    expect(r.perSource.every((p) => p.count === 4)).toBe(true);
  });

  it("string vazia → resultado vazio sem chamar search", async () => {
    const search = vi.fn();
    const r = await retrievePapers("   ", { search: search as any });
    expect(r.papers).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });
});

describe("mergeDisplayReferences", () => {
  it("verificados primeiro, sem duplicar, completando até o mínimo", () => {
    const verified = [mk("a"), mk("b")];
    const discovered = [mk("a"), mk("c"), mk("d"), mk("e"), ...Array.from({ length: 10 }, (_, i) => mk(`g${i}`))];
    const out = mergeDisplayReferences(verified, discovered, 12);
    expect(out.length).toBe(12);
    expect(out[0].id).toBe("a");
    expect(out[1].id).toBe("b");
    expect(new Set(out.map((p) => p.id)).size).toBe(12); // sem duplicatas
  });
  it("mantém todos os verificados mesmo acima do mínimo", () => {
    const verified = Array.from({ length: 15 }, (_, i) => mk(`v${i}`));
    expect(mergeDisplayReferences(verified, [], 12).length).toBe(15);
  });
});
