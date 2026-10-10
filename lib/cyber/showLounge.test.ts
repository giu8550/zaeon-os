import { describe, expect, it } from "vitest";
import { DURACAO_FORMA, FORMAS, MAX_TROVOES, NEVOA, SERPENTES, TENTACULOS, TURNO_S, estadoDoShow, nivelDoTurno, nomeDaForma, trovoesDoTurno, trovoesEntre } from "./showLounge";

describe("o show do lounge durante a música", () => {
  it("começa pela FLOR DA VIDA (nunca um olho), nascendo do centro, e vai passando por toda a geometria sagrada em loop", () => {
    expect(FORMAS[0]).toBe("florDaVida"); expect(FORMAS).not.toContain("olho"); expect(FORMAS.length).toBeGreaterThanOrEqual(8);
    expect(estadoDoShow(0, true).nascimento).toBe(0); expect(estadoDoShow(3, true).nascimento).toBeGreaterThan(0.3); expect(estadoDoShow(8, true).nascimento).toBe(1);
    expect(estadoDoShow(1, true).forma).toBe(0); expect(estadoDoShow(DURACAO_FORMA + 1, true).forma).toBe(1);
    expect(estadoDoShow(DURACAO_FORMA * FORMAS.length + 1, true).forma).toBe(0);   // dá a volta
    const fim = estadoDoShow(DURACAO_FORMA - 0.5, true); expect(fim.mistura).toBeGreaterThan(0.5); expect(fim.proxima).toBe(1);
    expect(estadoDoShow(5, true).mistura).toBe(0);
    expect(nomeDaForma(FORMAS.length)).toBe("florDaVida");
  });
  it("cresce em complexidade e em área ao longo da faixa; sem música, tudo recolhido", () => {
    const a = estadoDoShow(10, true), b = estadoDoShow(120, true), c = estadoDoShow(300, true);
    expect(b.complexidade).toBeGreaterThan(a.complexidade); expect(c.complexidade).toBe(1);
    expect(b.area).toBeGreaterThan(a.area); expect(c.area).toBeGreaterThan(2);
    const off = estadoDoShow(120, false); expect(off.nascimento).toBe(0); expect(off.nevoa).toBe(0); expect(off.nivel).toBe(0); expect(off.serpentes).toBe(0);
  });
  it("as serpentes saem da mandala, depois a névoa se forma, e só depois das serpentes vêm os tentáculos", () => {
    expect(SERPENTES.ini).toBeLessThan(NEVOA.ini); expect(SERPENTES.ini + SERPENTES.dur).toBeLessThanOrEqual(TENTACULOS.ini);
    expect(estadoDoShow(SERPENTES.ini - 1, true).serpentes).toBe(0); expect(estadoDoShow(SERPENTES.ini + SERPENTES.dur, true).serpentes).toBe(1);
    expect(estadoDoShow(NEVOA.ini + NEVOA.dur, true).nevoa).toBe(1); expect(estadoDoShow(TENTACULOS.ini - 1, true).tentaculos).toBe(0); expect(estadoDoShow(TENTACULOS.ini + TENTACULOS.dur, true).tentaculos).toBe(1);
    expect(NEVOA.ini + NEVOA.dur).toBeLessThanOrEqual(TURNO_S);   // a névoa já está formada quando o 1º trovão cai (1 min)
  });
  it("os trovões: nenhum no 1º minuto; nível 1, 2 e 3 por turno; no máximo 3 por turno; os 3 só caem JUNTOS no nível 3, em velocidades distintas", () => {
    expect(nivelDoTurno(30)).toBe(0); expect(nivelDoTurno(61)).toBe(1); expect(nivelDoTurno(125)).toBe(2); expect(nivelDoTurno(190)).toBe(3); expect(nivelDoTurno(900)).toBe(3);
    expect(trovoesDoTurno(0)).toEqual([]);
    for (let turno = 1; turno < 12; turno++) {
      const ts = trovoesDoTurno(turno), nivel = nivelDoTurno(turno * TURNO_S);
      expect(ts.length).toBe(Math.min(MAX_TROVOES, nivel));
      for (const t of ts) { expect(t.em).toBeGreaterThanOrEqual(0); expect(t.em).toBeLessThan(TURNO_S); }
      const vels = ts.map((t) => t.vel); expect(new Set(vels.map((v) => v.toFixed(2))).size).toBe(vels.length);   // velocidades distintas
      if (nivel === 3) { const ems = ts.map((t) => t.em).sort((a, b) => a - b); expect(ems[2]! - ems[0]!).toBeLessThan(2.5); }   // juntos
      if (nivel === 2) { const ems = ts.map((t) => t.em).sort((a, b) => a - b); expect(ems[1]! - ems[0]!).toBeGreaterThan(5); }   // espalhados
      expect(trovoesDoTurno(turno)).toEqual(ts);   // determinístico
    }
  });
  it("trovoesEntre: cada trovão cai UMA vez, no quadro certo, mesmo com fps baixo; a volta da playlist zera", () => {
    const vistos: number[] = [];
    for (let t = 0; t < 4 * TURNO_S; t += 0.37) vistos.push(...trovoesEntre(t, t + 0.37).map((x) => x.t));
    const esperados = [1, 2, 3].flatMap((turno) => trovoesDoTurno(turno).map((x) => turno * TURNO_S + x.em)).filter((t) => t < 4 * TURNO_S).sort((a, b) => a - b);
    expect(vistos.sort((a, b) => a - b).map((x) => +x.toFixed(3))).toEqual(esperados.map((x) => +x.toFixed(3)));
    expect(trovoesEntre(200, 5)).toEqual([]);   // a faixa recomeçou: o quadro não vale
  });
});
