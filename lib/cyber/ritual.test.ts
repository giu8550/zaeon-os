import { describe, expect, it } from "vitest";
import { BALADA, DESMANCHA_S, brilhoDaBalada, luzDoFlash, ENERGIZA_S, ESCADARIA_VERMELHA, FORMACAO_S, NEON, REVELACAO, RITUAL_OFF, TURBO_NAVE, corDoFlash, escuroDaBalada, fumacaDaTorre, noPerimetro, faseDaTempestade, instanteDaEnergia, intensidadeDaTempestade, passoDaEscadaria, raioNaBatida, revelacaoDaNave, ritualDesligado, sanitizarRitual, sensacaoDaNave, suavizarRitual } from "./ritual";

const T0 = 1_700_000_000_000;

describe("o ritual da chegada do dono", () => {
  it("sanitiza: lixo → desligado; o instante e a flag dos droids passam", () => {
    expect(sanitizarRitual(null)).toEqual(RITUAL_OFF); expect(sanitizarRitual("x")).toEqual(RITUAL_OFF);
    expect(sanitizarRitual({ tempestade: -5, droids: "sim" })).toEqual(RITUAL_OFF);
    expect(sanitizarRitual({ tempestade: T0 + 0.7, droids: true })).toEqual({ tempestade: T0, droids: true, veu: 0, nave: false });
    expect(sanitizarRitual({ nave: true })).toEqual({ ...RITUAL_OFF, nave: true }); expect(ritualDesligado(sanitizarRitual({ nave: true }))).toBe(false);   // o ritual DA NAVE (K) sozinho já é ritual
    expect(sanitizarRitual({ veu: T0 }).veu).toBe(T0); expect(ritualDesligado(sanitizarRitual({ veu: T0 }))).toBe(false);
    expect(ritualDesligado(sanitizarRitual({ droids: true }))).toBe(false);
    expect(ritualDesligado(RITUAL_OFF)).toBe(true);
  });
  it("a tempestade se forma em ~8 s (suave), fica armada e NUNCA acaba sozinha (só pelo botão)", () => {
    const r = { tempestade: T0, droids: false, veu: 0, nave: false };
    expect(intensidadeDaTempestade(r, T0 - 1000)).toBe(0);
    expect(intensidadeDaTempestade(r, T0)).toBe(0);
    const meio = intensidadeDaTempestade(r, T0 + (FORMACAO_S / 2) * 1000); expect(meio).toBeGreaterThan(0.4); expect(meio).toBeLessThan(0.6);
    expect(intensidadeDaTempestade(r, T0 + FORMACAO_S * 1000)).toBe(1);
    expect(intensidadeDaTempestade(r, T0 + 60_000)).toBe(1);
    expect(intensidadeDaTempestade(r, T0 + 30 * 24 * 3600 * 1000)).toBe(1);   // (um mês depois: continua)
    expect(faseDaTempestade(r, T0 + 30 * 24 * 3600 * 1000)).toBe("armada");
    expect(intensidadeDaTempestade(RITUAL_OFF, T0)).toBe(0);
    let ant = 0; for (let s = 0; s <= FORMACAO_S; s += 0.1) { const v = intensidadeDaTempestade(r, T0 + s * 1000); expect(v).toBeGreaterThanOrEqual(ant); ant = v; }
  });
  it("as fases: formando (só fumaça) → raios (com trovão) → armada (formada por inteiro)", () => {
    const r = { tempestade: T0, droids: false, veu: 0, nave: false };
    expect(faseDaTempestade(RITUAL_OFF, T0)).toBe("off");
    expect(faseDaTempestade(r, T0 + 1000)).toBe("formando");
    expect(faseDaTempestade(r, T0 + 5000)).toBe("raios");
    expect(faseDaTempestade(r, T0 + ENERGIZA_S * 1000 + 10)).toBe("armada");
    expect(instanteDaEnergia(r)).toBe(T0 + ENERGIZA_S * 1000);
    expect(ENERGIZA_S).toBeGreaterThan(FORMACAO_S);
  });
  it("desligado no botão, o ritual acaba DEVAGAR: a intensidade mostrada cai em DESMANCHA_S s (subindo, acompanha)", () => {
    expect(suavizarRitual(0.2, 0.9, 0.016)).toBe(0.9);
    let i = 1, t = 0; while (i > 0) { i = suavizarRitual(i, 0, 0.1); t += 0.1; }
    expect(t).toBeGreaterThan(DESMANCHA_S - 0.2); expect(t).toBeLessThan(DESMANCHA_S + 0.2);
    expect(DESMANCHA_S).toBeGreaterThanOrEqual(8);
  });
  it("os ANUNCIADORES: o lounge ESCURO e, na batida, as luzes ACENDEM de vez por um instante e APAGAM de novo (festa de verdade)", () => {
    expect(escuroDaBalada(0, 0)).toBe(0); expect(brilhoDaBalada(0, 1)).toBe(0);   // desligado: nada
    expect(escuroDaBalada(1, 0)).toBeCloseTo(BALADA.escuro, 9);                   // apagado: escuro
    expect(escuroDaBalada(1, 1)).toBe(0); expect(brilhoDaBalada(1, 1)).toBeCloseTo(BALADA.brilho, 9);   // o estouro: acende tudo
    expect(luzDoFlash(0)).toBe(1); expect(luzDoFlash(BALADA.segura)).toBe(1);      // segura acesa por um instante…
    expect(luzDoFlash(BALADA.segura + 0.3)).toBeLessThan(0.1); expect(luzDoFlash(-1)).toBe(0);   // …e apaga de novo
    expect(BALADA.segura).toBeLessThan(0.3);
    expect(escuroDaBalada(0.5, 0)).toBeCloseTo(BALADA.escuro / 2, 9);
    expect(new Set([0, 1, 2, 3].map(corDoFlash)).size).toBe(NEON.length); expect(corDoFlash(-1)).toBe(NEON[NEON.length - 1]);
  });
  it("os ANUNCIADORES: a escadaria vai ficando VERMELHA com a música (e a batida), com mais raios e fumaça na torre; sem música, volta", () => {
    let v = 0; for (let k = 0; k < 60; k++) v = passoDaEscadaria(v, 1, true, false);
    expect(v).toBeCloseTo(60 * ESCADARIA_VERMELHA.sobe, 6);
    expect(passoDaEscadaria(v, 0, true, true)).toBeGreaterThan(v);
    let w = v; for (let k = 0; k < 200; k++) w = passoDaEscadaria(w, 1, true, true); expect(w).toBe(1);
    let x = 1; for (let k = 0; k < 100; k++) x = passoDaEscadaria(x, 1, false, false); expect(x).toBe(0);
    expect(raioNaBatida(1)).toBeGreaterThan(raioNaBatida(0)); expect(raioNaBatida(1)).toBeLessThanOrEqual(1);
    expect(fumacaDaTorre(1)).toBe(1); expect(fumacaDaTorre(0)).toBeGreaterThan(0);
  });
  it("o turbo da nave: mais de 2× a velocidade; a sensação na tela só em turbo", () => {
    expect(TURBO_NAVE.fator).toBeGreaterThan(2);
    expect(sensacaoDaNave(30, 1)).toBe(0); expect(sensacaoDaNave(78, 0)).toBe(0);
    expect(sensacaoDaNave(78, 1)).toBeGreaterThan(0.7); expect(sensacaoDaNave(50, 1)).toBeLessThan(sensacaoDaNave(70, 1));
  });
});

describe("a nave invisível", () => {
  const r = { tempestade: T0, droids: false, veu: 0, nave: false };
  it("a nave do dono é invisível; no perímetro das nuvens (ritual ligado) o DONO escolhe tirar o véu — o evento a revela em ~1,6 s", () => {
    expect(noPerimetro(RITUAL_OFF, 10)).toBe(false); expect(noPerimetro(r, REVELACAO.perimetro + 1)).toBe(false); expect(noPerimetro(r, REVELACAO.perimetro - 1)).toBe(true);
    expect(revelacaoDaNave(RITUAL_OFF, T0)).toBe(0); expect(revelacaoDaNave(r, T0 + 60_000)).toBe(0);   // sem o evento, segue invisível
    const v = { ...r, veu: T0 + 10_000 };
    expect(revelacaoDaNave(v, T0 + 10_000)).toBe(0); expect(revelacaoDaNave(v, T0 + 10_000 + REVELACAO.veu * 1000)).toBe(1); expect(revelacaoDaNave(v, T0 + 90_000)).toBe(1);
    const meio = revelacaoDaNave(v, T0 + 10_000 + (REVELACAO.veu * 1000) / 2); expect(meio).toBeGreaterThan(0.3); expect(meio).toBeLessThan(0.7);
    expect(revelacaoDaNave({ ...v, tempestade: 0 }, T0 + 90_000)).toBe(0);   // acabou o ritual: o véu volta
  });
});
