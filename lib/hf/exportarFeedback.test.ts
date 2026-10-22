import { describe, it, expect, vi } from "vitest";
import { exportarFeedback, DATASET_FEEDBACK } from "./exportarFeedback";
import { corpoDoCommit, commitArquivo } from "./datasets";

const ENV = { HF_DATASETS_TOKEN: "hf_x", HF_DATASETS_ORG: "nkcompany" };
const linha = (id: string) => ({ id, criadoEm: new Date("2026-10-22T10:00:00Z"), voto: "up", sala: "estudos", modelo: "Gemini 3.5 Flash", pergunta: "o que é mitose?", resposta: "divisão celular" });

function fakeDb(rows: any[]) {
  const marcados: string[] = [];
  return { marcados, db: { chatFeedback: {
    findMany: vi.fn(async () => rows),
    updateMany: vi.fn(async (a: any) => { marcados.push(...a.where.id.in); return { count: a.where.id.in.length }; }),
  } } };
}

describe("corpoDoCommit — NDJSON da API de commit do Hub", () => {
  it("cabeçalho + arquivo em base64", () => {
    const [h, f] = corpoDoCommit("data/a.jsonl", "{\"x\":1}\n", "msg").split("\n").map((l) => JSON.parse(l));
    expect(h).toEqual({ key: "header", value: { summary: "msg", description: "" } });
    expect(f.value.path).toBe("data/a.jsonl");
    expect(Buffer.from(f.value.content, "base64").toString()).toBe("{\"x\":1}\n");
  });
  it("commitArquivo: POST no repo de dataset com o token, devolve erro legível", async () => {
    const f = vi.fn(async () => new Response("{\"commitOid\":\"abc\"}", { status: 200 }));
    expect(await commitArquivo({ repo: "nkcompany/r", caminho: "a", conteudo: "b", mensagem: "c" }, { fetchImpl: f as any, env: ENV })).toEqual({ ok: true, commit: "abc" });
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe("https://huggingface.co/api/datasets/nkcompany/r/commit/main");
    expect(init.headers.Authorization).toBe("Bearer hf_x");
    const g = vi.fn(async () => new Response("forbidden", { status: 403 }));
    expect(await commitArquivo({ repo: "x/y", caminho: "a", conteudo: "b", mensagem: "c" }, { fetchImpl: g as any, env: ENV })).toEqual({ ok: false, status: 403, erro: "forbidden" });
  });
});

describe("exportarFeedback", () => {
  it("sobe os pendentes num JSONL datado e marca exportadoEm", async () => {
    const { db, marcados } = fakeDb([linha("f1"), linha("f2")]);
    const commit = vi.fn(async () => ({ ok: true as const }));
    const r = await exportarFeedback({ db: db as any, commit, env: ENV, agora: () => new Date("2026-10-22T13:04:05Z") });
    expect(r).toEqual({ exportados: 2, arquivo: "data/2026-10-22/130405.jsonl" });
    const arg = (commit.mock.calls[0] as any)[0];
    expect(arg.repo).toBe(`nkcompany/${DATASET_FEEDBACK}`);
    expect(arg.conteudo.trim().split("\n").map((l: string) => JSON.parse(l).id)).toEqual(["f1", "f2"]);
    expect(arg.conteudo).not.toMatch(/usuarioHash|msgId/);
    expect(marcados).toEqual(["f1", "f2"]);
  });
  it("commit falhou → nada marcado (sai de novo na próxima)", async () => {
    const { db, marcados } = fakeDb([linha("f1")]);
    const r = await exportarFeedback({ db: db as any, commit: async () => ({ ok: false, status: 500, erro: "x" }), env: ENV });
    expect(r.exportados).toBe(0); expect(r.erro).toMatch(/500/); expect(marcados).toEqual([]);
  });
  it("sem token/org, ou FEEDBACK_DATASET=0 → não toca no banco", async () => {
    for (const env of [{}, { ...ENV, FEEDBACK_DATASET: "0" }]) {
      const { db } = fakeDb([linha("f1")]);
      expect((await exportarFeedback({ db: db as any, env })).erro).toBe("desligado");
      expect(db.chatFeedback.findMany).not.toHaveBeenCalled();
    }
  });
  it("nada pendente → não faz commit", async () => {
    const { db } = fakeDb([]);
    const commit = vi.fn();
    expect(await exportarFeedback({ db: db as any, commit: commit as any, env: ENV })).toEqual({ exportados: 0 });
    expect(commit).not.toHaveBeenCalled();
  });
});
