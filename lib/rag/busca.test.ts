import { describe, it, expect, vi } from "vitest";
import { buscar, montarPipeline, colecaoRagPrisma, VEC_INDEX, TEXT_INDEX, type BuscaDeps } from "./busca";
import { filtroTextual, filtroVetorial } from "./permissao";

const e = { userId: "u1", turmaIds: ["t1"] };
const VETOR = [0.1, 0.2, 0.3];

function achado(over: Record<string, unknown> = {}) {
  return {
    _id: "tr1", documentoId: "d1", titulo: "Cálculo I", texto: "limite de uma função", paginaIni: 3, paginaFim: 4,
    score: 0.5, turmaIds: ["t1"], donoIds: [], ...over,
  };
}

function deps(over: Partial<BuscaDeps> = {}) {
  const aggregate = vi.fn(async (_p: unknown[]) => [achado()]);
  const embed = vi.fn(async () => [VETOR]);
  const d: BuscaDeps = { colecao: { aggregate }, embed, contar: async () => ({ pessoais: 0, deTurma: 1 }), ...over };
  return Object.assign(d, { aggregate, embedMock: embed });
}

describe("montarPipeline", () => {
  it("com vetor: $rankFusion, filtro vetorial idêntico e filtro textual no compound.filter", () => {
    const p = montarPipeline(e, "limite", VETOR, 8) as any[];
    const rf = p[0].$rankFusion.input.pipelines;
    const vs = rf.vector[0].$vectorSearch;
    expect(vs.index).toBe(VEC_INDEX);
    expect(vs.path).toBe("embedding");
    expect(vs.queryVector).toEqual(VETOR);
    expect(vs.numCandidates).toBe(100);
    expect(vs.limit).toBe(8);
    expect(vs.filter).toEqual(filtroVetorial(e));
    const s = rf.texto[0].$search;
    expect(s.index).toBe(TEXT_INDEX);
    expect(s.compound.must).toEqual([{ text: { query: "limite", path: "texto" } }]);
    expect(s.compound.filter).toEqual(filtroTextual(e));
    expect(s.compound.should).toBeUndefined();
    expect(rf.texto[1]).toEqual({ $limit: 8 });
    expect(JSON.stringify(p)).toContain("rag_documentos");
  });

  it("numCandidates escala com k", () => {
    const p = montarPipeline(e, "x", VETOR, 20) as any[];
    expect(p[0].$rankFusion.input.pipelines.vector[0].$vectorSearch.numCandidates).toBe(240);
  });

  it("sem vetor: só o ramo texto, sem $rankFusion nem $vectorSearch", () => {
    const p = montarPipeline(e, "limite", null, 8);
    const s = JSON.stringify(p);
    expect(s).not.toContain("$rankFusion");
    expect(s).not.toContain("$vectorSearch");
    expect((p[0] as any).$search.compound.filter).toEqual(filtroTextual(e));
  });
});

describe("buscar", () => {
  it("sem base: [] e embed NÃO é chamado", async () => {
    const d = deps({ contar: async () => ({ pessoais: 0, deTurma: 0 }) });
    expect(await buscar(d, e, "limite")).toEqual([]);
    expect(d.embedMock).not.toHaveBeenCalled();
    expect(d.aggregate).not.toHaveBeenCalled();
  });

  it("userId vazio/branco: [] sem contar, embed nem aggregate", async () => {
    const contar = vi.fn(async () => ({ pessoais: 5, deTurma: 5 }));
    const d = deps({ contar });
    expect(await buscar(d, { userId: "", turmaIds: ["t1"] }, "x")).toEqual([]);
    expect(await buscar(d, { userId: "   ", turmaIds: [] }, "x")).toEqual([]);
    expect(contar).not.toHaveBeenCalled();
    expect(d.embedMock).not.toHaveBeenCalled();
    expect(d.aggregate).not.toHaveBeenCalled();
  });

  it("caminho feliz: embed com tipo pergunta, mapeia o resultado", async () => {
    const d = deps();
    const r = await buscar(d, e, "limite");
    expect(d.embedMock).toHaveBeenCalledWith(["limite"], "pergunta");
    expect(JSON.stringify(d.aggregate.mock.calls[0][0])).toContain("$rankFusion");
    expect(r).toEqual([
      { trechoId: "tr1", documentoId: "d1", titulo: "Cálculo I", texto: "limite de uma função", paginaIni: 3, paginaFim: 4, score: 0.5 },
    ]);
  });

  it("normaliza ObjectId em extended JSON ({$oid})", async () => {
    const d = deps();
    d.aggregate.mockResolvedValue([achado({ _id: { $oid: "aaa" }, documentoId: { $oid: "bbb" } })]);
    const r = await buscar(d, e, "limite");
    expect(r[0].trechoId).toBe("aaa");
    expect(r[0].documentoId).toBe("bbb");
  });

  it("embed rejeita: cai para só texto e não lança", async () => {
    const d = deps({ embed: vi.fn(async () => { throw new Error("embed_http_500"); }) });
    const r = await buscar(d, e, "limite");
    expect(JSON.stringify(d.aggregate.mock.calls[0][0])).not.toContain("$vectorSearch");
    expect(r).toHaveLength(1);
  });

  it("embed estoura o prazo: cai para só texto", async () => {
    const d = deps({ embed: () => new Promise<number[][]>(() => {}), prazoEmbedMs: 10 });
    const r = await buscar(d, e, "limite");
    expect(JSON.stringify(d.aggregate.mock.calls[0][0])).not.toContain("$vectorSearch");
    expect(r).toHaveLength(1);
  });

  it("não deixa timer pendente quando o embed responde", async () => {
    const clear = vi.spyOn(globalThis, "clearTimeout");
    const d = deps();
    await buscar(d, e, "limite");
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });

  it("descarta trecho de turma alheia devolvido pela coleção (podeVer)", async () => {
    const d = deps();
    d.aggregate.mockResolvedValue([
      achado({ _id: "ok", turmaIds: ["t1"] }),
      achado({ _id: "alheio", turmaIds: ["t9"], donoIds: ["u2"] }),
    ]);
    const r = await buscar(d, e, "limite");
    expect(r.map((x) => x.trechoId)).toEqual(["ok"]);
  });

  it("falha do aggregate propaga", async () => {
    const d = deps();
    d.aggregate.mockRejectedValue(new Error("boom"));
    await expect(buscar(d, e, "limite")).rejects.toThrow("boom");
  });
});

describe("colecaoRagPrisma", () => {
  it("roda aggregate em rag_trechos e devolve cursor.firstBatch", async () => {
    const run = vi.fn(async () => ({ cursor: { firstBatch: [{ a: 1 }] }, ok: 1 }));
    const col = colecaoRagPrisma({ $runCommandRaw: run } as any);
    const out = await col.aggregate([{ $limit: 1 }]);
    expect(run).toHaveBeenCalledWith({ aggregate: "rag_trechos", pipeline: [{ $limit: 1 }], cursor: {} });
    expect(out).toEqual([{ a: 1 }]);
  });
});
