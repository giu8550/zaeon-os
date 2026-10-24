import { describe, it, expect, vi, beforeEach } from "vitest";
import { gerar, gerarJsonStreamRes, lerStreamComPrazos, vertexEngasgado, _zerarDisjuntorVertex, type RespostaBruta } from "./envelope";
import { prazoPrimeiraPalavra } from "@/lib/agent/aura-harness";
import { USAGE_VAZIO } from "./usage";

const ctx = { agentKey: "aura", surface: "estudos" as const };
const env = { HF_TOKEN: "hf_teste" } as Record<string, string | undefined>;
const bruta = (texto: string): RespostaBruta => ({ texto, usage: USAGE_VAZIO, modelo: "gemini-3.5-flash" });
const hfOk = () => vi.fn(async () => new Response(JSON.stringify({ model: "openai/gpt-oss-120b", choices: [{ message: { content: '{"nucleo":"pela reserva"}' } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200 }));
const timeout = () => { throw new Error("Gemini timeout (30000ms)"); };
const registrar = vi.fn().mockResolvedValue(undefined);
beforeEach(() => _zerarDisjuntorVertex());

describe("stream falhou → reserva DIRETO (medido: antes chamava o Vertex de novo, ~31 s)", () => {
  it("timeout no stream: a reserva responde e o Vertex NÃO é chamado de novo", async () => {
    const vertex = vi.fn(async () => bruta('{"nucleo":"vertex"}'));
    const { valor, res } = await gerarJsonStreamRes<{ nucleo: string }>({ system: "s", user: "u", ctx }, () => {}, {
      env, registrar, vertex, fetchImpl: hfOk() as any, vertexStream: async () => timeout(),
    });
    expect(vertex).not.toHaveBeenCalled();
    expect(valor.nucleo).toBe("pela reserva"); expect(res.provedor).toBe("huggingface");
  });
  it("reserva desligada: cai no Vertex sem stream, como antes", async () => {
    const vertex = vi.fn(async () => bruta('{"nucleo":"vertex"}'));
    const { valor } = await gerarJsonStreamRes<{ nucleo: string }>({ system: "s", user: "u", ctx }, () => {}, { env: {}, registrar, vertex, vertexStream: async () => timeout() });
    expect(vertex).toHaveBeenCalledTimes(1); expect(valor.nucleo).toBe("vertex");
  });
});

describe("disjuntor do Vertex", () => {
  it("3 falhas em 60 s → os próximos vão direto pra reserva; passada a pausa, o Vertex volta", async () => {
    let t = 1_000_000;
    const vertex = vi.fn(async (): Promise<RespostaBruta> => timeout());
    const fetchImpl = hfOk();
    for (let i = 0; i < 3; i++) await gerar({ user: "u", ctx }, { env, registrar, vertex, fetchImpl: fetchImpl as any, agora: () => t });
    expect(vertex).toHaveBeenCalledTimes(3); expect(vertexEngasgado(t)).toBe(true);
    const r = await gerar({ user: "u", ctx }, { env, registrar, vertex, fetchImpl: fetchImpl as any, agora: () => t });
    expect(vertex).toHaveBeenCalledTimes(3); expect(r.provedor).toBe("huggingface");   // nem tentou o Vertex
    t += 31_000;
    vertex.mockImplementation(async () => bruta("ok"));
    const r2 = await gerar({ user: "u", ctx }, { env, registrar, vertex, fetchImpl: fetchImpl as any, agora: () => t });
    expect(r2.provedor).toBe("vertex");
  });
  it("erro que não é de engasgo (auth) não conta", async () => {
    const vertex = vi.fn(async () => { throw Object.assign(new Error("permission denied"), { status: 403 }); });
    for (let i = 0; i < 4; i++) await gerar({ user: "u", ctx }, { env: {}, registrar, vertex }).catch(() => undefined);
    expect(vertexEngasgado()).toBe(false);
  });
});

describe("lerStreamComPrazos — prazo até o 1º pedaço", () => {
  const pedaço = (text: string, thought = false) => ({ candidates: [{ content: { parts: [{ text, thought }] } }] });
  const streamDe = (passos: [number, any][]) => async () => ({ stream: (async function* () { for (const [ms, ch] of passos) { await new Promise((r) => setTimeout(r, ms)); yield ch; } })() });
  it("sem texto no prazo → timeout rápido (o pensamento não conta como 1º pedaço)", async () => {
    const t0 = Date.now();
    await expect(lerStreamComPrazos(streamDe([[20, pedaço("pensando…", true)], [400, pedaço("{}")]]), () => {}, 80, 5_000)).rejects.toThrow(/timeout/);
    expect(Date.now() - t0).toBeLessThan(300);
  });
  it("1º pedaço dentro do prazo: segue até o fim mesmo passando do prazo do 1º", async () => {
    const vistos: string[] = [];
    const { acc } = await lerStreamComPrazos(streamDe([[10, pedaço('{"a"')], [150, pedaço(":1}")]]), (a) => vistos.push(a), 80, 5_000);
    expect(acc).toBe('{"a":1}'); expect(vistos).toHaveLength(2);
  });
});

describe("prazoPrimeiraPalavra", () => {
  it("rápido 5 s · completo 12 s · trabalho 20 s · env manda", () => {
    expect(prazoPrimeiraPalavra({ mode: "quick", intent: "conversa" }, {})).toBe(5_000);
    expect(prazoPrimeiraPalavra({ mode: "elaborated", intent: "explicar_conceito" }, {})).toBe(12_000);
    expect(prazoPrimeiraPalavra({ mode: "research", intent: "criar_trabalho" }, {})).toBe(20_000);
    expect(prazoPrimeiraPalavra({ mode: "quick", intent: "x" }, { PRAZO_1A_PALAVRA_RAPIDO_MS: "3000" })).toBe(3_000);
  });
});
