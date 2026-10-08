import { describe, it, expect } from "vitest";
import { alvoCanonico, criarChore, jobIdDe, rotaDaChore, urlCanonica, pular, concluir, fonteHashDe, postsHoje, ehTipoChore, TIPOS_CHORE } from "./store";
import { fakeDb } from "./fakeDb";

const destino = { canalId: "64b000000000000000000001", parentId: null, modo: "thread" as const };

describe("store — puras", () => {
  it("alvoCanonico remove utm_*/fragmento, ordena chaves e baixa o host", () => {
    const a = alvoCanonico("resumir_link", { url: "https://WWW.Saude.gov.br/a?utm_source=x&b=2&a=1#topo" });
    const b = alvoCanonico("resumir_link", { url: "https://www.saude.gov.br/a?a=1&b=2" });
    expect(a).toBe(b);
    expect(urlCanonica("https://x.gov.br/p?fbclid=1&gclid=2")).toBe("https://x.gov.br/p");
    expect(alvoCanonico("t", { campos: ["a"], url: "https://a.br/" })).toBe(alvoCanonico("t", { url: "https://a.br/", campos: ["a"] }));
  });
  it("jobIdDe: chore:<tipo>:<hash12>:<dia>[.rodada], estável", () => {
    const j = jobIdDe("resumir_link", { url: "https://a.gov.br/x" }, "2026-10-08");
    expect(j).toMatch(/^chore:resumir_link:[a-f0-9]{12}:2026-10-08$/);
    expect(jobIdDe("resumir_link", { url: "https://a.gov.br/x#y" }, "2026-10-08")).toBe(j);
    expect(jobIdDe("resumir_link", { url: "https://a.gov.br/x" }, "2026-10-08", 2)).toBe(`${j}.2`);
  });
  it("rotaDaChore × 3 origens: só web vai ao pool (§8.10)", () => {
    expect(rotaDaChore("web")).toBe("gateway");
    expect(rotaDaChore("anexo")).toBe("vertex");
    expect(rotaDaChore("canal")).toBe("vertex");
    expect(rotaDaChore("qualquer")).toBe("vertex");
  });
  it("9 tipos", () => {
    expect(TIPOS_CHORE).toHaveLength(9);
    expect(ehTipoChore("resumir_link")).toBe(true);
    expect(ehTipoChore("criar_chore")).toBe(false);
  });
});

describe("store — persistência", () => {
  it("criarChore é idempotente por jobId e FIXA destino + expiraEm (24h)", async () => {
    const db = fakeDb();
    const agora = new Date("2026-10-08T10:00:00Z");
    const input = { tipo: "resumir_link" as const, agentKey: "aura", requesterId: "64b000000000000000000009", alvo: { url: "https://a.gov.br/x" }, destino, origemConteudo: "web" as const, agora };
    const a = await criarChore(db, input);
    const b = await criarChore(db, { ...input, destino: { ...destino, canalId: "64b0000000000000000000ff" } });
    expect(b.id).toBe(a.id);
    expect(db.chores).toHaveLength(1);
    expect(a.destino).toEqual(destino);
    expect(new Date(a.expiraEm).getTime() - agora.getTime()).toBe(24 * 3600_000);
    expect(a.status).toBe("queued");
  });
  it("ids inválidos viram null (nunca string solta como ObjectId)", async () => {
    const db = fakeDb();
    const c = await criarChore(db, { tipo: "formatar_abnt", agentKey: "aura", requesterId: "nao-oid", alvo: {}, destino: { canalId: "x", parentId: "y", modo: "thread" }, origemConteudo: "canal" });
    expect(c.requesterId).toBeNull(); expect(c.destino.canalId).toBeNull(); expect(c.destino.parentId).toBeNull();
  });
  it("pular conta a checagem; concluir com cursor conta a mudança", async () => {
    const db = fakeDb();
    const c = await criarChore(db, { tipo: "checar_pagina", agentKey: "aura", alvo: { url: "https://a.gov.br/" }, destino, origemConteudo: "web" });
    await pular(db, c, "sem_mudanca", { cursor: "a".repeat(64) });
    await concluir(db, c, { texto: "x" }, { cursor: "b".repeat(64), comCursor: true });
    const cur = db.cursores.find((x) => x.fonteHash === fonteHashDe("checar_pagina", c.alvo));
    expect(cur).toMatchObject({ checagens: 2, mudancas: 1, ultimoCursor: "b".repeat(64) });
    expect(db.chores[0].status).toBe("done");
  });
  it("postsHoje conta as done do canal no dia", async () => {
    const db = fakeDb();
    const c = await criarChore(db, { tipo: "resumir_link", agentKey: "aura", alvo: { url: "https://a.gov.br/1" }, destino, origemConteudo: "web" });
    await concluir(db, c, { texto: "x" });
    expect(await postsHoje(db, destino.canalId)).toBe(1);
  });
});
