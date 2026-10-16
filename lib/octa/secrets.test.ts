import { describe, it, expect, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { SecretVault, MemoryVaultStore, SecretError, redact } from "./secrets";
import { emitirVirtualKey, classificarRespostaGateway, octaGatewayConfigurado, modeloReal } from "./litellm";

const KEY = randomBytes(32).toString("base64");
const VALOR = "ghp_SUPERSECRETO_123456";

async function cofre(agora = () => new Date("2026-10-15T10:00:00Z")) {
  const store = new MemoryVaultStore();
  const v = new SecretVault(store, KEY, agora);
  await v.definir("github", VALOR, { descricao: "token de deploy", escopo: ["git_push"], ttlDias: 30 });
  return { store, v };
}

describe("octa · cofre (§3)", () => {
  it("o modelo nunca recebe o valor: catálogo só tem metadados e oculto é o padrão", async () => {
    const { v } = await cofre();
    expect(await v.catalogoParaModelo()).toEqual([]); // oculto por padrão: nem o nome aparece
    await v.definirVisibilidade("github", true);
    const cat = await v.catalogoParaModelo();
    expect(cat).toEqual([{ nome: "github", descricao: "token de deploy", escopo: ["git_push"], placeholder: "{{secret:github}}" }]);
    expect(JSON.stringify(cat)).not.toContain(VALOR);
    expect(JSON.stringify(await v.listarMeta())).not.toContain(VALOR);
  });
  it("valor fica cifrado em repouso", async () => {
    const { store } = await cofre();
    expect(JSON.stringify(await store.list())).not.toContain(VALOR);
  });
  it("placeholder só resolve no executor, dentro do escopo, e a auditoria não guarda o valor", async () => {
    const { v, store } = await cofre();
    const r = await v.resolvePlaceholders("git push https://x:{{secret:github}}@host", { sessionId: "s1", acao: "git_push" });
    expect(r.texto).toBe(`git push https://x:${VALOR}@host`);
    await expect(v.resolvePlaceholders("{{secret:github}}", { sessionId: "s1", acao: "shell" })).rejects.toBeInstanceOf(SecretError);
    expect(store.log.map((e) => e.resultado)).toEqual(["resolvido", "negado"]);
    expect(JSON.stringify(store.log)).not.toContain(VALOR);
  });
  it("saída redigida antes de voltar ao modelo", async () => {
    const { v } = await cofre();
    const { valores } = await v.resolvePlaceholders("{{secret:github}}", { sessionId: "s", acao: "git_push" });
    expect(redact(`erro: auth falhou pra ${VALOR}`, valores)).toBe("erro: auth falhou pra {{secret:github}}");
  });
  it("vencido não resolve; rotação sobe a versão", async () => {
    let now = new Date("2026-10-15T10:00:00Z");
    const store = new MemoryVaultStore();
    const v = new SecretVault(store, KEY, () => now);
    await v.definir("k", "valor-1", { escopo: ["a"], ttlDias: 1 });
    now = new Date("2026-10-17T10:00:00Z");
    await expect(v.resolvePlaceholders("{{secret:k}}", { sessionId: "s", acao: "a" })).rejects.toMatchObject({ motivo: "expirado" });
    const m = await v.rotacionar("k", "valor-2", 7);
    expect(m.versao).toBe(2);
    expect((await v.resolvePlaceholders("{{secret:k}}", { sessionId: "s", acao: "a" })).texto).toBe("valor-2");
  });
  it("sem OCTA_VAULT_KEY válida o cofre nem sobe", () => {
    expect(() => new SecretVault(new MemoryVaultStore(), "curta")).toThrow(/OCTA_VAULT_KEY/);
  });
});

describe("octa · LiteLLM virtual keys (§3)", () => {
  const env = { GATEWAY_URL: "http://gw:4000/", GATEWAY_MASTER_KEY: "sk-master" } as any;
  it("sem gateway configurado recusa limpo", async () => {
    expect(octaGatewayConfigurado({} as any)).toBe(false);
    expect(await emitirVirtualKey({ userId: "u", sessionId: "s", maxBudgetUsd: 1 }, fetch, {} as any)).toMatchObject({ ok: false, code: "gateway_off" });
  });
  it("emite com budget/duração e master só no header do servidor", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ key: "sk-virtual", expires: "2026-10-15T18:00:00Z" })));
    const r = await emitirVirtualKey({ userId: "u", sessionId: "s", maxBudgetUsd: 2 }, f as any, env);
    expect(r).toMatchObject({ ok: true, vk: { key: "sk-virtual", maxBudget: 2 } });
    const [url, init] = (f.mock.calls[0] as any);
    expect(url).toBe("http://gw:4000/key/generate");
    expect(JSON.parse(init.body)).toMatchObject({ user_id: "u", max_budget: 2, duration: "8h" });
  });
  it("usa o gateway da infra e o modelo REAL do app (sem apelido)", () => {
    expect(octaGatewayConfigurado({ LITELLM_URL: "x", LITELLM_MASTER_KEY: "y" } as any)).toBe(false); // nomes antigos não valem
    expect(modeloReal("padrao", { GEMINI_MODEL: "gemini-3.5-flash" } as any)).toBe("vertex_ai/gemini-3.5-flash");
    expect(modeloReal("forte", { GEMINI_MODEL_PRO: "gemini-3.1-pro" } as any)).toBe("vertex_ai/gemini-3.1-pro");
    expect(modeloReal("forte", {} as any)).toBe("vertex_ai/gemini-2.5-pro"); // mesmo default do lib/ai/model.ts
  });
  it("budget estourado vira recusa", async () => {
    const r = await classificarRespostaGateway(new Response('{"error":"Budget has been exceeded! Current cost: 2.1"}', { status: 400 }));
    expect(r).toMatchObject({ ok: false, code: "budget_exceeded" });
  });
});
