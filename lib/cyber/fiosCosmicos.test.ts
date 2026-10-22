import { DETRITOS } from "./detritos";
import { describe, expect, it } from "vitest";
import { CIDADE, colisoresDaCidade, mundo } from "./ceu";
import { VOO } from "./voo";
import { ATRACAO, FIO, capturaDoFluxo, comecarTragada, naAtracao, passoTragada, posDaTragada, fioNaBoca, fiosCosmicos, pertoDoBuraco, pistasDeSaida, pontoDoFio, uDaViagemFio, velDoFluxo } from "./fiosCosmicos";
import { ALTURA_LOUNGE, salaEm } from "./ceu";
import { SALAO } from "./temploCosmico";

describe("as pistas cósmicas (os fluxos até os buracos negros dos cantos)", () => {
  const fios = fiosCosmicos();
  it("uma pista por sala, saindo pelo vão da muralha da sala e indo pra um CANTO diferente, longe da cidadela", () => {
    expect(fios.map((f) => f.sala)).toEqual(["lounge", "garagem", "biblioteca", "jardim"]);
    const cantos = new Set<number>();
    for (const f of fios) {
      const L = CIDADE.salas[f.sala], a = Math.atan2(L.z, L.x), b = Math.atan2(f.boca.z, f.boca.x);
      expect(Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))).toBeLessThan(0.02);
      expect(Math.hypot(f.bn.x, f.bn.z)).toBeGreaterThan(8500);   // MUITO longe da cidadela — como reais buracos negros   // MUITO longe da cidadela (o portal entre os níveis)
      const w = mundo(f.bn); expect(Math.hypot(w.x, w.z) - f.bn.r * DETRITOS.doce).toBeLessThan(VOO.raioMapa - 300);   // o ponto de CAPTURA dentro do mapa de voo: dá pra ir até lá de carro, de moto ou de mochila (dali, a tragada leva)
      cantos.add(Math.round(Math.atan2(f.bn.z, f.bn.x) * 10));
    }
    expect(cantos.size).toBe(4);
  });
  it("quase RETA até lá (o dono, out/2026: menos sinuosa) — e termina em ESPIRAL caindo no horizonte", () => {
    for (const f of fios) {
      const reta = Math.hypot(f.bn.x - f.boca.x, f.bn.z - f.boca.z);
      expect(f.comprimento).toBeGreaterThan(reta); expect(f.comprimento).toBeLessThan(reta * 1.45 + 2 * Math.PI * FIO.espiralR * FIO.voltas);   // (+ a espiral final, que cresceu com o buraco negro)
      const fim = pontoDoFio(f, 1); expect(Math.hypot(fim.x - f.bn.x, fim.y - f.bn.y, fim.z - f.bn.z)).toBeLessThan(f.bn.r * 1.2);
      // a espiral: perto do fim, a pista dá a volta no buraco negro (o ângulo em volta dele anda mais de uma volta)
      let giro = 0, ant: number | null = null;
      for (let u = 0.5; u <= 1; u += 0.002) { const p = pontoDoFio(f, u), a = Math.atan2(p.z - f.bn.z, p.x - f.bn.x); if (ant !== null) giro += Math.atan2(Math.sin(a - ant), Math.cos(a - ant)); ant = a; }
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
      expect(f.boca.y).toBeCloseTo(ALTURA_LOUNGE + 0.6 - (f.sala === "lounge" ? SALAO.desce : 0), 1);   // (a do lounge sai do SALÃO do Templo Cósmico, mais baixo)
      expect(Math.hypot(f.bn.x - L.x, f.bn.z - L.z)).toBeGreaterThan(L.r + 300);
      const fim = pontoDoFio(f, 1); expect(Math.hypot(fim.x - f.bn.x, fim.y - f.bn.y, fim.z - f.bn.z)).toBeLessThan(f.bn.r * 1.3);
      // a pista não atravessa o disco da sala (contorna por fora) depois de sair da porta
      for (let u = 0.08; u <= 1; u += 0.01) { const p = pontoDoFio(f, u); expect(Math.hypot(p.x - L.x, p.z - L.z)).toBeGreaterThan(L.r - 2); }
    }
  });
  it("o MAGNETISMO: longe o caminho é livre; a ATRACAO.raio do horizonte ele pega e traga numa espiral que fecha e acelera", () => {
    const f = fios[0]!, b = f.bn;
    expect(naAtracao(fios, pontoDoFio(f, 0.1))).toBeNull();   // perto da Zaeon, na pista: livre (o fluxo automático saiu)
    expect(naAtracao(fios, { x: b.x + b.r + ATRACAO.raio + 20, y: b.y, z: b.z })).toBeNull();
    const p = { x: b.x + b.r + ATRACAO.raio - 30, y: b.y - 200, z: b.z }; expect(naAtracao(fios, p)?.sala).toBe(f.sala);   // (chegando POR BAIXO)
    const v = comecarTragada(f, p); let t = 0, chegou = false, rAnt = v.r, vMax = 0, giro = 0, angAnt = v.ang;
    let abaixo = 0;
    while (!chegou && t < 60) { const r0 = v.r; chegou = passoTragada(v, 1 / 30).chegou; t += 1 / 30; if (t > 1.5 && v.y < b.y) abaixo++; vMax = Math.max(vMax, (r0 - v.r) * 30); expect(v.r).toBeLessThanOrEqual(rAnt + 1e-9); rAnt = v.r; giro += v.ang - angAnt; angAnt = v.ang; }
    expect(chegou).toBe(true); expect(t).toBeGreaterThan(4); expect(t).toBeLessThan(25);   // uns segundos de espiral — não um teletransporte
    expect(vMax).toBeGreaterThan(150); expect(giro).toBeGreaterThan(Math.PI);   // acelera e dá a volta
    expect(abaixo).toBe(0);   // puxa pro EIXO DE CIMA: não fica por baixo do disco
    const q = posDaTragada(v); expect(q.y - b.y).toBeGreaterThan(b.r * 0.8); expect(Math.hypot(q.x - b.x, q.z - b.z)).toBeLessThan(b.r * 0.7);   // cai pelo POLO de cima
  });
});
