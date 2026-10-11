import { describe, it, expect } from "vitest";
import { AGUA, aguaCheia, efeitoNaVida, gastarDashAgua, naFonte, passoAgua, podeEsforcar } from "./agua";

const rodar = (s = aguaCheia(), o = { correndo: false, turbo: false, naFonte: false }, seg = 1, t0 = 0) => { let x = s; for (let i = 0; i < seg * 10; i++) x = passoAgua(x, o, 0.1, t0 + i * 0.1); return x; };

describe("a água", () => {
  it("correr e o turbo gastam; ~20 s de sprint esvaziam e a pessoa fica seca", () => {
    const s = rodar(aguaCheia(), { correndo: true, turbo: false, naFonte: false }, 21);
    expect(s.v).toBe(0); expect(s.seco).toBe(true); expect(podeEsforcar(s)).toBe(false);
    const t = rodar(aguaCheia(), { correndo: false, turbo: true, naFonte: false }, 10);
    expect(t.v).toBeCloseTo(1 - AGUA.turbo * 10, 2);
  });
  it("parado recupera devagar; numa fonte, rápido — e sai do seco", () => {
    const seco = { v: 0, seco: true, esforcoEm: 0 };
    const devagar = rodar(seco, { correndo: false, turbo: false, naFonte: false }, 6, 0);
    expect(devagar.v).toBeLessThan(0.15); expect(devagar.seco).toBe(true);
    const fonte = rodar(seco, { correndo: false, turbo: false, naFonte: true }, 1, 0);
    expect(fonte.v).toBeGreaterThan(0.35); expect(fonte.seco).toBe(false);
  });
  it("o dash custa um gole; seco, não sai", () => {
    expect(gastarDashAgua(aguaCheia(), 0)!.v).toBeCloseTo(1 - AGUA.dash);
    expect(gastarDashAgua({ v: 0.05, seco: false, esforcoEm: 0 }, 0)).toBeNull();
  });
  it("a vida: com sede cai, hidratado volta, no meio fica", () => {
    expect(efeitoNaVida({ v: 0, seco: true, esforcoEm: 0 })).toBeLessThan(0);
    expect(efeitoNaVida({ v: 0.8, seco: false, esforcoEm: 0 })).toBeGreaterThan(0);
    expect(efeitoNaVida({ v: 0.1, seco: false, esforcoEm: 0 })).toBe(0);
  });
  it("na fonte: dentro do raio e na altura dela", () => {
    const f = [{ x: 0, z: 0, r: 10, y: 88, nome: "jardim" }];
    expect(naFonte(f, { x: 3, z: 3 }, 88)?.nome).toBe("jardim");
    expect(naFonte(f, { x: 3, z: 3 }, 0)).toBeNull();
    expect(naFonte(f, { x: 30, z: 0 }, 88)).toBeNull();
  });
});
