import { describe, it, expect } from "vitest";
import { alvoDe, poolConfigurado, ehModeloPool, MODELO_POOL, GRUPOS_POOL, TETOS_DIA } from "./pool";

describe("alvoDe", () => {
  it("header x-litellm-model-id (model_info.id) vence o corpo", () => {
    expect(alvoDe("gemini-2.5-flash-lite", "cloudflare")).toBe("cloudflare");
    expect(alvoDe("qualquer", "groq")).toBe("groq");
  });
  it("header desconhecido (hash/vertex-flash) → pelo model do corpo", () => {
    expect(alvoDe("gemini-2.5-flash", "vertex-flash")).toBe("vertex");
    expect(alvoDe("gemini-2.5-flash-lite", "a1b2c3")).toBe("gemini-free");
  });
  it("os 5 formatos pelo model do corpo", () => {
    expect(alvoDe("gemini-2.5-flash-lite")).toBe("gemini-free");
    expect(alvoDe("gemini/gemini-2.5-flash-lite")).toBe("gemini-free");
    expect(alvoDe("@cf/meta/llama-3.1-8b-instruct")).toBe("cloudflare");
    expect(alvoDe("openai/gpt-oss-20b")).toBe("groq");
    expect(alvoDe("gpt-oss-20b")).toBe("groq");
    expect(alvoDe("llama-3.1-8b-instant")).toBe("groq");
    expect(alvoDe("glm-4.7-flash")).toBe("glm");
    expect(alvoDe("gemini-2.5-flash")).toBe("vertex");
    expect(alvoDe("gemini-2.5-pro")).toBe("vertex");
  });
  it("flash-lite pelo VERTEX continua vertex (é pago)", () => {
    expect(alvoDe("vertex_ai/gemini-2.5-flash-lite")).toBe("vertex");
  });
  it("o próprio grupo (chamada que falhou) → primário do grupo", () => {
    expect(alvoDe(MODELO_POOL)).toBe("gemini-free");
    expect(alvoDe("zaeon-pool-cf")).toBe("cloudflare");
    expect(alvoDe("zaeon-pool-groq")).toBe("groq");
  });
  it("vazio/null → vertex", () => {
    expect(alvoDe(null)).toBe("vertex");
    expect(alvoDe("")).toBe("vertex");
  });
});

describe("poolConfigurado", () => {
  it("lê UMA env por provedor; vazio/espaço não conta", () => {
    expect(poolConfigurado({})).toEqual([]);
    expect(poolConfigurado({ GEMINI_FREE_API_KEY: "k", GROQ_API_KEY: "  " })).toEqual(["gemini-free"]);
    expect(poolConfigurado({ GEMINI_FREE_API_KEY: "k", CLOUDFLARE_API_KEY: "c", CLOUDFLARE_ACCOUNT_ID: "a", GROQ_API_KEY: "g" })).toEqual(["gemini-free", "cloudflare", "groq"]);
  });
  it("Cloudflare exige key E account id", () => {
    expect(poolConfigurado({ CLOUDFLARE_API_KEY: "c" })).toEqual([]);
  });
  it("GLM só com ZHIPU_API_KEY", () => {
    expect(poolConfigurado({ ZHIPU_API_KEY: "z" })).toEqual(["glm"]);
  });
});

describe("pool — constantes", () => {
  it("ehModeloPool só para zaeon-pool-*", () => {
    expect(ehModeloPool(MODELO_POOL)).toBe(true);
    expect(ehModeloPool("zaeon-pool-groq")).toBe(true);
    expect(ehModeloPool("zaeon-flash")).toBe(false);
    expect(ehModeloPool("gemini-2.5-flash-lite")).toBe(false);
    expect(ehModeloPool(undefined)).toBe(false);
  });
  it("grupos e tetos cobrem os 3 provedores ligados", () => {
    expect(GRUPOS_POOL).toEqual(["zaeon-pool-lite", "zaeon-pool-cf", "zaeon-pool-groq"]);
    expect(TETOS_DIA.groq).toEqual({ unidade: "tokens/min", teto: 8_000, renova: "min" });
    expect(TETOS_DIA["gemini-free"].renova).toBe("dia");
  });
});
