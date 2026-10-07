import { describe, expect, it } from "vitest";
import { DEGRAUS, QualidadeAdaptativa } from "./qualidadeAdaptativa";

/** alimenta `seg` segundos de quadros com intervalo `ms` */
const rodar = (q: QualidadeAdaptativa, ms: number, seg: number) => { const mud: number[] = []; for (let t = 0; t < seg * 1000; t += ms) { const r = q.registrar(ms); if (r !== null) mud.push(r); } return mud; };

describe("qualidade adaptativa (a escada do CS Brasil: desce rápido, sobe devagar, trava se oscila)", () => {
  it("a escada só piora: resolução cai, aura e nebulosa vão saindo", () => {
    for (let i = 1; i < DEGRAUS.length; i++) {
      const a = DEGRAUS[i - 1]!, b = DEGRAUS[i]!;
      expect(b.dpr).toBeLessThanOrEqual(a.dpr); expect(b.nebulosa).toBeLessThanOrEqual(a.nebulosa);
      if (!a.aura) expect(b.aura).toBe(false);
    }
    expect(DEGRAUS[0]).toMatchObject({ dpr: 1, aura: true });
  });
  it("rodando liso, não mexe", () => {
    const q = new QualidadeAdaptativa(60);
    expect(rodar(q, 16.7, 30)).toEqual([]); expect(q.degrau).toBe(0);
  });
  it("quadro lento por ~3 s desce UM degrau; depois espera a carência antes de descer de novo", () => {
    const q = new QualidadeAdaptativa(60);
    expect(rodar(q, 25, 2)).toEqual([]);
    expect(rodar(q, 25, 2)).toEqual([1]);
    expect(rodar(q, 25, 3)).toEqual([]);          // carência de 4 s
    expect(rodar(q, 25, 3).length).toBe(1);      // e então desce mais um
  });
  it("sobe só depois de ~12 s folgado", () => {
    const q = new QualidadeAdaptativa(60);
    rodar(q, 30, 5); const d = q.degrau; expect(d).toBeGreaterThan(0);
    expect(rodar(q, 16.7, 10)).toEqual([]);
    expect(rodar(q, 16.7, 8)).toEqual([d - 1]);
  });
  it("se cair 2× no mesmo degrau, ele vira o piso da sessão (não fica oscilando)", () => {
    const q = new QualidadeAdaptativa(60);
    rodar(q, 30, 4); expect(q.degrau).toBe(1);
    rodar(q, 16.7, 20); expect(q.degrau).toBe(0);
    rodar(q, 30, 4); expect(q.degrau).toBe(1);   // 2ª queda pro degrau 1
    rodar(q, 16.7, 40); expect(q.degrau).toBe(1); // travou
  });
  it("ignora quadros absurdos (aba em segundo plano, pausa) e respeita o orçamento do perfil (30 fps)", () => {
    const q = new QualidadeAdaptativa(30);
    expect(q.registrar(8000)).toBeNull();
    expect(rodar(q, 33.4, 20)).toEqual([]);
    expect(rodar(q, 45, 4).length).toBe(1);
  });
  it("nunca passa do último degrau", () => {
    const q = new QualidadeAdaptativa(60); rodar(q, 80, 120);
    expect(q.degrau).toBe(DEGRAUS.length - 1);
  });
});
