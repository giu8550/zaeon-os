import { describe, expect, it } from "vitest";
import { MARCHA_FEMININA, apoioDaFase, camadaFeminina, faseDaPassada, velDaAbertura } from "./marchaFeminina";
import { CAMERA_PERTO, alternarModoCamera, faixaDaDistancia, olhoDoOmbro } from "./camera";

describe("a marcha feminina (camada por cima do andar)", () => {
  it("parado: nada muda", () => { expect(camadaFeminina(0.8, 0, 1)).toEqual({ ossos: {}, desloc: 0 }); });
  it("a pelve gira com a passada e o QUADRIL vai pro lado da perna de apoio (o lado dela sobe)", () => {
    const e = camadaFeminina(1, 1, 1).ossos, d = camadaFeminina(-1, 1, -1).ossos;
    expect(e.hips![1]).toBeCloseTo(-MARCHA_FEMININA.giroPelve, 6); expect(d.hips![1]).toBeCloseTo(MARCHA_FEMININA.giroPelve, 6);
    expect(e.hips![2]).toBeGreaterThan(0); expect(d.hips![2]).toBeLessThan(0);
    expect(camadaFeminina(0, 1, 1).desloc).toBe(0);   // o quadril NÃO se desloca (levava os pés junto: deslizava)
  });
  it("os ombros inclinam AO CONTRÁRIO da pelve; correndo, o balanço diminui", () => {
    const c = camadaFeminina(0, 1, 1).ossos; expect(Math.sign(c.spine![2] + c.chest![2])).toBe(-Math.sign(c.hips![2]));
    expect(Math.abs(camadaFeminina(0, 1.6, 1).ossos.hips![2])).toBeLessThan(Math.abs(camadaFeminina(0, 1, 1).ossos.hips![2]));
  });
  it("os PÉS não deslizam: as coxas desfazem o giro e a inclinação da pelve (só sobra o fechar pra linha do meio)", () => {
    for (const [f, a] of [[1, 1], [-1, -1], [0.4, -0.7]] as const) {
      const c = camadaFeminina(f, 1, a).ossos;
      expect(c.leftUpperLeg![1] + c.hips![1]).toBeCloseTo(0, 9); expect(c.rightUpperLeg![1] + c.hips![1]).toBeCloseTo(0, 9);
      expect(c.leftUpperLeg![2] + c.hips![2]).toBeCloseTo(-MARCHA_FEMININA.coxaFecha, 9); expect(c.rightUpperLeg![2] + c.hips![2]).toBeCloseTo(MARCHA_FEMININA.coxaFecha, 9);
    }
  });
  it("o apoio: a perna que vai pra TRÁS é a do peso", () => {
    expect(apoioDaFase(-2, 2)).toBe(1); expect(apoioDaFase(2, 2)).toBe(-1); expect(apoioDaFase(1, 0)).toBe(0);
  });
  it("o tronco e a cabeça DESFAZEM o giro da pelve (o olhar fica reto)", () => {
    const c = camadaFeminina(1, 1).ossos, tronco = c.spine![1] + c.chest![1] + c.head![1];
    expect(Math.abs(c.hips![1] + tronco)).toBeLessThan(Math.abs(c.hips![1]) * 0.1);
  });
  it("os braços balançam OPOSTOS às pernas e fecham no corpo", () => {
    const c = camadaFeminina(1, 1).ossos;
    expect(Math.sign(c.leftUpperArm![0])).toBe(-Math.sign(c.rightUpperArm![0]));
    expect(c.leftUpperArm![2]).toBeGreaterThan(0); expect(c.rightUpperArm![2]).toBeLessThan(0);
  });
  it("a fase sai de qual coxa está à frente; a velocidade, da abertura das pernas", () => {
    expect(faseDaPassada(0.4, -0.3).fase).toBe(1); expect(faseDaPassada(-0.3, 0.4).fase).toBe(-1); expect(faseDaPassada(0.1, 0.1).fase).toBe(0);
    expect(velDaAbertura(0.02)).toBe(0); expect(velDaAbertura(0.5)).toBeGreaterThan(0.8); expect(velDaAbertura(2)).toBe(1.6);
  });
});

describe("a câmera PERTO (por cima do ombro) e a tecla V", () => {
  it("V entra no perto (o padrão dele) e V de novo volta EXATAMENTE pro modo de antes", () => {
    const a = alternarModoCamera("padrao", { dist: 14, pitch: 0.3 }, {});
    expect(a.modo).toBe("perto"); expect(a.dist).toBe(CAMERA_PERTO.dist); expect(a.pitch).toBe(CAMERA_PERTO.pitch);
    const b = alternarModoCamera(a.modo, { dist: 3.1, pitch: 0.05 }, a.guardado);
    expect(b.modo).toBe("padrao"); expect(b.dist).toBe(14); expect(b.pitch).toBe(0.3);
    const c = alternarModoCamera(b.modo, { dist: 14, pitch: 0.3 }, b.guardado);
    expect(c.dist).toBe(3.1);   // e o perto lembra o ajuste da pessoa
  });
  it("a roda do mouse tem a faixa de cada modo", () => {
    expect(faixaDaDistancia("perto")).toEqual([CAMERA_PERTO.distMin, CAMERA_PERTO.distMax]); expect(faixaDaDistancia("padrao")[0]).toBe(6);
  });
  it("o olho vai pro ombro: na altura dos ombros e pro lado direito de quem olha", () => {
    const o = olhoDoOmbro({ x: 0, y: 10, z: 0 }, 0);   // câmera no +Z olhando pro −Z: a direita da tela é o +X
    expect(o.y).toBeCloseTo(10 + CAMERA_PERTO.altura, 6); expect(o.x).toBeCloseTo(CAMERA_PERTO.ombro, 6); expect(o.z).toBeCloseTo(0, 6);
  });
});
