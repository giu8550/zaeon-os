import { describe, it, expect } from "vitest";
import {
  usageDoVertex, usageDoOpenAI, USAGE_VAZIO, classificarErroLlm, reenfileiravel, declaravel, CLASSES_ERRO,
  LITELLM_SEM_DEPLOYMENTS, lerRateLimit, duracaoMs, nomeEnvDaChave, chaveDoAgente, gatewayLigado,
} from "./usage";

describe("usageDoVertex", () => {
  it("desconta o cache do prompt e as 3 colunas fecham com o total do provedor", () => {
    const u = usageDoVertex({ promptTokenCount: 1000, candidatesTokenCount: 150, cachedContentTokenCount: 800, totalTokenCount: 1150 });
    expect(u).toEqual({ promptTokens: 200, completionTokens: 150, cachedTokens: 800, totalTokens: 1150, reportado: true });
    expect(u.promptTokens + u.cachedTokens + u.completionTokens).toBe(u.totalTokens);
  });
  it("sem cache: prompt inteiro conta como não-cacheado", () => {
    expect(usageDoVertex({ promptTokenCount: 300, candidatesTokenCount: 20, totalTokenCount: 320 })).toMatchObject({ promptTokens: 300, cachedTokens: 0, totalTokens: 320 });
  });
  it("sem bloco de usage → zeros com reportado:false (nunca inventa)", () => {
    expect(usageDoVertex(undefined)).toEqual(USAGE_VAZIO);
    expect(usageDoVertex({})).toEqual(USAGE_VAZIO);
    expect(usageDoVertex({ foo: 1 })).toEqual(USAGE_VAZIO);
  });
  it("valores inválidos viram 0; cache nunca excede o prompt", () => {
    expect(usageDoVertex({ promptTokenCount: -5, candidatesTokenCount: "x", cachedContentTokenCount: 900, totalTokenCount: NaN })).toEqual({ promptTokens: 0, completionTokens: 0, cachedTokens: 0, totalTokens: 0, reportado: true });
  });
  it("sem totalTokenCount, total = prompt + completion", () => {
    expect(usageDoVertex({ promptTokenCount: 10, candidatesTokenCount: 5 }).totalTokens).toBe(15);
  });
});

describe("usageDoOpenAI", () => {
  it("normaliza o formato OpenAI-compatible com cached_tokens em details", () => {
    expect(usageDoOpenAI({ prompt_tokens: 500, completion_tokens: 40, total_tokens: 540, prompt_tokens_details: { cached_tokens: 300 } }))
      .toEqual({ promptTokens: 200, completionTokens: 40, cachedTokens: 300, totalTokens: 540, reportado: true });
  });
  it("sem details → cached 0", () => {
    expect(usageDoOpenAI({ prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 })).toMatchObject({ promptTokens: 12, cachedTokens: 0, reportado: true });
  });
  it("sem usage → reportado:false (o provedor é cego — e isso fica visível)", () => {
    expect(usageDoOpenAI(null)).toEqual(USAGE_VAZIO);
    expect(usageDoOpenAI({}).reportado).toBe(false);
  });
  it("total ausente é derivado", () => {
    expect(usageDoOpenAI({ prompt_tokens: 7, completion_tokens: 8 }).totalTokens).toBe(15);
  });
});

describe("classificarErroLlm", () => {
  const casos: [string, unknown, string][] = [
    ["401 → auth", { status: 401, message: "Unauthorized" }, "auth"],
    ["mensagem de key inválida sem status → auth", new Error("Invalid API Key provided"), "auth"],
    ["403 → auth", { status: 403, message: "forbidden" }, "auth"],
    ["402 → credito", { status: 402, message: "payment required" }, "credito"],
    ["insufficient_quota → credito", { status: 429, error: { type: "insufficient_quota", message: "You exceeded your current quota, please check your plan and billing details" } }, "credito"],
    ["429 simples → rate_limit", { status: 429, message: "Too Many Requests" }, "rate_limit"],
    ["RESOURCE_EXHAUSTED (Vertex) → rate_limit", new Error("429 RESOURCE_EXHAUSTED: Quota exceeded for quota metric 'Generate Content API requests per minute'"), "rate_limit"],
    ["429 por dia → cota_esgotada", { status: 429, message: "Quota exceeded for metric: generate_content_free_tier_requests per day" }, "cota_esgotada"],
    ["Cloudflare 4006 → cota_esgotada", { status: 429, body: '{"errors":[{"code":4006,"message":"You have used up your daily free allocation of 10,000 neurons"}]}' }, "cota_esgotada"],
    ["budget da virtual key → teto", { status: 400, message: "Budget has been exceeded! Current cost: 0.51, Max budget: 0.50" }, "teto"],
    ["ExceededBudget → teto", new Error("litellm.BudgetExceededError: ExceededBudget"), "teto"],
    ["404 → modelo_inexistente", { status: 404, message: "The model `foo` does not exist" }, "modelo_inexistente"],
    ["model_not_found sem status → modelo_inexistente", { error: { code: "model_not_found", message: "Model not found" } }, "modelo_inexistente"],
    ["AbortError → timeout", Object.assign(new Error("The operation was aborted"), { name: "AbortError" }), "timeout"],
    ["ETIMEDOUT → timeout", { code: "ETIMEDOUT", message: "connect ETIMEDOUT" }, "timeout"],
    ["503 → provedor_fora", { status: 503, message: "Service Unavailable" }, "provedor_fora"],
    ["ECONNREFUSED → provedor_fora", { cause: { code: "ECONNREFUSED" }, message: "fetch failed" }, "provedor_fora"],
    ["corpo HTML → resposta_nao_json", new Error("Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"), "resposta_nao_json"],
    ["desconhecido → outro", new Error("something odd"), "outro"],
    ["null → outro", null, "outro"],
  ];
  for (const [nome, e, esperado] of casos) it(nome, () => expect(classificarErroLlm(e)).toBe(esperado));

  it("mensagem LITERAL do LiteLLM → pool_esgotado (se o LiteLLM mudar o texto, este teste avisa)", () => {
    expect(LITELLM_SEM_DEPLOYMENTS).toBe("No deployments available for selected model");
    expect(classificarErroLlm({ status: 429, message: `litellm.RateLimitError: ${LITELLM_SEM_DEPLOYMENTS}, Try again in 60 seconds. Passed model=zaeon-pool-lite` })).toBe("pool_esgotado");
    expect(classificarErroLlm({ status: 429, body: JSON.stringify({ error: { message: "All fallbacks failed", type: "RouterRateLimitError" } }) })).toBe("pool_esgotado");
  });
  it("cobre as 11 classes declaradas", () => {
    expect(CLASSES_ERRO).toHaveLength(11);
    expect(new Set(CLASSES_ERRO).size).toBe(11);
  });
});

describe("reenfileiravel × declaravel", () => {
  it("transitório vai pra fila; teto/cota o agente declara; auth/credito não são recado pro aluno", () => {
    expect(["rate_limit", "timeout", "provedor_fora", "pool_esgotado"].every((c) => reenfileiravel(c as any))).toBe(true);
    expect(["teto", "cota_esgotada"].every((c) => declaravel(c as any))).toBe(true);
    for (const c of ["auth", "credito", "modelo_inexistente", "resposta_nao_json", "outro"] as const) {
      expect(reenfileiravel(c)).toBe(false); expect(declaravel(c)).toBe(false);
    }
  });
  it("nenhuma classe é reenfileirável E declarável ao mesmo tempo", () => {
    for (const c of CLASSES_ERRO) expect(reenfileiravel(c) && declaravel(c)).toBe(false);
  });
});

describe("lerRateLimit", () => {
  it("Groq: lê remaining/reset/retry-after dos headers", () => {
    const hs = new Headers({ "x-ratelimit-remaining-requests": "14399", "x-ratelimit-remaining-tokens": "5821", "x-ratelimit-reset-requests": "2m59.56s", "x-ratelimit-reset-tokens": "7.66s", "retry-after": "30" });
    expect(lerRateLimit(hs)).toEqual({ remainingRequests: 14399, remainingTokens: 5821, resetRequestsMs: 179560, resetTokensMs: 7660, retryAfterMs: 30000 });
  });
  it("provedor que não expõe nada → null (não sabemos ≠ acabou)", () => {
    expect(lerRateLimit(new Headers({ "content-type": "application/json" }))).toBeNull();
    expect(lerRateLimit(null)).toBeNull();
  });
  it("aceita objeto plano e preenche só o que veio", () => {
    expect(lerRateLimit({ "X-RateLimit-Remaining-Requests": "0" })).toEqual({ remainingRequests: 0, remainingTokens: null, resetRequestsMs: null, resetTokensMs: null, retryAfterMs: null });
  });
  it("duracaoMs entende s, ms, m, h e segundos crus", () => {
    expect(duracaoMs("1500ms")).toBe(1500); expect(duracaoMs("1h2m3s")).toBe(3723000); expect(duracaoMs("abc")).toBeNull(); expect(duracaoMs("")).toBeNull();
  });
});

describe("C6: chaveDoAgente / nomeEnvDaChave", () => {
  it("normaliza o nome da env", () => {
    expect(nomeEnvDaChave("eng-computacao")).toBe("GATEWAY_KEY_ENG_COMPUTACAO");
    expect(nomeEnvDaChave(" aura ")).toBe("GATEWAY_KEY_AURA");
    expect(nomeEnvDaChave("med.icina/2")).toBe("GATEWAY_KEY_MED_ICINA_2");
  });
  it("precedência agente > default > null", () => {
    const env = { GATEWAY_KEY_AURA: "sk-aura", GATEWAY_KEY_DEFAULT: "sk-def" };
    expect(chaveDoAgente("aura", env)).toBe("sk-aura");
    expect(chaveDoAgente("medicina", env)).toBe("sk-def");
    expect(chaveDoAgente("medicina", {})).toBeNull();
  });
  it("chave vazia ou só espaço cai para o default", () => {
    expect(chaveDoAgente("aura", { GATEWAY_KEY_AURA: "   ", GATEWAY_KEY_DEFAULT: "sk-def" })).toBe("sk-def");
    expect(chaveDoAgente("aura", { GATEWAY_KEY_AURA: "" })).toBeNull();
  });
  it("gatewayLigado só com GATEWAY_URL preenchido", () => {
    expect(gatewayLigado({})).toBe(false); expect(gatewayLigado({ GATEWAY_URL: " " })).toBe(false); expect(gatewayLigado({ GATEWAY_URL: "http://litellm:4000" })).toBe(true);
  });
});
