import { describe, it, expect, vi, beforeEach } from "vitest";

const publicados: any[] = [];
vi.mock("@/lib/canal/realtime", () => ({ EV_MENSAGEM: "mensagem", publicarPusher: vi.fn(async (_c: string, _e: string, p: any) => { publicados.push(p); }) }));

import { bullJobId, dispararChore, filaLigada, processarChore, reapChoresPresas } from "./chores";
import { criarChore } from "@/lib/chore/store";
import { fakeDb } from "@/lib/chore/fakeDb";
import { PoolEsgotadoError } from "@/lib/llm/envelope";

const CANAL = "64b000000000000000000001";
const destino = { canalId: CANAL, parentId: null, modo: "thread" as const };
class DelayedError extends Error {}

function deps(db = fakeDb(), gerar?: any) {
  return {
    db, env: { GATEWAY_URL: "http://g" }, agora: Date.now,
    gerar: gerar ?? vi.fn(async (req: any) => ({ texto: "resumo", usage: {}, modelo: "m", provedor: "litellm", rota: req.rota, ms: 1, alvo: "gemini-free" })),
    lerUrl: vi.fn(async (url: string) => ({ ok: true, status: 200, finalUrl: url, contentType: "text/html", texto: "pág", truncado: false, bytes: 3, lidoEm: new Date().toISOString() })),
    postar: vi.fn(async () => ({ id: "m1" })), postsHoje: vi.fn(async () => 0),
  } as any;
}
beforeEach(() => { publicados.length = 0; delete process.env.CHORES_QUEUE; });

describe("fila agent-chores", () => {
  it("jobId do banco (4 partes com ':') vira id aceito pelo BullMQ", () => {
    expect(bullJobId("chore:resumir_link:abc123abc123:2026-10-08")).toBe("chore_resumir_link_abc123abc123_2026-10-08");
    expect(bullJobId("x").includes(":")).toBe(false);
  });
  it("filaLigada exige CHORES_QUEUE=1 e REDIS_URL", () => {
    expect(filaLigada({})).toBe(false);
    expect(filaLigada({ CHORES_QUEUE: "1" })).toBe(false);
    expect(filaLigada({ CHORES_QUEUE: "1", REDIS_URL: "redis://r" })).toBe(true);
  });
  it("sem fila: autônoma (sem requesterId) → recusado; humana → inline", async () => {
    const db = fakeDb();
    const auto = await criarChore(db, { tipo: "resumir_link", agentKey: "aura", alvo: { url: "https://a.gov.br/1" }, destino, origemConteudo: "web" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await dispararChore(auto, async () => deps(db))).toBe("recusado");
    const humana = await criarChore(db, { tipo: "resumir_link", agentKey: "aura", requesterId: "64b000000000000000000009", alvo: { url: "https://a.gov.br/2" }, destino, origemConteudo: "web" });
    expect(await dispararChore(humana, async () => deps(db))).toBe("inline");
    await new Promise((r) => setTimeout(r, 20));
    expect(db.chores.find((c) => c.id === humana.id)?.status).toBe("done");
    warn.mockRestore();
  });
});

describe("processarChore (fake BullMQ)", () => {
  it("pool esgotado → delayed, moveToDelayed + DelayedError, NENHUMA mensagem no fio", async () => {
    const d = deps(fakeDb(), vi.fn(async () => { throw new PoolEsgotadoError(60_000, [], null); }));
    const row = await criarChore(d.db, { tipo: "resumir_link", agentKey: "aura", requesterId: "64b000000000000000000009", alvo: { url: "https://a.gov.br/x" }, destino, origemConteudo: "web" });
    const job = { data: { id: row.id }, moveToDelayed: vi.fn(async () => {}) };
    await expect(processarChore(row.id, d, job, "tok", DelayedError)).rejects.toBeInstanceOf(DelayedError);
    expect(job.moveToDelayed).toHaveBeenCalledTimes(1);
    expect(d.db.chores[0].status).toBe("delayed");
    expect(d.postar).not.toHaveBeenCalled(); expect(publicados).toHaveLength(0);
  });
  it("expirou (prazo vencido) com humano → expired + 1 efêmera; autônoma → silêncio", async () => {
    const velho = new Date(Date.now() - 25 * 3600_000);
    for (const [requesterId, esperadas] of [["64b000000000000000000009", 1], [null, 0]] as const) {
      publicados.length = 0;
      const d = deps(fakeDb(), vi.fn(async () => { throw new PoolEsgotadoError(60_000, [], null); }));
      const row = await criarChore(d.db, { tipo: "resumir_link", agentKey: "aura", requesterId, alvo: { url: "https://a.gov.br/x" }, destino, origemConteudo: "web", agora: velho });
      await processarChore(row.id, d, { data: { id: row.id }, moveToDelayed: vi.fn(async () => {}) }, "tok", DelayedError);
      expect(d.db.chores[0].status).toBe("expired");
      expect(publicados.filter((p) => p.efemera)).toHaveLength(esperadas);
      if (esperadas) expect(publicados[0].texto).toMatch(/gratuitos/);
    }
  });
  it("chore já concluída não roda de novo (idempotente)", async () => {
    const d = deps();
    const row = await criarChore(d.db, { tipo: "resumir_link", agentKey: "aura", requesterId: "64b000000000000000000009", alvo: { url: "https://a.gov.br/x" }, destino, origemConteudo: "web" });
    await processarChore(row.id, d, null, undefined, DelayedError);
    expect(await processarChore(row.id, d, null, undefined, DelayedError)).toBeNull();
    expect(d.postar).toHaveBeenCalledTimes(1);
  });
  it("reaper: running parado → failed; delayed/queued poupados", async () => {
    const db = fakeDb();
    const velho = new Date(Date.now() - 60 * 60_000);
    db.chores.push({ id: "a", status: "running", updatedAt: velho }, { id: "b", status: "delayed", updatedAt: velho }, { id: "c", status: "queued", updatedAt: velho });
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await reapChoresPresas(db as any)).toBe(1);
    expect(db.chores.map((c) => c.status)).toEqual(["failed", "delayed", "queued"]);
  });
});
