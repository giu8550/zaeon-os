import { describe, expect, it } from "vitest";
import { LOOPS_CARRO, SINTESE_CARRO, mixDoCarro, sonsDaCabine } from "./somCarro";

describe("som do carro voador", () => {
  it("cada som sintetiza com a duração certa, sem estourar (pico ≤ 1) e sem NaN", () => {
    const sr = 8000;
    for (const [nome, f] of Object.entries(SINTESE_CARRO)) {
      const x = f(sr); let pico = 0;
      for (const v of x) { expect(Number.isFinite(v)).toBe(true); pico = Math.max(pico, Math.abs(v)); }
      expect(x.length, nome).toBeGreaterThan(sr * 0.3); expect(pico, nome).toBeLessThanOrEqual(1); expect(pico, nome).toBeGreaterThan(0.3);
    }
  });
  it("desligado não soa; a turbina sobe de volume e de tom com a potência e a velocidade; o vento só andando", () => {
    const off = mixDoCarro({ ligado: 0, vel: 30, potencia: 1 });
    for (const l of LOOPS_CARRO) expect(off[l].vol).toBe(0);
    const parado = mixDoCarro({ ligado: 1, vel: 0, potencia: 0 }), indo = mixDoCarro({ ligado: 1, vel: 40, potencia: 1 });
    expect(indo["carro-turbina"].vol).toBeGreaterThan(parado["carro-turbina"].vol);
    expect(indo["carro-turbina"].taxa).toBeGreaterThan(parado["carro-turbina"].taxa);
    expect(parado["carro-ar"].vol).toBe(0); expect(indo["carro-ar"].vol).toBeGreaterThan(0.4);
  });
  it("o CANTO: acelerando o tom sobe, freando desce; o giro acelera com a velocidade", () => {
    const base = { ligado: 1, vel: 20, potencia: 0.5 };
    expect(mixDoCarro({ ...base, acel: 1 })["carro-tom"].taxa).toBeGreaterThan(mixDoCarro({ ...base, acel: -1 })["carro-tom"].taxa);
    expect(mixDoCarro({ ...base, vel: 40 })["carro-giro"].taxa).toBeGreaterThan(mixDoCarro({ ...base, vel: 5 })["carro-giro"].taxa);
  });
  it("a cabine: abrindo, a porta do motorista, os vidros e a porta do passageiro, na ordem; fechando, as travas", () => {
    expect(sonsDaCabine(0, 0.1, 2)).toEqual(["carro-porta"]);
    expect(sonsDaCabine(0.1, 0.5, 2)).toEqual(["carro-vidro", "carro-vidro"]);
    expect(sonsDaCabine(0.5, 1, 2)).toEqual(["carro-porta"]);
    expect(sonsDaCabine(1, 0.5, 2)).toEqual(["carro-fecha", "carro-vidro", "carro-vidro"]);
    expect(sonsDaCabine(0.5, 0, 2)).toContain("carro-fecha");
    expect(sonsDaCabine(0.3, 0.3, 2)).toEqual([]);
  });
});
