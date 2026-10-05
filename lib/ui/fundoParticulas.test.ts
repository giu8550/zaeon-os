import { describe, it, expect } from "vitest";
import {
  QUADRO_MS,
  DURACAO_FASE,
  PARTICULAS_MIN,
  ajustarQualidade,
  alphaDaFase,
  avancarFase,
  criarDono,
  escalaPerspectiva,
  ESCALA_MAX,
  fatorLerp,
  passoNormalizado,
  perfilDoAparelho,
  type Relogio,
} from "./fundoParticulas";

/** Simula `segundos` de animação num monitor de `hz` e devolve o relógio final. */
function simular(hz: number, segundos: number): Relogio {
  let r: Relogio = { fase: 0, timer: 0 };
  const dt = 1000 / hz;
  for (let i = 0; i < Math.round(segundos * hz); i++) r = avancarFase(r, passoNormalizado(dt));
  return r;
}

describe("tempo real, não por quadro", () => {
  it("60 Hz, 144 Hz e 20 Hz chegam na MESMA fase depois do mesmo tempo", () => {
    // 15 s: passa do globo (800/60 ≈ 13,3 s) + desintegração (1 s) → serpente
    const a = simular(60, 15), b = simular(144, 15), c = simular(20, 15);
    expect(a.fase).toBe(2);
    expect(b.fase).toBe(2);
    expect(c.fase).toBe(2);
    expect(Math.abs(a.timer - b.timer)).toBeLessThan(2);
    expect(Math.abs(a.timer - c.timer)).toBeLessThan(4);
  });

  it("passo é 1 a 60 FPS, limitado a 3 (aba voltando do segundo plano não dá salto)", () => {
    expect(passoNormalizado(QUADRO_MS)).toBeCloseTo(1);
    expect(passoNormalizado(5000)).toBe(3);
    expect(passoNormalizado(0)).toBe(0);
    expect(passoNormalizado(NaN)).toBe(0);
  });

  it("lerp independe do FPS: 2 quadros de passo 1 = 1 quadro de passo 2", () => {
    const umDeDois = 1 - (1 - fatorLerp(0.08, 1)) ** 2;
    expect(fatorLerp(0.08, 2)).toBeCloseTo(umDeDois);
  });

  it("o ciclo completo volta pro globo", () => {
    let r: Relogio = { fase: 0, timer: 0 };
    const total = Object.values(DURACAO_FASE).reduce((s, d) => s + d + 1, 0);
    for (let i = 0; i < total; i++) r = avancarFase(r, 1);
    expect(r.fase).toBe(0);
  });
});

describe("sem flash (acessibilidade)", () => {
  it("desintegração apaga até zero dentro da fase; a fase seguinte acende em rampa", () => {
    expect(alphaDaFase({ fase: 1, timer: DURACAO_FASE[1] })).toBeCloseTo(0);
    expect(alphaDaFase({ fase: 5, timer: DURACAO_FASE[5] })).toBeCloseTo(0);
    expect(alphaDaFase({ fase: 2, timer: 0 })).toBe(0);
    expect(alphaDaFase({ fase: 0, timer: 0 })).toBe(0);
  });

  it("a opacidade nunca salta mais que 0,1 entre dois quadros a 60 FPS no ciclo inteiro", () => {
    let r: Relogio = { fase: 0, timer: 0 };
    let anterior = alphaDaFase(r);
    let maiorSalto = 0;
    for (let i = 0; i < 6000; i++) {
      r = avancarFase(r, 1);
      const a = alphaDaFase(r);
      maiorSalto = Math.max(maiorSalto, Math.abs(a - anterior));
      anterior = a;
    }
    expect(maiorSalto).toBeLessThanOrEqual(0.1);
  });
});

describe("aparelho fraco", () => {
  it("poucos núcleos, pouca memória ou tela pequena → menos partículas e teto de 30 FPS", () => {
    for (const s of [{ nucleos: 2, memoriaGb: 8, largura: 1920 }, { nucleos: 8, memoriaGb: 2, largura: 1920 }, { nucleos: 8, memoriaGb: 8, largura: 390 }]) {
      const p = perfilDoAparelho(s);
      expect(p.particulas).toBeLessThanOrEqual(600);
      expect(p.intervaloMinMs).toBeCloseTo(1000 / 30);
      expect(p.dprMax).toBe(1);
    }
  });

  it("máquina boa nunca passa de 1400 partículas (antes: até 5050 somando os 3 canvases)", () => {
    expect(perfilDoAparelho({ nucleos: 16, memoriaGb: 32, largura: 2560 }).particulas).toBeLessThanOrEqual(1400);
  });

  it("FPS caindo corta pela metade até o mínimo; FPS bom não mexe", () => {
    expect(ajustarQualidade(1000, 1)).toBe(1000);
    expect(ajustarQualidade(1000, 2.5)).toBe(500);
    expect(ajustarQualidade(PARTICULAS_MIN, 3)).toBe(PARTICULAS_MIN);
  });
});

describe("dono único do fundo", () => {
  it("só a primeira instância desenha; quando ela sai, a próxima assume", () => {
    const d = criarDono();
    const a = Symbol("a"), b = Symbol("b");
    let avisos = 0;
    d.ouvir(() => avisos++);
    d.entrar(a); d.entrar(b);
    expect(d.ehDono(a)).toBe(true);
    expect(d.ehDono(b)).toBe(false);
    d.sair(a);
    expect(d.ehDono(b)).toBe(true);
    expect(avisos).toBe(3);
  });
});

describe("globo sem discos gigantes", () => {
  it("em qualquer tela (raio 100–700 px), nenhuma partícula passa de ESCALA_MAX em volta inteira", () => {
    for (const raio of [100, 288, 300, 345, 460, 700]) {
      let maior = 0;
      for (let a = 0; a < Math.PI * 2; a += 0.001) maior = Math.max(maior, escalaPerspectiva(raio * Math.sin(a), raio));
      expect(maior).toBeLessThanOrEqual(ESCALA_MAX);
      expect(Number.isFinite(maior)).toBe(true);
    }
  });

  it("a fórmula antiga explodia num monitor 1080p (raio 345) — regressão documentada", () => {
    const antiga = (z: number) => Math.max(0.2, 300 / (300 - z));
    expect(antiga(299.9)).toBeGreaterThan(1000);
    expect(escalaPerspectiva(299.9, 345)).toBeLessThanOrEqual(ESCALA_MAX);
  });
});
