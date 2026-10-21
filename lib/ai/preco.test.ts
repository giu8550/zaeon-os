import { describe, it, expect } from "vitest";
import { custoEstimadoUsd, custoDoAlvoUsd, precoDe, USD_POR_MILHAO } from "./preco";

describe("preco", () => {
  it("cobra prompt, completion e cached cada um pelo seu preço", () => {
    const p = USD_POR_MILHAO["gemini-2.5-flash"];
    const usd = custoEstimadoUsd("gemini-2.5-flash", { promptTokens: 1_000_000, completionTokens: 0, cachedTokens: 0 });
    expect(usd).toBeCloseTo(p.prompt, 6);
    const comCache = custoEstimadoUsd("gemini-2.5-flash", { promptTokens: 200, completionTokens: 0, cachedTokens: 800 });
    const semCache = custoEstimadoUsd("gemini-2.5-flash", { promptTokens: 1000, completionTokens: 0, cachedTokens: 0 });
    expect(comCache).toBeLessThan(semCache); // cache a ~10% do prompt
  });
  it("modelo desconhecido cai no flash e avisa", () => {
    expect(precoDe("modelo-x").conhecido).toBe(false);
    expect(precoDe("gemini-2.5-flash-001").conhecido).toBe(true);
    expect(precoDe("vertex_ai/gemini-2.5-pro").conhecido).toBe(true);
    // a chave mais específica vence (flash-lite não é cobrado como flash)
    expect(precoDe("gemini-2.5-flash-lite").preco).toBe(USD_POR_MILHAO["gemini-2.5-flash-lite"]);
    expect(precoDe("gemini-2.5-flash-lite-001").preco).toBe(USD_POR_MILHAO["gemini-2.5-flash-lite"]);
  });
});

describe("preco — pool grátis (Fatia 7)", () => {
  it("modelos do pool custam 0", () => {
    const u = { promptTokens: 1_000_000, completionTokens: 1_000_000, cachedTokens: 0 };
    for (const m of ["zaeon-pool-lite", "zaeon-pool-cf", "zaeon-pool-groq", "@cf/meta/llama-3.1-8b-instruct", "openai/gpt-oss-20b", "glm-4.7-flash"]) {
      expect(custoEstimadoUsd(m, u), m).toBe(0);
      expect(precoDe(m).conhecido, m).toBe(true);
    }
  });
  it("custoDoAlvoUsd: alvo do pool = 0 mesmo com nome de modelo pago; vertex/null = tabela", () => {
    const u = { promptTokens: 1_000_000, completionTokens: 0, cachedTokens: 0 };
    expect(custoDoAlvoUsd("gemini-2.5-flash-lite", u, "gemini-free")).toBe(0);
    expect(custoDoAlvoUsd("zaeon-local-coder", u, "contabo")).toBe(0); // Contabo é nossa: custo 0 no ledger
    expect(custoDoAlvoUsd("gemini-2.5-flash-lite", u, "vertex")).toBeCloseTo(USD_POR_MILHAO["gemini-2.5-flash-lite"].prompt, 6);
    expect(custoDoAlvoUsd("gemini-2.5-flash-lite", u, null)).toBeCloseTo(USD_POR_MILHAO["gemini-2.5-flash-lite"].prompt, 6);
  });
});
