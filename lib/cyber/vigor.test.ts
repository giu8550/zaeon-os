import { describe, expect, it } from "vitest";
import { VIGOR, gastarDash, passoVigor, podeCorrer, vigorCheio } from "./vigor";

const rodar = (s: ReturnType<typeof vigorCheio>, correndo: boolean, seg: number, t0: number) => { let t = t0; for (let i = 0; i < seg * 30; i++) { t += 1 / 30; s = passoVigor(s, correndo, 1 / 30, t); } return { s, t }; };
describe("o VIGOR", () => {
  it("correr gasta (~9 s de sprint com a barra cheia), esvaziou = exausto; parado recupera depois do respiro", () => {
    let { s, t } = rodar(vigorCheio(), true, 4, 0); expect(s.v).toBeLessThan(0.6); expect(s.v).toBeGreaterThan(0.5); expect(podeCorrer(s)).toBe(true);
    while (!s.exausto) ({ s, t } = rodar(s, true, 1 / 30, t));
    expect(t).toBeGreaterThan(8.5); expect(t).toBeLessThan(9.6); expect(s.v).toBe(0); expect(podeCorrer(s)).toBe(false);
    const parado = rodar(s, false, 0.5, t); expect(parado.s.v).toBe(0);   // (o respiro)
    ({ s, t } = rodar(s, false, 2, t)); expect(s.exausto).toBe(false); expect(s.v).toBeGreaterThanOrEqual(VIGOR.volta);
    ({ s } = rodar(s, false, 10, t)); expect(s.v).toBe(1);
  });
  it("exausto não corre: segurando correr, recupera até um quarto e só então volta a correr", () => {
    let s = { v: 0, exausto: true, esforcoEm: 0 }; ({ s } = rodar(s, true, 1.5, 0)); expect(s.exausto).toBe(true); expect(s.v).toBeGreaterThan(0.1);
    ({ s } = rodar(s, true, 1, 1.5)); expect(s.exausto).toBe(false);
  });
  it("o DASH custa um pedaço; sem vigor, não sai", () => {
    let s: ReturnType<typeof vigorCheio> | null = vigorCheio(); let n = 0;
    while (s && n < 10) { s = gastarDash(s, n); if (s) n++; }
    expect(n).toBe(Math.floor(1 / VIGOR.dash + 1e-9));
    expect(gastarDash({ v: 0.1, exausto: false, esforcoEm: 0 }, 1)).toBeNull();
  });
});
