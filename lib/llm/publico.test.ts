import { describe, it, expect, vi } from "vitest";
import { gerarTextoPublico, poolPublicoLigado } from "./publico";
import type { Deps } from "./envelope";

const ENV = { GATEWAY_URL: "http://litellm:4000", GATEWAY_KEY_AURA: "sk-aura" };
const resposta = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const okPool = (content: string, id = "gemini-free") => resposta(200, { model: "gemini/gemini-3.5-flash-lite", choices: [{ message: { content } }] }, { "x-litellm-model-id": id });
const vertexOk: Deps["vertex"] = async (_r, modelo) => ({ texto: "resumo vertex", usage: { promptTokens: 1, completionTokens: 1, cachedTokens: 0, totalTokens: 2, reportado: true }, modelo });
const o = { system: "s", prompt: "Título: X\nAbstract: Y", surface: "pesquisa" as const, phase: "resumo-artigo" };

describe("gerarTextoPublico — conteúdo público pelo pool grátis", () => {
  it("vai no zaeon-pool-lite com a key do agente aura (o gateway cai pra Cerebras/reserva sozinho)", async () => {
    const f = vi.fn(async () => okPool("resumo grátis"));
    const v = vi.fn(vertexOk!);
    const r = await gerarTextoPublico(o, { env: ENV, fetchImpl: f as any, vertex: v as any, registrar: async () => true });
    expect(r).toEqual({ texto: "resumo grátis", alvo: "gemini-free" });
    const [, init] = f.mock.calls[0] as any;
    expect(JSON.parse(init.body).model).toBe("zaeon-pool-lite");
    expect(init.headers.Authorization).toBe("Bearer sk-aura");
    expect(v).not.toHaveBeenCalled();
  });
  it("Cerebras serviu (header do gateway) → alvo cerebras", async () => {
    const r = await gerarTextoPublico(o, { env: ENV, fetchImpl: vi.fn(async () => okPool("ok", "cerebras")) as any, vertex: vertexOk, registrar: async () => true });
    expect(r.alvo).toBe("cerebras");
  });
  it("pool esgotado/fora → Vertex flash direto (o aluno nunca fica sem resumo)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = vi.fn(async () => resposta(429, { error: { message: "No deployments available" } }, { "retry-after": "60" }));
    const r = await gerarTextoPublico(o, { env: ENV, fetchImpl: f as any, vertex: vertexOk, registrar: async () => true });
    expect(r).toEqual({ texto: "resumo vertex", alvo: "vertex" });
  });
  it("POOL_PUBLICO=0, sem gateway ou sem key do aura → Vertex direto, zero fetch", async () => {
    for (const env of [{ ...ENV, POOL_PUBLICO: "0" }, { GATEWAY_KEY_AURA: "k" }, { GATEWAY_URL: "http://g" }]) {
      const f = vi.fn();
      expect(poolPublicoLigado(env)).toBe(false);
      const r = await gerarTextoPublico(o, { env, fetchImpl: f as any, vertex: vertexOk, registrar: async () => true });
      expect(r.alvo).toBe("vertex"); expect(f).not.toHaveBeenCalled();
    }
  });
});
