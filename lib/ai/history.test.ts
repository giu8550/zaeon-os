import { describe, it, expect } from "vitest";
import { janelaEmBlocos, sanitizeHistory } from "./history";

describe("janelaEmBlocos (cache implícito do Gemini)", () => {
  const xs = (n: number) => Array.from({ length: n }, (_, i) => i);
  it("até o teto: tudo; acima: o começo anda de 10 em 10 (fica parado entre turnos)", () => {
    expect(janelaEmBlocos(xs(20), 20)).toHaveLength(20);
    expect(janelaEmBlocos(xs(21), 20)[0]).toBe(10);
    expect(janelaEmBlocos(xs(29), 20)[0]).toBe(10);   // mesmo começo de 21 a 30 mensagens
    expect(janelaEmBlocos(xs(30), 20)[0]).toBe(10);
    expect(janelaEmBlocos(xs(31), 20)[0]).toBe(20);
    expect(janelaEmBlocos(xs(31), 20).length).toBeLessThanOrEqual(20);
  });
  it("sanitizeHistory: a janela começa numa mensagem do usuário", () => {
    const raw = Array.from({ length: 25 }, (_, i) => ({ role: i % 2 ? "model" : "user", parts: [{ text: `m${i}` }] }));
    const h = sanitizeHistory(raw);
    expect(h[0]!.role).toBe("user"); expect(h.length).toBeLessThanOrEqual(20); expect(h[h.length - 1]!.parts[0]!.text).toBe("m24");
  });
});
