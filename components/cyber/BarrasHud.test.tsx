import { describe, expect, it } from "vitest";
import { IA_MIN_MS, IA_PRONTO_MS, barraIA, enchimentoIA, juntarEstadoIA } from "./BarrasHud";

describe("a barra de IA do HUD", () => {
  it("livre → trabalhando (depois de um instante, enchendo devagar sem chegar ao fim) → pronto (cheia, por um tempo) → livre", () => {
    expect(barraIA(null, 0).modo).toBe("livre");
    expect(barraIA({ ativos: 1, desde: 1000, terminou: null }, 1000 + IA_MIN_MS - 1).modo).toBe("livre");   // (um salvamento rápido não pisca)
    const t = barraIA({ ativos: 1, desde: 1000, terminou: null }, 31_000); expect(t.modo).toBe("trabalhando"); expect(t.rotulo).toContain("0:30"); expect(t.f).toBeGreaterThan(0.3); expect(t.f).toBeLessThan(0.92);
    expect(enchimentoIA(10 * 60_000)).toBeLessThan(1);
    const p = barraIA({ ativos: 0, desde: null, terminou: { em: 50_000, durMs: 42_000 } }, 52_000); expect(p.modo).toBe("pronto"); expect(p.f).toBe(1); expect(p.rotulo).toContain("0:42");
    expect(barraIA({ ativos: 0, desde: null, terminou: { em: 50_000, durMs: 42_000 } }, 50_000 + IA_PRONTO_MS + 1).modo).toBe("livre");
    expect(barraIA({ ativos: 0, desde: null, terminou: { em: 50_000, durMs: 200 } }, 50_100).modo).toBe("livre");
  });
  it("um salvamento curto logo depois da resposta não apaga o 'pronto'", () => {
    const longo = { ativos: 0, desde: null, terminou: { em: 50_000, durMs: 30_000 } };
    const depois = juntarEstadoIA(longo, { ativos: 0, desde: null, terminou: { em: 50_300, durMs: 200 } });
    expect(depois.terminou).toEqual(longo.terminou); expect(barraIA(depois, 51_000).modo).toBe("pronto");
    expect(juntarEstadoIA(longo, { ativos: 0, desde: null, terminou: { em: 90_000, durMs: 9_000 } }).terminou!.em).toBe(90_000);
  });
});
