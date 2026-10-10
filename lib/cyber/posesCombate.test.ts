import { describe, expect, it } from "vitest";
import { ALERTA, pesoAlerta, poseAlerta, poseDash, poseSprint, type PoseAcao } from "./posesCombate";
import { sintetizarAlerta, sintetizarDash } from "./somMovimento";

const dirs = (p: PoseAcao) => [p.tronco, p.cabeca, ...[1, -1].flatMap((l) => [p.braco(l), p.ante(l), ...(p.coxa ? [p.coxa(l), p.canela!(l), p.pe!(l)] : [])])];

describe("poses de ação (hack and slash)", () => {
  it("todas as direções são unitárias", () => {
    for (const p of [poseSprint(0.3), poseDash(), poseAlerta(1.2)]) for (const d of dirs(p)) expect(Math.hypot(...d)).toBeCloseTo(1, 5);
  });
  it("sprint: corpo e tronco pra frente, braços esticados pra trás (as pernas são da corrida)", () => {
    const p = poseSprint(0);
    expect(p.inclina).toBeLessThan(-0.15); expect(p.tronco[0]).toBeGreaterThan(0.3);
    for (const l of [1, -1]) { expect(p.braco(l)[0]).toBeLessThan(-0.5); expect(p.ante(l)[0]).toBeLessThan(-0.8); expect(Math.sign(p.braco(l)[2])).toBe(l); }
    expect(p.coxa).toBeNull();
  });
  it("dash: investida baixa — a perna da frente vai pra frente, a de trás estica pra trás", () => {
    const p = poseDash();
    expect(p.desce).toBeGreaterThan(0.15);
    expect(p.coxa!(1)[0]).toBeGreaterThan(0.5); expect(p.coxa!(-1)[0]).toBeLessThan(-0.4); expect(p.canela!(-1)[0]).toBeLessThan(-0.7);
  });
  it("alerta: joelhos dobrados (quadril desce) e as mãos na frente do peito (antebraço pra frente e pra cima)", () => {
    const p = poseAlerta(0);
    expect(p.desce).toBeGreaterThan(0.1);
    for (const l of [1, -1]) { const a = p.ante(l); expect(a[0]).toBeGreaterThan(0.5); expect(a[1]).toBeGreaterThan(0.3); }
    // a perna da frente dobra: coxa pra frente, canela pra trás
    expect(p.coxa!(1)[0]).toBeGreaterThan(0.4); expect(p.canela!(1)[0]).toBeLessThan(-0.2);
  });
  it("a guarda entra rápido depois do dash, fica ~1,5 s e sai suave", () => {
    expect(pesoAlerta(-1)).toBe(0); expect(pesoAlerta(0.2)).toBe(1); expect(pesoAlerta(ALERTA.dura - 0.01)).toBe(1);
    expect(pesoAlerta(ALERTA.dura + ALERTA.sai / 2)).toBeCloseTo(0.5, 5); expect(pesoAlerta(ALERTA.dura + ALERTA.sai + 0.1)).toBe(0);
  });
});

describe("sons do movimento (sintetizados)", () => {
  it("dash: ~0,45 s, forte no começo, termina sem clique; alerta: curtinho e mais baixo", () => {
    const sr = 48000, d = sintetizarDash(sr), a = sintetizarAlerta(sr);
    expect(d.length).toBe(Math.round(sr * 0.45)); expect(a.length).toBe(Math.round(sr * 0.6));
    for (const x of [d, a]) { expect(x.every(Number.isFinite)).toBe(true); expect(Math.abs(x[x.length - 1]!)).toBeLessThan(1e-3); }
    const rms = (x: Float32Array, i0: number, i1: number) => Math.sqrt(x.slice(i0, i1).reduce((s, v) => s + v * v, 0) / (i1 - i0));
    expect(rms(d, 0, sr * 0.1)).toBeGreaterThan(rms(d, sr * 0.3, sr * 0.45) * 3);   // o arranque, e some
    expect(Math.max(...a.map(Math.abs))).toBeLessThanOrEqual(0.7 + 1e-6);
  });
});
