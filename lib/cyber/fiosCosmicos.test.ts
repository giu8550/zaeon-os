import { describe, expect, it } from "vitest";
import { CIDADE, ESCADAS, colisoresDaCidade, mundo } from "./ceu";
import { FIO, fioNaBoca, fiosCosmicos, pontoDoFio } from "./fiosCosmicos";

describe("o tecido cósmico (os fios-neurônio)", () => {
  const fios = fiosCosmicos();
  it("um fio por sala, saindo da borda da Zaeon na direção dela, bem mais longo que a escada", () => {
    expect(fios.map((f) => f.sala)).toEqual(["lounge", "garagem", "biblioteca", "jardim"]);
    for (const f of fios) {
      const L = CIDADE.salas[f.sala], a = Math.atan2(L.z, L.x), b = Math.atan2(f.boca.z, f.boca.x);
      expect(Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))).toBeLessThan(0.02);
      expect(Math.hypot(f.boca.x, f.boca.z)).toBeLessThan(CIDADE.andavelR);   // a boca fica no piso andável
      expect(f.comprimento).toBeGreaterThan(ESCADAS[f.sala].len * 3);
      expect(f.bn.r).toBe(FIO.bnR);
      expect(f.ramos.length).toBe(FIO.dendritos * 3);
    }
  });
  it("a prancha: começa na boca, termina na ponta (perto do buraco negro), subindo", () => {
    for (const f of fios) {
      const a = pontoDoFio(f, 0), b = pontoDoFio(f, 1);
      expect(Math.hypot(a.x - f.boca.x, a.z - f.boca.z)).toBeLessThan(0.5);
      expect(b.y).toBeGreaterThan(FIO.subida * 0.7);
      expect(Math.hypot(b.x - f.bn.x, b.y - f.bn.y, b.z - f.bn.z)).toBeLessThan(FIO.bnR * 2);
    }
  });
  it("a boca: pisar dentro dela (no piso) pega o fio; voando por cima, não; e não está dentro de nenhum colisor", () => {
    const col = colisoresDaCidade();
    for (const f of fios) {
      expect(fioNaBoca(f.boca, 0)?.sala).toBe(f.sala);
      expect(fioNaBoca(f.boca, 5)).toBeNull();
      const w = mundo(f.boca);
      expect(col.every((c) => Math.hypot(c.x - w.x, c.z - w.z) > c.r + 0.5)).toBe(true);
    }
  });
});
