import { describe, expect, it } from "vitest";
import { ANUNCIADOR, CORTE, ENERGIZA_S, FORMACAO_S, FRASE_LOUVOR, MAX_MS, REVELACAO, RITUAL_OFF, TURBO_NAVE, chegou, corteDasCaixas, noPerimetro, faseDaTempestade, instanteDaEnergia, intensidadeDaTempestade, posDoAnunciador, proximaFala, revelacaoDaNave, ritualDesligado, sanitizarRitual, sensacaoDaNave } from "./ritual";

const T0 = 1_700_000_000_000;

describe("o ritual da chegada do dono", () => {
  it("sanitiza: lixo → desligado; o instante e a flag dos droids passam", () => {
    expect(sanitizarRitual(null)).toEqual(RITUAL_OFF); expect(sanitizarRitual("x")).toEqual(RITUAL_OFF);
    expect(sanitizarRitual({ tempestade: -5, droids: "sim" })).toEqual(RITUAL_OFF);
    expect(sanitizarRitual({ tempestade: T0 + 0.7, droids: true })).toEqual({ tempestade: T0, droids: true, veu: 0 });
    expect(sanitizarRitual({ veu: T0 }).veu).toBe(T0); expect(ritualDesligado(sanitizarRitual({ veu: T0 }))).toBe(false);
    expect(ritualDesligado(sanitizarRitual({ droids: true }))).toBe(false);
    expect(ritualDesligado(RITUAL_OFF)).toBe(true);
  });
  it("a tempestade se forma em ~8 s (suave), fica armada e se apaga sozinha depois do máximo", () => {
    const r = { tempestade: T0, droids: false, veu: 0 };
    expect(intensidadeDaTempestade(r, T0 - 1000)).toBe(0);
    expect(intensidadeDaTempestade(r, T0)).toBe(0);
    const meio = intensidadeDaTempestade(r, T0 + (FORMACAO_S / 2) * 1000); expect(meio).toBeGreaterThan(0.4); expect(meio).toBeLessThan(0.6);
    expect(intensidadeDaTempestade(r, T0 + FORMACAO_S * 1000)).toBe(1);
    expect(intensidadeDaTempestade(r, T0 + 60_000)).toBe(1);
    expect(intensidadeDaTempestade(r, T0 + MAX_MS + 1000)).toBe(0);
    expect(intensidadeDaTempestade(RITUAL_OFF, T0)).toBe(0);
    let ant = 0; for (let s = 0; s <= FORMACAO_S; s += 0.1) { const v = intensidadeDaTempestade(r, T0 + s * 1000); expect(v).toBeGreaterThanOrEqual(ant); ant = v; }
  });
  it("as fases: formando (só nuvens) → raios (mudos) → armada (energizou, todo raio com som)", () => {
    const r = { tempestade: T0, droids: false, veu: 0 };
    expect(faseDaTempestade(RITUAL_OFF, T0)).toBe("off");
    expect(faseDaTempestade(r, T0 + 1000)).toBe("formando");
    expect(faseDaTempestade(r, T0 + 5000)).toBe("raios");
    expect(faseDaTempestade(r, T0 + ENERGIZA_S * 1000 + 10)).toBe("armada");
    expect(instanteDaEnergia(r)).toBe(T0 + ENERGIZA_S * 1000);
    expect(ENERGIZA_S).toBeGreaterThan(FORMACAO_S);   // as caixas só são energizadas com a tempestade formada
  });
  it("os anunciadores rodeiam a pessoa (no raio, acima da cabeça, olhando pra ela) e falam de vez em quando", () => {
    const alvo = { x: 10, y: 450, z: -20 };
    for (const t of [0, 1.3, 4.2, 9]) for (const k of [0, 1, 5]) {
      const p = posDoAnunciador(k, t, alvo);
      expect(Math.hypot(p.x - alvo.x, p.z - alvo.z)).toBeCloseTo(ANUNCIADOR.raio, 6);
      expect(p.y - alvo.y).toBeGreaterThan(ANUNCIADOR.altura - 0.3); expect(p.y - alvo.y).toBeLessThan(ANUNCIADOR.altura + 0.3);
      const f = { x: Math.sin(p.rumo), z: Math.cos(p.rumo) }, d = { x: alvo.x - p.x, z: alvo.z - p.z }; expect(f.x * d.x + f.z * d.z).toBeGreaterThan(0.99 * ANUNCIADOR.raio);
    }
    // dois anunciadores no mesmo instante ficam em lados diferentes
    const a = posDoAnunciador(0, 2, alvo), b = posDoAnunciador(1, 2, alvo); expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.8);
    // as falas: sempre no futuro, dentro do intervalo, determinísticas
    const [mn, mx] = ANUNCIADOR.fala; let t = 0;
    for (let i = 0; i < 20; i++) { const p = proximaFala(3, t); expect(p - t).toBeGreaterThanOrEqual(mn - 1e-9); expect(p - t).toBeLessThanOrEqual(mx + 1e-9); expect(proximaFala(3, t)).toBe(p); t = p; }
    expect(proximaFala(1, 5)).not.toBe(proximaFala(2, 5));
    expect(FRASE_LOUVOR).toBe("Louvado seja o Senhor Jesus Cristo");
  });
  it("o turbo da nave: mais de 2× a velocidade; a sensação na tela só em turbo", () => {
    expect(TURBO_NAVE.fator).toBeGreaterThan(2);
    expect(sensacaoDaNave(30, 1)).toBe(0); expect(sensacaoDaNave(78, 0)).toBe(0);
    expect(sensacaoDaNave(78, 1)).toBeGreaterThan(0.7); expect(sensacaoDaNave(50, 1)).toBeLessThan(sensacaoDaNave(70, 1));
  });
  it("o ritual acaba quando o DONO pisa no lounge", () => {
    const r = { tempestade: T0, droids: true, veu: 0 };
    expect(chegou(true, true, r)).toBe(true); expect(chegou(false, true, r)).toBe(false); expect(chegou(true, false, r)).toBe(false); expect(chegou(true, true, RITUAL_OFF)).toBe(false);
  });
});

describe("o corte da música pelos raios e a nave invisível", () => {
  const r = { tempestade: T0, droids: false, veu: 0 };
  it("o raio cala a ESQUERDA, depois a DIREITA, depois a música do lounge para de vez (só a nave toca); desligado, nada cortado", () => {
    expect(corteDasCaixas(r, T0 + 2000)).toEqual({ esquerda: false, direita: false, total: false });
    expect(corteDasCaixas(r, T0 + CORTE.esquerda * 1000 + 10)).toEqual({ esquerda: true, direita: false, total: false });
    expect(corteDasCaixas(r, T0 + CORTE.direita * 1000 + 10)).toEqual({ esquerda: true, direita: true, total: false });
    expect(corteDasCaixas(r, T0 + CORTE.total * 1000 + 10)).toEqual({ esquerda: true, direita: true, total: true });
    expect(corteDasCaixas(RITUAL_OFF, T0 + 60_000).total).toBe(false);
    expect(CORTE.esquerda).toBeGreaterThanOrEqual(FORMACAO_S); expect(CORTE.direita).toBeGreaterThan(CORTE.esquerda); expect(CORTE.total).toBeGreaterThan(CORTE.direita);   // a tempestade já formada; um de cada vez
  });
  it("a nave do dono é invisível; no perímetro das nuvens (ritual ligado) o DONO escolhe tirar o véu — o evento a revela em ~1,6 s", () => {
    expect(noPerimetro(RITUAL_OFF, 10)).toBe(false); expect(noPerimetro(r, REVELACAO.perimetro + 1)).toBe(false); expect(noPerimetro(r, REVELACAO.perimetro - 1)).toBe(true);
    expect(revelacaoDaNave(RITUAL_OFF, T0)).toBe(0); expect(revelacaoDaNave(r, T0 + 60_000)).toBe(0);   // sem o evento, segue invisível
    const v = { ...r, veu: T0 + 10_000 };
    expect(revelacaoDaNave(v, T0 + 10_000)).toBe(0); expect(revelacaoDaNave(v, T0 + 10_000 + REVELACAO.veu * 1000)).toBe(1); expect(revelacaoDaNave(v, T0 + 90_000)).toBe(1);
    const meio = revelacaoDaNave(v, T0 + 10_000 + (REVELACAO.veu * 1000) / 2); expect(meio).toBeGreaterThan(0.3); expect(meio).toBeLessThan(0.7);
    expect(revelacaoDaNave({ ...v, tempestade: 0 }, T0 + 90_000)).toBe(0);   // acabou o ritual: o véu volta
  });
});
