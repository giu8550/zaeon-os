import { describe, expect, it } from "vitest";
import { CIDADE } from "./ceu";
import { fiosCosmicos, pontoDoFio } from "./fiosCosmicos";
import { ANEIS_VOO, CICLO_T, TRAFEGO, VEICULOS_CEU, estadoDoVeiculo, montarViagem, naViagem, viagemDe } from "./trafego";

describe("o tráfego do céu (pelas pistas cósmicas)", () => {
  it("a viagem sai do buraco negro de uma pista, passa pelo anel do hub e cai no buraco negro de outra", () => {
    const f = fiosCosmicos(), v = montarViagem(0, 2, 0, 0, 50), a = naViagem(v, 0), b = naViagem(v, 1);
    expect(Math.hypot(a.x - f[0]!.bn.x, a.y - f[0]!.bn.y, a.z - f[0]!.bn.z)).toBeLessThan(f[0]!.bn.r * 1.3);
    expect(Math.hypot(b.x - f[2]!.bn.x, b.y - f[2]!.bn.y, b.z - f[2]!.bn.z)).toBeLessThan(f[2]!.bn.r * 1.3);
    let noAnel = false; for (let u = 0; u <= 1; u += 0.005) { const p = naViagem(v, u); if (Math.abs(Math.hypot(p.x, p.z) - ANEIS_VOO[0].r) < 20) noAnel = true; }
    expect(noAnel).toBe(true);
    expect(v.dur).toBeLessThan(v.comprimento / 50); expect(v.dur).toBeGreaterThan(v.comprimento / (50 * TRAFEGO.disparo));
  });
  it("anda PELAS pistas (perto do traçado delas) e nunca por cima do piso da central", () => {
    const f = fiosCosmicos(), v = montarViagem(1, 3, 0, 1, 50, 10, 3);
    for (let u = 0; u <= 1; u += 0.01) { const p = naViagem(v, u); expect(Math.hypot(p.x, p.z)).toBeGreaterThan(CIDADE.bordaR + 10); }
    // no começo, está na pista 1 (a uns metros do traçado — a faixa)
    const p = naViagem(v, 0.15); let perto = Infinity; for (let u = 0; u <= 1; u += 0.002) { const q = pontoDoFio(f[1]!, u); perto = Math.min(perto, Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)); }
    expect(perto).toBeLessThan(TRAFEGO.faixaLado + TRAFEGO.faixaAlto + 6);
  });
  it("todo mundo vê o mesmo trânsito (só o relógio decide) e ele está movimentado", () => {
    const t = 12345.6, a = VEICULOS_CEU.map((ve) => estadoDoVeiculo(ve, t)), b = VEICULOS_CEU.map((ve) => estadoDoVeiculo(ve, t));
    expect(a.map((e) => e && naViagem(e.v, e.u))).toEqual(b.map((e) => e && naViagem(e.v, e.u)));
    expect(a.filter(Boolean).length).toBeGreaterThan((TRAFEGO.carros + TRAFEGO.motos) * 0.6);
    expect(new Set(VEICULOS_CEU.map((v) => v.cor)).size).toBeGreaterThan(5);
  });
  it("saindo do buraco negro o veículo cresce; a viagem nº n é sempre a mesma e cabe no ciclo", () => {
    const ve = VEICULOS_CEU[3]!; let achou = false;
    for (let t = 0; t < 600 && !achou; t += 0.05) { const e = estadoDoVeiculo(ve, t); if (e && e.u < 0.005) { expect(e.escala).toBeLessThan(0.2); achou = true; } }
    expect(achou).toBe(true);
    expect(viagemDe(ve, 7).comprimento).toBe(viagemDe(ve, 7).comprimento);
    for (let n = 0; n < 30; n++) for (const v of VEICULOS_CEU.slice(0, 10)) expect(viagemDe(v, n).dur).toBeLessThan(CICLO_T / v.vel);
  });
});
