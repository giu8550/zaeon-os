import { describe, expect, it } from "vitest";
import { CORPO_MAGIA, ENERGIA, ESCUDO, FEITICOS, codificarLancamento, danoComEscudo, danoDaExplosao, decodificarLancamento, direcaoDaMira, escudoSegura, instanteDoDisparo, ladoDoGolpe, podeLancar, posDoProjetil, reacaoDoGolpe, recarregarEnergia, varreCorpo } from "./magia";

const { estilhaco: E, nova: N } = FEITICOS;

describe("os feitiços", () => {
  it("o Estilhaço é rápido e barato; a Nova é lenta, cara, forte, explode e empurra", () => {
    expect(E.vel).toBeGreaterThan(N.vel); expect(E.energia).toBeLessThan(N.energia); expect(E.recarga).toBeLessThan(N.recarga);
    expect(N.dano).toBeGreaterThan(E.dano); expect(N.explosao).toBeGreaterThan(0); expect(N.empurra).toBeGreaterThan(E.empurra);
    expect(E.tecla).toBe("q"); expect(N.tecla).toBe("e"); expect(ESCUDO.tecla).toBe("r");
  });
  it("o projétil sai no quadro do lançamento da animação (dentro dela)", () => {
    const t = instanteDoDisparo(E, 2.3); expect(t).toBeGreaterThan(0.3); expect(t).toBeLessThan(2.3 / E.velClipe);
  });
});

describe("a energia cósmica", () => {
  it("lançar pede energia e a recarga; ela volta depois do atraso, até o máximo", () => {
    expect(podeLancar(10, E, 0, 5)).toBe(false); expect(podeLancar(50, E, 6, 5)).toBe(false); expect(podeLancar(50, E, 4, 5)).toBe(true);
    expect(recarregarEnergia(10, 1, 5, 4.5)).toBe(10);   // dentro do atraso
    expect(recarregarEnergia(10, 1, 5, 3)).toBeCloseTo(10 + ENERGIA.regen, 6); expect(recarregarEnergia(99, 1, 5, 3)).toBe(ENERGIA.max);
  });
});

describe("o projétil e o acerto", () => {
  it("anda em linha reta pra onde a mira aponta e some depois do alcance", () => {
    const d = direcaoDaMira(0, 0), p = posDoProjetil(E, { x: 0, y: 1.4, z: 0 }, d, 1)!;
    expect(p.z).toBeCloseTo(E.vel, 6); expect(p.x).toBeCloseTo(0, 6); expect(posDoProjetil(E, { x: 0, y: 0, z: 0 }, d, E.alcance / E.vel + 0.1)).toBeNull();
  });
  it("a VARREDURA pega o corpo mesmo rápido (o segmento do quadro atravessa) e erra quem está do lado", () => {
    expect(varreCorpo({ x: 0, y: 1.2, z: -3 }, { x: 0, y: 1.2, z: 3 }, E.raio, { x: 0, y: 0, z: 0 })).not.toBeNull();
    expect(varreCorpo({ x: 2, y: 1.2, z: -3 }, { x: 2, y: 1.2, z: 3 }, E.raio, { x: 0, y: 0, z: 0 })).toBeNull();
    expect(varreCorpo({ x: 0, y: 3.5, z: -3 }, { x: 0, y: 3.5, z: 3 }, E.raio, { x: 0, y: 0, z: 0 })).toBeNull();   // por cima da cabeça
    expect(CORPO_MAGIA.altura).toBeGreaterThan(1.5);
  });
  it("o LADO do golpe e a reação: forte da esquerda = a original; da direita = espelhada; leve, o contrário", () => {
    const alvo = { x: 0, z: 0, rumo: 0 };   // olhando pro +Z: a esquerda dele é o +X
    expect(ladoDoGolpe(alvo, { x: 0, z: 5 })).toBe("frente"); expect(ladoDoGolpe(alvo, { x: 0, z: -5 })).toBe("tras");
    expect(ladoDoGolpe(alvo, { x: 5, z: 0 })).toBe("esquerda"); expect(ladoDoGolpe(alvo, { x: -5, z: 0 })).toBe("direita");
    expect(reacaoDoGolpe(N, "esquerda")).toEqual({ clipe: "reacaoEsq", espelhar: false }); expect(reacaoDoGolpe(N, "direita")).toEqual({ clipe: "reacaoEsq", espelhar: true });
    expect(reacaoDoGolpe(E, "direita")).toEqual({ clipe: "reacaoLeveDir", espelhar: false }); expect(reacaoDoGolpe(E, "esquerda")).toEqual({ clipe: "reacaoLeveDir", espelhar: true });
  });
  it("o ESCUDO só segura pela frente; a explosão perde força com a distância", () => {
    const alvo = { x: 0, z: 0, rumo: 0 };
    expect(escudoSegura(alvo, { x: 0, z: 6 })).toBe(true); expect(escudoSegura(alvo, { x: 0, z: -6 })).toBe(false);
    expect(danoComEscudo(32, true)).toBe(8); expect(danoComEscudo(32, false)).toBe(32);
    expect(danoDaExplosao(N, 0)).toBe(N.dano); expect(danoDaExplosao(N, N.explosao)).toBeLessThan(N.dano); expect(danoDaExplosao(N, N.explosao + 0.1)).toBe(0); expect(danoDaExplosao(E, 0)).toBe(0);
  });
});

describe("o lançamento na rede", () => {
  it("vai e volta: a sequência, o feitiço e a mira (com a precisão do pacote); cabe no uint32", () => {
    for (const [seq, f, yaw, pitch] of [[1, E, 0.3, 0.1], [2047, N, 5.9, -0.5], [999, E, Math.PI, 0.6]] as const) {
      const v = codificarLancamento(seq, f, yaw, pitch), d = decodificarLancamento(v)!;
      expect(v).toBeLessThan(2 ** 32); expect(d.seq).toBe(seq); expect(d.feitico?.id).toBe(f.id);
      expect(Math.abs(Math.atan2(Math.sin(d.yaw - yaw), Math.cos(d.yaw - yaw)))).toBeLessThan(0.01); expect(Math.abs(d.pitch - pitch)).toBeLessThan(0.01);
    }
    expect(decodificarLancamento(0)).toBeNull(); expect(decodificarLancamento(-3)).toBeNull(); expect(decodificarLancamento(1.5)).toBeNull();
  });
});

import { combateDe } from "../lounge3d/sala";
import { MOV_ESCUDO } from "./magia";
describe("a magia na rede (o caminho do Pusher)", () => {
  it("o lançamento (`mag`) e o escudo (`mov` 6) passam pela sanitização; lixo não", () => {
    const v = codificarLancamento(7, FEITICOS.nova, 1, 0);
    expect(combateDe({ mag: v, mov: MOV_ESCUDO })).toEqual({ mag: v, mov: MOV_ESCUDO });
    expect(combateDe({ mag: -1, mov: 32 })).toEqual({}); expect(combateDe({ mag: 1.5 })).toEqual({});
  });
});
