import { describe, it, expect } from "vitest";
import {
  acrescentarPermissao, apagarDocumento, buscarPorHash, contarBase, criarDocumento, gravarTrechos,
  listarDocumentos, marcarErro, registrarVetores, removerPermissao, trechosSemVetor,
} from "./store";
import { fakeDb } from "./fakeDb";
import { podeVer } from "./permissao";
import type { TrechoCortado } from "./corte";

const USER = "64b000000000000000000001";
const trecho = (ordem: number): TrechoCortado => ({ ordem, texto: `texto ${ordem}`, caminho: "Livro › Cap 1", paginaIni: ordem, paginaFim: ordem });
const base = (hash: string, permissao: { turmaId?: string; donoId?: string }) => ({
  hash, titulo: "Livro", nomeArquivo: "livro.pdf", paginas: 10, markdown: "# Livro", origem: "admin", criadoPor: USER, permissao,
});

async function docComTrechos(db: ReturnType<typeof fakeDb>, hash: string, permissao: { turmaId?: string; donoId?: string }, n = 3) {
  const doc = await criarDocumento(db, base(hash, permissao));
  await gravarTrechos(db, doc.id, Array.from({ length: n }, (_, i) => trecho(i)), { turmaIds: doc.turmaIds, donoIds: doc.donoIds });
  return doc;
}

describe("store — criar e buscar", () => {
  it("criarDocumento nasce 'indexando' com a permissão; buscarPorHash acha (ou null)", async () => {
    const db = fakeDb();
    const doc = await criarDocumento(db, base("h1", { turmaId: "t1" }));
    expect(doc.status).toBe("indexando");
    expect(doc.turmaIds).toEqual(["t1"]);
    expect(doc.donoIds).toEqual([]);
    expect((await buscarPorHash(db, "h1"))?.id).toBe(doc.id);
    expect(await buscarPorHash(db, "nao-existe")).toBeNull();
  });

  it("gravarTrechos copia a permissão, devolve a contagem e grava totalTrechos no documento", async () => {
    const db = fakeDb();
    const doc = await criarDocumento(db, base("h1", { donoId: "u1" }));
    const n = await gravarTrechos(db, doc.id, [trecho(0), trecho(1)], { turmaIds: [], donoIds: ["u1"] });
    expect(n).toBe(2);
    expect((await buscarPorHash(db, "h1"))?.totalTrechos).toBe(2);
    const ts = await db.ragTrecho.findMany({ where: { documentoId: doc.id } });
    expect(ts).toHaveLength(2);
    expect(ts.every((t: any) => t.donoIds[0] === "u1")).toBe(true);
  });
});

describe("store — gravarTrechos × permissão concorrente", () => {
  it("acrescentarPermissao(t2) ANTES de gravarTrechos(perm com só t1) => todos os trechos ficam com t1 e t2", async () => {
    const db = fakeDb();
    const doc = await criarDocumento(db, base("h1", { turmaId: "t1" }));
    await acrescentarPermissao(db, doc.id, { turmaId: "t2" }); // ainda não há trechos
    await gravarTrechos(db, doc.id, [trecho(0), trecho(1)], { turmaIds: ["t1"], donoIds: [] }); // snapshot velho
    const ts = (await db.ragTrecho.findMany({ where: { documentoId: doc.id } })) as any[];
    expect(ts).toHaveLength(2);
    for (const t of ts) {
      expect(t.turmaIds).toEqual(expect.arrayContaining(["t1", "t2"]));
      expect(podeVer(t, { userId: "x", turmaIds: ["t2"] })).toBe(true);
    }
  });

  it("trechos nascem com embedding: [] explícito (o campo existe para o isEmpty casar no Mongo)", async () => {
    const db = fakeDb();
    const doc = await criarDocumento(db, base("h1", { donoId: "u1" }));
    await gravarTrechos(db, doc.id, [trecho(0)], { turmaIds: [], donoIds: ["u1"] });
    const ts = (await db.ragTrecho.findMany({ where: { documentoId: doc.id } })) as any[];
    expect(ts[0].embedding).toEqual([]);
  });
});

describe("store — permissões", () => {
  it("acrescentarPermissao 2× com a mesma turma: sem duplicata no documento e em todos os trechos", async () => {
    const db = fakeDb();
    const doc = await docComTrechos(db, "h1", { turmaId: "t1" });
    await acrescentarPermissao(db, doc.id, { turmaId: "t2" });
    await acrescentarPermissao(db, doc.id, { turmaId: "t2" });
    await acrescentarPermissao(db, doc.id, { donoId: "u9" });
    const d = await buscarPorHash(db, "h1");
    expect(d?.turmaIds).toEqual(["t1", "t2"]);
    expect(d?.donoIds).toEqual(["u9"]);
    const ts = await db.ragTrecho.findMany({ where: { documentoId: doc.id } });
    expect(ts).toHaveLength(3);
    for (const t of ts as any[]) {
      expect(t.turmaIds).toEqual(["t1", "t2"]);
      expect(t.donoIds).toEqual(["u9"]);
    }
  });

  it("doc em t1 e t2; removerPermissao(t1) => 'removida'; trechos seguem visíveis a t2 e não a quem só tem t1", async () => {
    const db = fakeDb();
    const doc = await docComTrechos(db, "h1", { turmaId: "t1" });
    await acrescentarPermissao(db, doc.id, { turmaId: "t2" });
    expect(await removerPermissao(db, doc.id, { turmaId: "t1" })).toBe("removida");
    const ts = (await db.ragTrecho.findMany({ where: { documentoId: doc.id } })) as any[];
    expect(ts).toHaveLength(3);
    for (const t of ts) {
      expect(podeVer(t, { userId: "x", turmaIds: ["t2"] })).toBe(true);
      expect(podeVer(t, { userId: "x", turmaIds: ["t1"] })).toBe(false);
    }
    expect((await buscarPorHash(db, "h1"))?.turmaIds).toEqual(["t2"]);
  });

  it("removendo a última permissão => 'documento_apagado' e os trechos somem", async () => {
    const db = fakeDb();
    const doc = await docComTrechos(db, "h1", { turmaId: "t1" });
    expect(await removerPermissao(db, doc.id, { turmaId: "t1" })).toBe("documento_apagado");
    expect(await db.ragTrecho.findMany({ where: { documentoId: doc.id } })).toEqual([]);
    expect(await buscarPorHash(db, "h1")).toBeNull();
  });

  it("id vazio em acrescentar/removerPermissao (e na criação) lança", async () => {
    const db = fakeDb();
    const doc = await docComTrechos(db, "h1", { turmaId: "t1" });
    await expect(acrescentarPermissao(db, doc.id, { turmaId: "" })).rejects.toThrow();
    await expect(acrescentarPermissao(db, doc.id, { donoId: "" })).rejects.toThrow();
    await expect(removerPermissao(db, doc.id, { turmaId: "" })).rejects.toThrow();
    await expect(removerPermissao(db, doc.id, { donoId: "" })).rejects.toThrow();
    await expect(criarDocumento(db, base("h2", { turmaId: "" }))).rejects.toThrow();
    expect((await buscarPorHash(db, "h1"))?.turmaIds).toEqual(["t1"]); // nada mudou
  });

  it("apagarDocumento apaga o documento e todos os trechos (e só os dele)", async () => {
    const db = fakeDb();
    const a = await docComTrechos(db, "ha", { turmaId: "t1" });
    const b = await docComTrechos(db, "hb", { turmaId: "t1" });
    await apagarDocumento(db, a.id);
    expect(await buscarPorHash(db, "ha")).toBeNull();
    expect(await db.ragTrecho.findMany({ where: { documentoId: a.id } })).toEqual([]);
    expect(await db.ragTrecho.findMany({ where: { documentoId: b.id } })).toHaveLength(3);
  });
});

describe("store — vetores e status", () => {
  it("registrarVetores cobrindo todos => 'pronto'; cobrindo metade => continua 'indexando'", async () => {
    const db = fakeDb();
    const doc = await docComTrechos(db, "h1", { turmaId: "t1" }, 4);
    const ts = (await db.ragTrecho.findMany({ where: { documentoId: doc.id } })) as any[];

    await registrarVetores(db, doc.id, ts.slice(0, 2).map((t) => ({ trechoId: t.id, embedding: [0.1, 0.2] })));
    let d = await buscarPorHash(db, "h1");
    expect(d?.comVetor).toBe(2);
    expect(d?.status).toBe("indexando");

    await registrarVetores(db, doc.id, ts.slice(2).map((t) => ({ trechoId: t.id, embedding: [0.3, 0.4] })));
    d = await buscarPorHash(db, "h1");
    expect(d?.comVetor).toBe(4);
    expect(d?.status).toBe("pronto");
  });

  it("trechosSemVetor devolve só os pendentes, em ordem, respeitando o limite", async () => {
    const db = fakeDb();
    const doc = await docComTrechos(db, "h1", { turmaId: "t1" }, 4);
    const ts = (await db.ragTrecho.findMany({ where: { documentoId: doc.id } })) as any[];
    await registrarVetores(db, doc.id, [{ trechoId: ts[0].id, embedding: [1] }]);
    const pend = await trechosSemVetor(db, doc.id, 2);
    expect(pend.map((p) => p.texto)).toEqual(["texto 1", "texto 2"]);
    expect(Object.keys(pend[0]).sort()).toEqual(["id", "texto"]);
  });

  it("marcarErro grava status 'erro' e a mensagem", async () => {
    const db = fakeDb();
    const doc = await docComTrechos(db, "h1", { turmaId: "t1" });
    await marcarErro(db, doc.id, "embedder caiu");
    const d = await buscarPorHash(db, "h1");
    expect(d?.status).toBe("erro");
    expect(d?.erro).toBe("embedder caiu");
  });
});

describe("store — listar e contar", () => {
  it("listarDocumentos filtra por turma/dono e não devolve o markdown", async () => {
    const db = fakeDb();
    await docComTrechos(db, "h1", { turmaId: "t1" });
    await docComTrechos(db, "h2", { turmaId: "t2" });
    await docComTrechos(db, "h3", { donoId: "u1" });
    const t1 = await listarDocumentos(db, { turmaId: "t1" });
    expect(t1.map((d) => d.hash)).toEqual(["h1"]);
    expect("markdown" in t1[0]).toBe(false);
    expect((await listarDocumentos(db, { donoId: "u1" })).map((d) => d.hash)).toEqual(["h3"]);
    expect(await listarDocumentos(db, {})).toHaveLength(3);
  });

  it("contarBase conta separado pessoais e de turma", async () => {
    const db = fakeDb();
    await docComTrechos(db, "h1", { turmaId: "t1" });
    await docComTrechos(db, "h2", { turmaId: "t1" });
    await docComTrechos(db, "h3", { turmaId: "t9" });
    await docComTrechos(db, "h4", { donoId: "u1" });
    await docComTrechos(db, "h5", { donoId: "u2" });
    expect(await contarBase(db, { userId: "u1", turmaIds: ["t1"] })).toEqual({ pessoais: 1, deTurma: 2 });
    expect(await contarBase(db, { userId: "u1", turmaIds: [] })).toEqual({ pessoais: 1, deTurma: 0 });
  });
});
