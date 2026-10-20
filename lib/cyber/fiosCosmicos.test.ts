import { describe, expect, it } from "vitest";
import { CIDADE, colisoresDaCidade, mundo } from "./ceu";
import { VOO } from "./voo";
import { FIO, capturaDoFluxo, fioNaBoca, fiosCosmicos, pertoDoBuraco, pistasDeSaida, pontoDoFio, uDaViagemFio, velDoFluxo } from "./fiosCosmicos";
import { ALTURA_LOUNGE, salaEm } from "./ceu";

describe("as pistas cósmicas (os fluxos até os buracos negros dos cantos)", () => {
  const fios = fiosCosmicos();
  it("uma pista por sala, saindo pelo vão da muralha da sala e indo pra um CANTO diferente, longe da cidadela", () => {
    expect(fios.map((f) => f.sala)).toEqual(["lounge", "garagem", "biblioteca", "jardim"]);
    const cantos = new Set<number>();
    for (const f of fios) {
      const L = CIDADE.salas[f.sala], a = Math.atan2(L.z, L.x), b = Math.atan2(f.boca.z, f.boca.x);
      expect(Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))).toBeLessThan(0.02);
      expect(Math.hypot(f.bn.x, f.bn.z)).toBeGreaterThan(7000);   // MUITO longe da cidadela (o portal entre os níveis)
      const w = mundo(f.bn); expect(Math.hypot(w.x, w.z) - FIO.espiralR).toBeGreaterThan(VOO.raioMapa * 3);   // bem além do mapa de voo: só o fluxo chega
      cantos.add(Math.round(Math.atan2(f.bn.z, f.bn.x) * 10));
    }
    expect(cantos.size).toBe(4);
  });
  it("longa e sinuosa: bem mais longa que a reta até o buraco negro, e termina em ESPIRAL caindo no horizonte", () => {
    for (const f of fios) {
      const reta = Math.hypot(f.bn.x - f.boca.x, f.bn.z - f.boca.z);
      expect(f.comprimento).toBeGreaterThan(reta * 1.4);
      const fim = pontoDoFio(f, 1); expect(Math.hypot(fim.x - f.bn.x, fim.y - f.bn.y, fim.z - f.bn.z)).toBeLessThan(f.bn.r * 1.2);
      // a espiral: perto do fim, a pista dá a volta no buraco negro (o ângulo em volta dele anda mais de uma volta)
      let giro = 0, ant: number | null = null;
      for (let u = 0.8; u <= 1; u += 0.002) { const p = pontoDoFio(f, u), a = Math.atan2(p.z - f.bn.z, p.x - f.bn.x); if (ant !== null) giro += Math.atan2(Math.sin(a - ant), Math.cos(a - ant)); ant = a; }
      expect(Math.abs(giro)).toBeGreaterThan(Math.PI * 1.5);
    }
  });
  it("a viagem pelo fluxo: começa na boca, vai sempre pra frente e acaba no buraco negro; o efeito cresce chegando", () => {
    let ant = -1; for (let k = 0; k <= 1; k += 0.01) { const u = uDaViagemFio(k); expect(u).toBeGreaterThanOrEqual(ant); ant = u; }
    expect(uDaViagemFio(0)).toBe(0); expect(uDaViagemFio(1)).toBeCloseTo(1, 6);
    const f = fios[0]!; expect(pertoDoBuraco(f, pontoDoFio(f, 0))).toBe(0); expect(pertoDoBuraco(f, pontoDoFio(f, 1))).toBeGreaterThan(0.9);
  });
  it("a boca: pisar dentro (no piso) pega a pista; voando por cima, não; fora de qualquer colisor", () => {
    const col = colisoresDaCidade();
    for (const f of fios) {
      expect(fioNaBoca(f.boca, 0)?.sala).toBe(f.sala); expect(fioNaBoca(f.boca, 5)).toBeNull();
      const w = mundo(f.boca); expect(col.every((c) => Math.hypot(c.x - w.x, c.z - w.z) > c.r + 0.5)).toBe(true);
    }
  });
  it("o FLUXO pega quem chega perto da pista (a pé na borda, de mochila, de carro) — longe, não; e acelera no fim", () => {
    const f = fios[0]!, a = pontoDoFio(f, 0.3);
    expect(capturaDoFluxo(fios, { x: a.x + 3, y: a.y + 2, z: a.z })?.f.sala).toBe(f.sala);
    expect(capturaDoFluxo(fios, { x: a.x + 40, y: a.y, z: a.z })).toBeNull();
    const naBorda = capturaDoFluxo(fios, { x: f.boca.x, y: 0.9, z: f.boca.z }); expect(naBorda?.u).toBeLessThan(0.02);
    expect(velDoFluxo(1)).toBeGreaterThan(velDoFluxo(0) * 3);
  });
  it("cada SALA tem a pista de SAÍDA dela: começa dentro dela (na porta antiga) e vai pra fora até um buraco negro", () => {
    for (const f of pistasDeSaida()) {
      const L = CIDADE.salas[f.sala];
      expect(salaEm({ x: f.boca.x, z: f.boca.z }, 0, true)).toBe(f.sala);
      expect(f.boca.y).toBeCloseTo(ALTURA_LOUNGE + 0.6, 1);
      expect(Math.hypot(f.bn.x - L.x, f.bn.z - L.z)).toBeGreaterThan(L.r + 300);
      const fim = pontoDoFio(f, 1); expect(Math.hypot(fim.x - f.bn.x, fim.y - f.bn.y, fim.z - f.bn.z)).toBeLessThan(f.bn.r * 1.3);
      // a pista não atravessa o disco da sala (contorna por fora) depois de sair da porta
      for (let u = 0.08; u <= 1; u += 0.01) { const p = pontoDoFio(f, u); expect(Math.hypot(p.x - L.x, p.z - L.z)).toBeGreaterThan(L.r - 2); }
    }
  });
});
