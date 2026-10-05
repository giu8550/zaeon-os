import { describe, expect, it } from "vitest";
import { SEGMENTOS, amostrarPose, duracaoClipe, envelopePouso, misturar } from "./poses";
import { JET, impactoDoPouso, somDoJato } from "./jet";

describe("poses capturadas (Quaternius UAL, CC0)", () => {
  it("os 3 clipes do pulo existem, com os 11 segmentos e direções unitárias", () => {
    expect(SEGMENTOS).toHaveLength(11);
    for (const c of ["Jump_Start", "Jump_Loop", "Jump_Land"] as const) {
      expect(duracaoClipe(c)).toBeGreaterThan(0.5);
      const p = amostrarPose(c, duracaoClipe(c) * 0.37, false);
      for (const s of SEGMENTOS) expect(Math.hypot(...p[s])).toBeCloseTo(1, 5);
    }
  });
  it("no ar as pernas apontam pra baixo; no impacto o quadril desce e o tronco inclina pra frente", () => {
    const ar = amostrarPose("Jump_Loop", 0.4, true);
    expect(ar.canelaE[1]).toBeLessThan(0); expect(ar.canelaD[1]).toBeLessThan(0); expect(ar.tronco[1]).toBeGreaterThan(0.8);
    let menor = 0, maisFrente = 0;
    for (let t = 0; t < duracaoClipe("Jump_Land"); t += 0.05) { const p = amostrarPose("Jump_Land", t, false); menor = Math.min(menor, p.quadril); maisFrente = Math.max(maisFrente, p.tronco[0]); }
    expect(menor).toBeLessThan(-0.2); expect(maisFrente).toBeGreaterThan(0.4);
  });
  it("loop repete; sem loop segura o fim", () => {
    const d = duracaoClipe("Jump_Loop");
    expect(amostrarPose("Jump_Loop", 0.3, true).coxaE[0]).toBeCloseTo(amostrarPose("Jump_Loop", 0.3 + d, true).coxaE[0], 5);
    expect(amostrarPose("Jump_Land", 99, false).quadril).toBeCloseTo(amostrarPose("Jump_Land", duracaoClipe("Jump_Land"), false).quadril, 5);
  });
  it("mistura e envelope do pouso", () => {
    expect(misturar([1, 0, 0], [0, 1, 0], 0)).toEqual([1, 0, 0]);
    expect(Math.hypot(...misturar([1, 0, 0], [0, 1, 0], 0.5))).toBeCloseTo(1, 6);
    expect(envelopePouso(0)).toBe(0); expect(envelopePouso(1)).toBe(0); expect(envelopePouso(0.3)).toBe(1);
  });
});

describe("mochila: som contínuo e impacto", () => {
  it("o jato soa enquanto se segura (mais agudo subindo), baixinho solto no ar, mudo no chão", () => {
    expect(somDoJato(false, true, 5).volume).toBe(0);
    expect(somDoJato(true, true, 0).volume).toBe(1);
    expect(somDoJato(true, true, JET.sobe).taxa).toBeGreaterThan(somDoJato(true, true, 0).taxa);
    expect(somDoJato(true, false, -5).volume).toBeLessThan(0.3);
  });
  it("impacto: pousinho ~0, queda na velocidade máxima = 1", () => {
    expect(impactoDoPouso(-1)).toBe(0); expect(impactoDoPouso(-JET.quedaMax)).toBe(1);
    expect(impactoDoPouso(-5)).toBeGreaterThan(0); expect(impactoDoPouso(-5)).toBeLessThan(1);
  });
});
