import { describe, it, expect, vi } from "vitest";
import type { Block } from "@/lib/scholar/types";
import { fakeDb } from "./fakeDb";
import { ingerirPdf, MAX_BYTES, type IngerirDeps } from "./ingerir";
import { buscarPorHash, criarDocumento } from "./store";

const blocos: Block[] = [
  { type: "heading", level: 1, page: 1, text: "Cap 1" },
  { type: "paragraph", page: 1, text: "texto do capítulo um" },
  { type: "heading", level: 1, page: 3, text: "Cap 2" },
  { type: "paragraph", page: 3, text: "texto do capítulo dois" },
];
const pdf = (s = "pdf-a") => new TextEncoder().encode(s);

function setup(extrairRet: any = { paragraphs: [], blocks: blocos, markdown: "# Cap 1\n\ntexto" }) {
  const db = fakeDb();
  const extrair = vi.fn(async () => extrairRet);
  const enfileirar = vi.fn(async (_id: string) => "fila" as const);
  const deps: IngerirDeps = { db, extrair: extrair as any, enfileirar };
  return { db, extrair, enfileirar, deps };
}
const entrada = (turmaId: string, bytes = pdf(), extra: object = {}) => ({
  bytes, nomeArquivo: "Apostila.pdf", origem: "admin" as const, criadoPor: "u1", permissao: { turmaId }, ...extra,
});

describe("ingerirPdf", () => {
  it("PDF novo => novo, trechos > 0, enfileira 1x com o id", async () => {
    const { deps, enfileirar, db } = setup();
    const r = await ingerirPdf(deps, entrada("t1"));
    expect(r.status).toBe("novo");
    expect(r.trechos).toBeGreaterThan(0);
    expect(r.paginas).toBe(3);
    expect(enfileirar).toHaveBeenCalledTimes(1);
    expect(enfileirar).toHaveBeenCalledWith(r.documentoId);
    expect(db.documentos[0].titulo).toBe("Apostila");
    expect(db.documentos[0].markdown).toBe("# Cap 1\n\ntexto");
    expect(db.trechos.length).toBe(r.trechos);
  });

  it("título explícito vence o nome do arquivo", async () => {
    const { deps, db } = setup();
    await ingerirPdf(deps, entrada("t1", pdf(), { titulo: "Meu título" }));
    expect(db.documentos[0].titulo).toBe("Meu título");
  });

  it("mesmos bytes, outra turma => reaproveitado, sem reextrair/enfileirar, trechos com as duas turmas", async () => {
    const { deps, extrair, enfileirar, db } = setup();
    const a = await ingerirPdf(deps, entrada("t1"));
    const b = await ingerirPdf(deps, entrada("t2"));
    expect(b.status).toBe("reaproveitado");
    expect(b.documentoId).toBe(a.documentoId);
    expect(extrair).toHaveBeenCalledTimes(1);
    expect(enfileirar).toHaveBeenCalledTimes(1);
    expect(db.documentos).toHaveLength(1);
    expect(db.documentos[0].turmaIds.sort()).toEqual(["t1", "t2"]);
    for (const t of db.trechos) expect([...t.turmaIds].sort()).toEqual(["t1", "t2"]);
    expect(b.trechos).toBe(a.trechos);
  });

  it("extrair devolve vazio => erro sem_texto, 0 trechos, não enfileira", async () => {
    const { deps, enfileirar, db } = setup({ paragraphs: [], blocks: [] });
    const r = await ingerirPdf(deps, entrada("t1"));
    expect(r.status).toBe("erro");
    expect(r.erro).toBe("sem_texto");
    expect(r.trechos).toBe(0);
    expect(enfileirar).not.toHaveBeenCalled();
    expect(db.trechos).toHaveLength(0);
    expect(db.documentos[0].status).toBe("erro");
    expect(db.documentos[0].erro).toBe("sem_texto");
  });

  it("extrair devolve null => sem_texto", async () => {
    const { deps } = setup(null);
    const r = await ingerirPdf(deps, entrada("t1"));
    expect(r).toMatchObject({ status: "erro", erro: "sem_texto", trechos: 0 });
  });

  it("extrair lança => leitura_falhou (documento marcado erro, não enfileira)", async () => {
    const { deps, enfileirar, db } = setup();
    (deps as any).extrair = vi.fn(async () => { throw new Error("boom"); });
    const r = await ingerirPdf(deps, entrada("t1"));
    expect(r).toMatchObject({ status: "erro", erro: "leitura_falhou", trechos: 0 });
    expect(enfileirar).not.toHaveBeenCalled();
    expect(db.documentos[0].status).toBe("erro");
  });

  it("26 MB => grande_demais, db intocado, não extrai", async () => {
    const { deps, extrair, enfileirar, db } = setup();
    const r = await ingerirPdf(deps, entrada("t1", new Uint8Array(MAX_BYTES + 1)));
    expect(r).toMatchObject({ status: "erro", erro: "grande_demais", trechos: 0 });
    expect(extrair).not.toHaveBeenCalled();
    expect(enfileirar).not.toHaveBeenCalled();
    expect(db.documentos).toHaveLength(0);
    expect(db.trechos).toHaveLength(0);
  });

  it("documento existente em status erro com o mesmo hash => apaga e reprocessa como novo", async () => {
    const { deps, extrair, enfileirar, db } = setup();
    const ruim = await ingerirPdf({ ...deps, extrair: (async () => null) as any }, entrada("t1"));
    expect(ruim.status).toBe("erro");
    const r = await ingerirPdf(deps, entrada("t1"));
    expect(r.status).toBe("novo");
    expect(extrair).toHaveBeenCalledTimes(1);
    expect(enfileirar).toHaveBeenCalledTimes(1);
    expect(db.documentos).toHaveLength(1);
    expect(db.documentos.find((d) => d.id === ruim.documentoId)).toBeUndefined();
    expect(db.documentos[0].status).toBe("indexando");
  });

  it("corrida: criar bate no hash único (P2002) => reaproveita o documento do vencedor", async () => {
    const { deps, db, enfileirar } = setup();
    const orig = db.ragDocumento.findUnique.bind(db.ragDocumento);
    let primeira = true;
    // 1ª busca por hash não vê nada (o concorrente ainda não tinha gravado); depois ele grava.
    db.ragDocumento.findUnique = (async (a: any) => {
      if ("hash" in a.where && primeira) {
        primeira = false;
        const { createHash } = await import("node:crypto");
        const hash = createHash("sha256").update(pdf()).digest("hex");
        await criarDocumento(db, { hash, titulo: "x", nomeArquivo: "x.pdf", paginas: 1, markdown: "", origem: "admin", criadoPor: "u9", permissao: { turmaId: "t9" } });
        return null;
      }
      return orig(a);
    }) as any;
    const r = await ingerirPdf(deps, entrada("t1"));
    expect(r.status).toBe("reaproveitado");
    expect(db.documentos).toHaveLength(1);
    expect(db.documentos[0].turmaIds.sort()).toEqual(["t1", "t9"]);
    expect(enfileirar).not.toHaveBeenCalled();
    expect(await buscarPorHash(db, db.documentos[0].hash)).not.toBeNull();
  });
});
