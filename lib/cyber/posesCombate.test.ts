import { describe, expect, it } from "vitest";
import { ALERTA, HEROI, bracosDaDecolagem, pesoAlerta, pesoHeroi, poseAlerta, poseDash, poseHeroi, poseSprint, type PoseAcao } from "./posesCombate";
import { sintetizarAlerta, sintetizarDash, sintetizarDecola, sintetizarImpactoHeroi } from "./somMovimento";

const dirs = (p: PoseAcao) => [p.tronco, p.cabeca, ...[1, -1].flatMap((l) => [p.braco(l), p.ante(l), ...(p.coxa ? [p.coxa(l), p.canela!(l), p.pe!(l)] : [])])];

describe("poses de ação (hack and slash)", () => {
  it("todas as direções são unitárias", () => {
    for (const p of [poseSprint(0.3), poseDash(), poseDash(1), poseAlerta(1.2, 0.3), poseHeroi()]) for (const d of dirs(p)) expect(Math.hypot(...d)).toBeCloseTo(1, 5);
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
  it("alerta (postura de poder, perigo): tronco curvado, braços BEM abertos e DOBRADOS, base larga", () => {
    const p = poseAlerta(0, 0);
    expect(p.desce).toBeGreaterThan(0.18); expect(p.tronco[0]).toBeGreaterThan(0.3);
    for (const l of [1, -1]) {
      expect(p.braco(l)[2] * l).toBeGreaterThan(0.75); expect(p.braco(l)[1]).toBeLessThan(-0.3);   // abertos
      const b = p.braco(l), a = p.ante(l), cot = Math.acos(b[0] * a[0] + b[1] * a[1] + b[2] * a[2]);
      expect(cot).toBeGreaterThan(0.9); expect(a[0]).toBeGreaterThan(0.6);   // DOBRADOS: o antebraço vem pra frente
    }
    expect(p.coxa!(1)[2]).toBeGreaterThan(0.5); expect(p.coxa!(-1)[2]).toBeLessThan(-0.5);
  });
  it("os braços sobem e descem com a respiração (inspirando, abertos mais alto)", () => {
    const alturaBraco = (t: number) => poseAlerta(t, 0).braco(1)[1];
    let a = Infinity, b = -Infinity; for (let t = 0; t < 1; t += 0.01) { a = Math.min(a, alturaBraco(t)); b = Math.max(b, alturaBraco(t)); }
    expect(b - a).toBeGreaterThan(0.2);
  });
  it("a respiração é OFEGANTE logo depois do esforço e acalma", () => {
    const amp = (tDesde: number) => { let a = Infinity, b = -Infinity; for (let t = 0; t < 1; t += 0.01) { const d = poseAlerta(t, tDesde).desce; a = Math.min(a, d); b = Math.max(b, d); } return b - a; };
    expect(amp(0)).toBeGreaterThan(0.03); expect(amp(3)).toBeLessThan(amp(0) * 0.6);
  });
  it("hero landing: um joelho no chão (canela deitada), o pé da frente plantado, o punho no chão", () => {
    const h = poseHeroi();
    expect(h.desce).toBeGreaterThan(0.4);
    expect(Math.abs(h.canela!(-1)[1])).toBeLessThan(0.3); expect(h.canela!(1)[1]).toBeLessThan(-0.95);
    expect(h.ante(-1)[1]).toBeLessThan(-0.95);
    expect(pesoHeroi(0.02)).toBeLessThan(1); expect(pesoHeroi(0.3)).toBe(1); expect(pesoHeroi(HEROI.segura + HEROI.levanta + 0.01)).toBe(0);
  });
  it("decolagem: braços pra trás no agachamento, pra cima no impulso", () => {
    const ag = bracosDaDecolagem(0.12, 0.16), la = bracosDaDecolagem(0.16 + 0.15, 0.16);
    expect(ag.braco(1)[0]).toBeLessThan(-0.3); expect(la.braco(1)[1]).toBeGreaterThan(0.3); expect(la.w).toBe(1);
    expect(bracosDaDecolagem(1.5, 0.16).w).toBe(0);
  });
  it("a guarda entra rápido depois do dash, fica ~1,5 s e sai suave", () => {
    expect(pesoAlerta(-1)).toBe(0); expect(pesoAlerta(0.2)).toBe(1); expect(pesoAlerta(ALERTA.dura - 0.01)).toBe(1);
    expect(pesoAlerta(ALERTA.dura + ALERTA.sai / 2)).toBeCloseTo(0.5, 5); expect(pesoAlerta(ALERTA.dura + ALERTA.sai + 0.1)).toBe(0);
  });
});

describe("sons do movimento (sintetizados)", () => {
  it("todos: duração certa, finitos, terminam sem clique; o hero landing é o mais grave e mais longo", () => {
    const sr = 48000, sons = { dash: [sintetizarDash(sr), 0.5], alerta: [sintetizarAlerta(sr), 0.7], decola: [sintetizarDecola(sr), 0.7], heroi: [sintetizarImpactoHeroi(sr), 1.6] } as const;
    for (const [x, dur] of Object.values(sons)) { expect(x.length).toBe(Math.round(sr * dur)); expect(x.every(Number.isFinite)).toBe(true); expect(Math.abs(x[x.length - 1]!)).toBeLessThan(1e-3); }
    const rms = (x: Float32Array, i0: number, i1: number) => Math.sqrt(x.slice(i0, i1).reduce((s, v) => s + v * v, 0) / (i1 - i0));
    const d = sons.dash[0]; expect(rms(d, 0, sr * 0.12)).toBeGreaterThan(rms(d, sr * 0.35, sr * 0.5) * 3);   // o arranque, e some
    const h = sons.heroi[0]; expect(rms(h, sr * 0.3, sr * 0.6)).toBeGreaterThan(0.05);   // o boom ainda soando
  });
});
