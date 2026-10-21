import { describe, it, expect, vi } from "vitest";
import { fakeDb } from "@/lib/rag/fakeDb";
import { criarDocumento, gravarTrechos } from "@/lib/rag/store";
import type { EmbedRag } from "@/lib/rag/embed";
import { enfileirarNaFila, filaRagLigada, indexarDocumento, RAG_QUEUE, type FilaRag } from "./rag";

const USER = "64b000000000000000000001";

async function docComTrechos(db: ReturnType<typeof fakeDb>, n: number) {
  const doc = await criarDocumento(db, {
    hash: "h1", titulo: "Livro", nomeArquivo: "livro.pdf", paginas: 10, markdown: "# Livro", origem: "admin", criadoPor: USER, permissao: { turmaId: "t1" },
  });
  await gravarTrechos(
    db, doc.id,
    Array.from({ length: n }, (_, i) => ({ ordem: i, texto: `texto ${i}`, caminho: "Livro", paginaIni: 1, paginaFim: 1 })),
    { turmaIds: doc.turmaIds, donoIds: doc.donoIds },
  );
  return doc;
}

const embedOk: EmbedRag = async (textos) => textos.map(() => [0.1, 0.2]);

describe("indexarDocumento", () => {
  it("100 trechos sem vetor, embed ok => 100 vetorizados e documento 'pronto'", async () => {
    const db = fakeDb();
    const doc = await docComTrechos(db, 100);
    const r = await indexarDocumento({ db, embed: embedOk }, doc.id);
    expect(r).toEqual({ vetorizados: 100, pronto: true });
    expect((await db.ragDocumento.findUnique({ where: { id: doc.id } }))?.status).toBe("pronto");
  });

  it("embed_http_429 no 2º lote: rejeita, documento segue 'indexando', 1º lote guardado, trechos intactos", async () => {
    const db = fakeDb();
    const doc = await docComTrechos(db, 100);
    let chamadas = 0;
    const embed: EmbedRag = async (textos) => {
      if (++chamadas === 2) throw new Error("embed_http_429");
      return textos.map(() => [1]);
    };
    await expect(indexarDocumento({ db, embed }, doc.id)).rejects.toThrow("embed_http_429");
    const d = await db.ragDocumento.findUnique({ where: { id: doc.id } });
    expect(d?.status).toBe("indexando");
    expect(d?.comVetor).toBe(64);
    expect(db.trechos).toHaveLength(100);
    expect(db.trechos.filter((t) => t.embedding.length > 0)).toHaveLength(64);
  });

  it("reexecutar depois da falha só manda os que faltam (36 textos)", async () => {
    const db = fakeDb();
    const doc = await docComTrechos(db, 100);
    let chamadas = 0;
    const falho: EmbedRag = async (textos) => {
      if (++chamadas === 2) throw new Error("embed_http_429");
      return textos.map(() => [1]);
    };
    await expect(indexarDocumento({ db, embed: falho }, doc.id)).rejects.toThrow();
    const embed = vi.fn<EmbedRag>(async (textos) => textos.map(() => [1]));
    const r = await indexarDocumento({ db, embed }, doc.id);
    expect(embed).toHaveBeenCalledTimes(1);
    expect(embed.mock.calls[0][0]).toHaveLength(36);
    expect(embed.mock.calls[0][1]).toBe("documento");
    expect(r).toEqual({ vetorizados: 36, pronto: true });
  });

  it("embed devolvendo número errado de vetores falha (sem laço infinito)", async () => {
    const db = fakeDb();
    const doc = await docComTrechos(db, 3);
    await expect(indexarDocumento({ db, embed: async () => [] }, doc.id)).rejects.toThrow(/vetores/);
  });
});

describe("filaRagLigada", () => {
  it("exige RAG_QUEUE=1 e REDIS_URL", () => {
    expect(RAG_QUEUE).toBe("rag-index");
    expect(filaRagLigada({ RAG_QUEUE: "1" })).toBe(false);
    expect(filaRagLigada({ REDIS_URL: "redis://x" })).toBe(false);
    expect(filaRagLigada({ RAG_QUEUE: "1", REDIS_URL: "redis://x" })).toBe(true);
  });
});

describe("enfileirarNaFila", () => {
  const OPTS = { jobId: "rag_d1", attempts: 5, backoff: { type: "exponential", delay: 30_000 } };
  const fila = (estado: string | null) => {
    const remove = vi.fn(async () => undefined);
    const add = vi.fn(async () => undefined);
    const q: FilaRag = { getJob: vi.fn(async () => (estado ? { getState: async () => estado, remove } : null)), add };
    return { q, add, remove };
  };

  it("sem job existente => add com as opções do brief", async () => {
    const { q, add, remove } = fila(null);
    expect(await enfileirarNaFila(q, "d1")).toBe("fila");
    expect(remove).not.toHaveBeenCalled();
    expect(add).toHaveBeenCalledWith("indexar", { documentoId: "d1" }, OPTS);
  });

  it.each(["failed", "completed"])("job %s retido => removido e depois adicionado", async (estado) => {
    const { q, add, remove } = fila(estado);
    expect(await enfileirarNaFila(q, "d1")).toBe("fila");
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(add.mock.invocationCallOrder[0]);
    expect(add).toHaveBeenCalledWith("indexar", { documentoId: "d1" }, OPTS);
  });

  it.each(["waiting", "active", "delayed"])("job %s => não adiciona de novo", async (estado) => {
    const { q, add, remove } = fila(estado);
    expect(await enfileirarNaFila(q, "d1")).toBe("fila");
    expect(add).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
