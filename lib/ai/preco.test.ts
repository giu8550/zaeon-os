import { describe, it, expect } from "vitest";
import { custoEstimadoUsd, precoDe, USD_POR_MILHAO } from "./preco";

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
  });
});
