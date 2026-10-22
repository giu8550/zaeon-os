import { describe, it, expect, vi, beforeEach } from "vitest";
import { gerarPapel, gerarPapelJson, papelLocalLigado, limparPensamento, chaveLocal, _emVoo, PAPEIS } from "./papeis";
import type { Deps } from "./envelope";

const ctx = { agentKey: "aura", surface: "estudos" as const };
const ENV = { GATEWAY_URL: "http://litellm:4000", GATEWAY_KEY_LOCAL: "sk-local", GATEWAY_KEY_AURA: "sk-aura" };
const resposta = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const okLocal = (content: string) => resposta(200, { model: "gpt-oss-20b", choices: [{ message: { content }, finish_reason: "stop" }], usage: { prompt_tokens: 50, completion_tokens: 5, total_tokens: 55 } }, { "x-litellm-model-id": "contabo-geral" });

function deps(over: Partial<Deps> = {}): Deps & { linhas: any[]; vertexModelos: string[] } {
  const linhas: any[] = []; const vertexModelos: string[] = [];
  return {
    vertex: async (_req: unknown, modelo: string) => { vertexModelos.push(modelo); return { texto: '{"via":"google"}', usage: { promptTokens: 1, completionTokens: 1, cachedTokens: 0, totalTokens: 2, reportado: true }, modelo }; },
    registrar: async (l: any) => { linhas.push(l); return true; },
    env: ENV, ...over, linhas, vertexModelos,
  } as any;
}
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { _emVoo.curto = 0; _emVoo.artefato = 0; vi.spyOn(console, "warn").mockImplementation(() => {}); });

describe("papelLocalLigado — flag por papel", () => {
  it("ligado por default com gateway + key; '0'/'off' desliga só aquele papel", () => {
    expect(papelLocalLigado("curto", ENV)).toBe(true);
    expect(papelLocalLigado("curto", { ...ENV, LOCAL_CURTO: "0" })).toBe(false);
    expect(papelLocalLigado("artefato", { ...ENV, LOCAL_CURTO: "0" })).toBe(true);
    expect(papelLocalLigado("artefato", { ...ENV, LOCAL_ARTEFATO: "off" })).toBe(false);
  });
  it("sem GATEWAY_URL ou sem key que enxergue zaeon-local-* → desligado (a key do agente não serve)", () => {
    expect(papelLocalLigado("curto", { GATEWAY_KEY_LOCAL: "k" })).toBe(false);
    expect(papelLocalLigado("curto", { GATEWAY_URL: "http://g", GATEWAY_KEY_AURA: "k" })).toBe(false);
    expect(chaveLocal({ GATEWAY_MASTER_KEY: "m" })).toBe("m");
    expect(chaveLocal({ GATEWAY_MASTER_KEY: "m", GATEWAY_KEY_LOCAL: "l" })).toBe("l");
  });
});

describe("gerarPapel — escolha do modelo local", () => {
  it("curto → zaeon-local-lfm2 (LFM2-8B-A1B) no gateway, key local; ledger alvo contabo", async () => {
    const f = vi.fn(async () => okLocal('{"estudavel":true}'));
    const d = deps({ fetchImpl: f as any });
    const r = await gerarPapel("curto", { system: "s", user: "pergunta", json: true, ctx }, d);
    expect(r.texto).toBe('{"estudavel":true}'); expect(r.alvo).toBe("contabo"); expect(r.fallback).toBeUndefined();
    const [url, init] = (f.mock.calls[0] as any);
    expect(url).toBe("http://litellm:4000/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-local");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("zaeon-local-lfm2"); expect(body.reasoning_effort).toBeUndefined();
    expect(body.messages.at(-1).content).toBe("pergunta");
    expect(d.vertexModelos).toEqual([]);
    await tick();
    expect(d.linhas).toHaveLength(1); expect(d.linhas[0]).toMatchObject({ alvo: "contabo", ok: true, phase: "curto" });
  });
  it("systemGoogle: o local vai sem system (só o user); o Google recebe o system", async () => {
    const f = vi.fn(async () => okLocal("ok"));
    const r = await gerarPapel("curto", { user: "oi", systemGoogle: "classifique", ctx }, deps({ fetchImpl: f as any }));
    const body = JSON.parse((f.mock.calls[0] as any)[1].body);
    expect(body.messages).toEqual([{ role: "user", content: "oi" }]);
    expect(r.texto).toBe("ok");
  });
  it("tira o <think> que o Qwen3 às vezes devolve no conteúdo", async () => {
    expect(limparPensamento("<think>hmm\nok</think>\n{\"a\":1}")).toBe('{"a":1}');
    expect(limparPensamento("<think>sem fim")).toBe("");
    expect(limparPensamento("Okay, let's see...</think>\n{\"a\":1}")).toBe('{"a":1}'); // o <think> abriu no template
    expect(limparPensamento("Okay, let's see. The user wants")).toBe("Okay, let's see. The user wants"); // sem marca: o aceita() decide
  });
});

describe("gerarPapel — fallback Google", () => {
  it("Contabo 500 → Google (modelo de verdade, rota vertex) na mesma chamada; ledger: contabo ok:false + vertex ok:true", async () => {
    const f = vi.fn(async () => resposta(500, { error: { message: "ollama down" } }));
    const d = deps({ fetchImpl: f as any });
    const r = await gerarPapel("curto", { system: "s", user: "u", ctx }, d);
    expect(r.fallback).toBe("erro"); expect(r.alvo).toBe("vertex"); expect(r.texto).toBe('{"via":"google"}');
    expect(d.vertexModelos).toEqual(PAPEIS.curto.google());
    expect(d.vertexModelos[0]).not.toMatch(/^zaeon-local-/);
    await tick();
    expect(d.linhas.map((l) => [l.alvo, l.ok])).toEqual([["contabo", false], ["vertex", true]]);
  });
  it("timeout local → Google", async () => {
    const f = vi.fn(async () => { throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }); });
    const r = await gerarPapel("curto", { user: "u", ctx }, deps({ fetchImpl: f as any }));
    expect(r.fallback).toBe("erro"); expect(r.alvo).toBe("vertex");
  });
  it("resposta vazia (ou só pensamento) → Google", async () => {
    const f = vi.fn(async () => okLocal("<think>pensando…</think>"));
    const r = await gerarPapel("curto", { user: "u", ctx }, deps({ fetchImpl: f as any }));
    expect(r.fallback).toBe("vazio"); expect(r.alvo).toBe("vertex");
  });
  it("resposta que o chamador não aceita (JSON quebrado) → Google", async () => {
    const f = vi.fn(async () => okLocal("claro! aqui vai"));
    const { valor, res } = await gerarPapelJson<{ via: string }>("curto", { user: "u", ctx }, deps({ fetchImpl: f as any }));
    expect(res.fallback).toBe("vazio"); expect(valor).toEqual({ via: "google" });
  });
  it("JSON com conversa em volta do 4B é aproveitado (não gasta Google à toa)", async () => {
    const f = vi.fn(async () => okLocal('Resposta: {"score":0.8} pronto'));
    const { valor, res } = await gerarPapelJson<{ score: number }>("curto", { user: "u", ctx }, deps({ fetchImpl: f as any }));
    expect(res.alvo).toBe("contabo"); expect(valor.score).toBe(0.8);
  });
  it("flag desligada → Google direto, ZERO fetch na Contabo", async () => {
    const f = vi.fn();
    const r = await gerarPapel("curto", { user: "u", ctx }, deps({ fetchImpl: f as any, env: { ...ENV, LOCAL_CURTO: "0" } }));
    expect(f).not.toHaveBeenCalled(); expect(r.fallback).toBe("desligado"); expect(r.alvo).toBe("vertex");
  });
  it("teto em voo: com o papel ocupado vai direto pro Google (não enfileira na CPU)", async () => {
    _emVoo.curto = PAPEIS.curto.maxEmVoo;
    const f = vi.fn();
    const r = await gerarPapel("curto", { user: "u", ctx }, deps({ fetchImpl: f as any }));
    expect(f).not.toHaveBeenCalled(); expect(r.fallback).toBe("ocupado");
  });
  it("o contador em voo volta a zero depois de erro", async () => {
    const f = vi.fn(async () => resposta(503, { error: { message: "x" } }));
    await gerarPapel("curto", { user: "u", ctx }, deps({ fetchImpl: f as any }));
    expect(_emVoo.curto).toBe(0);
  });
  it("systemGoogle só entra no fallback (o local vai só com o user)", async () => {
    const f = vi.fn(async () => resposta(500, { error: { message: "x" } }));
    const vistos: any[] = [];
    const d = deps({
      fetchImpl: f as any,
      vertex: async (req, modelo) => { vistos.push([modelo, req.system]); return { texto: "safe", usage: { promptTokens: 1, completionTokens: 1, cachedTokens: 0, totalTokens: 2, reportado: true }, modelo }; },
    });
    const r = await gerarPapel("curto", { user: "oi", systemGoogle: "SYS", ctx }, d);
    expect(r.texto).toBe("safe");
    expect(vistos).toEqual([[PAPEIS.curto.google()[0], "SYS"]]);
    expect(JSON.parse((f.mock.calls[0] as any)[1].body).messages[0].role).toBe("user");
  });
  it("Contabo E Google fora → erro sobe pra quem chamou (eles são best-effort e engolem)", async () => {
    const f = vi.fn(async () => resposta(500, { error: { message: "x" } }));
    const d = deps({ fetchImpl: f as any, vertex: async () => { throw new Error("vertex 503"); } });
    await expect(gerarPapel("curto", { user: "u", ctx }, d)).rejects.toThrow(/vertex 503/);
  });
});

describe("papel artefato (Studio em segundo plano)", () => {
  it("vai pro zaeon-local-lfm2 com 5 min de teto; LOCAL_ARTEFATO=0 manda direto pro Google", async () => {
    _emVoo.artefato = 0;
    expect(PAPEIS.artefato.modeloLocal).toBe("zaeon-local-lfm2");
    expect(PAPEIS.artefato.timeoutMs).toBe(300_000);
    const f = vi.fn(async () => okLocal('{"items":[]}'));
    const r = await gerarPapel("artefato", { user: "u", json: true, ctx }, deps({ fetchImpl: f as any }));
    expect(JSON.parse((f.mock.calls[0] as any)[1].body).model).toBe("zaeon-local-lfm2");
    expect(r.alvo).toBe("contabo");
    const g = vi.fn();
    const r2 = await gerarPapel("artefato", { user: "u", ctx }, deps({ fetchImpl: g as any, env: { ...ENV, LOCAL_ARTEFATO: "0" } }));
    expect(g).not.toHaveBeenCalled(); expect(r2.fallback).toBe("desligado");
  });
});
