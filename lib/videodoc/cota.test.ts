import { describe, it, expect, vi } from "vitest";
import { comEsperaDeCota, ehCota429, esperaCota } from "./gerar-server";

describe("voz da Zaeon sob cota (429 do gemini-2.5-flash-tts)", () => {
  it("reconhece o 429 de cota; outros erros não", () => {
    expect(ehCota429(new Error('gemini_tts_http_429:{"error":{"code":429,"message":"Quota exceeded for aiplatform'))).toBe(true);
    expect(ehCota429(new Error("RESOURCE_EXHAUSTED"))).toBe(true);
    expect(ehCota429(new Error("gemini_tts_http_500:x"))).toBe(false);
  });
  it("espera crescente com teto de 60 s", () => {
    expect([0, 1, 2, 3, 4].map(esperaCota)).toEqual([8_000, 16_000, 32_000, 60_000, 60_000]);
  });
  it("429 → espera e tenta de novo até dar certo", async () => {
    const dormiu: number[] = [];
    let n = 0;
    const fn = vi.fn(async () => { if (n++ < 2) throw new Error("gemini_tts_http_429:quota"); return "ok"; });
    expect(await comEsperaDeCota(fn, 6, async (ms) => { dormiu.push(ms); })).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(dormiu).toEqual([8_000, 16_000]);
  });
  it("esgota as tentativas → relança o 429; erro que não é cota relança na hora", async () => {
    const sempre429 = vi.fn(async () => { throw new Error("gemini_tts_http_429:quota"); });
    await expect(comEsperaDeCota(sempre429, 3, async () => undefined)).rejects.toThrow("429");
    expect(sempre429).toHaveBeenCalledTimes(3);
    const outro = vi.fn(async () => { throw new Error("gemini_tts_http_400:bad"); });
    await expect(comEsperaDeCota(outro, 6, async () => undefined)).rejects.toThrow("400");
    expect(outro).toHaveBeenCalledTimes(1);
  });
});
