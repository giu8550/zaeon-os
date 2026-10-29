import { describe, it, expect } from "vitest";
import { DESENHOS, desenhoEmSvg } from "./desenhosBlueprint";
import { ENTREGAVEIS } from "@/lib/research/roteiroVitrine";

describe("os desenhos técnicos dos entregáveis", () => {
  it("cada entregável tem um desenho (segmentos completos: 6 números cada)", () => {
    for (const e of ENTREGAVEIS) { const p = DESENHOS[e.id](); expect(p.length).toBeGreaterThan(60); expect(p.length % 6).toBe(0); }
  });
  it("vira um path de SVG dentro do quadro, um traço por segmento", () => {
    for (const e of ENTREGAVEIS) {
      const s = desenhoEmSvg(e.id, { lado: 100, margem: 8 });
      expect(s.segmentos).toBe(DESENHOS[e.id]().length / 6);
      expect((s.d.match(/M/g) ?? []).length).toBe(s.segmentos);
      const nums = s.d.split(/[ML ]/).filter(Boolean).map(Number);
      expect(nums.every((n) => Number.isFinite(n) && n >= 7.99 && n <= 92.01)).toBe(true);
    }
  });
});
