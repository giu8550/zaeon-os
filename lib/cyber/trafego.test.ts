import { describe, expect, it } from "vitest";
import { CIDADE } from "./ceu";
import { fiosCosmicos } from "./fiosCosmicos";
import { ANEIS_VOO, TRAFEGO, VEICULOS_CEU, estadoDoVeiculo, montarViagem, naViagem, viagemDe } from "./trafego";

describe("o tráfego do céu", () => {
  it("a viagem sai de um buraco negro, passa pelo anel e mergulha noutro", () => {
    const f = fiosCosmicos(), v = montarViagem(0, 2, 1, 0, 50), a = naViagem(v, 0), b = naViagem(v, 1), meio = naViagem(v, 0.5);
    expect(Math.hypot(a.x - f[0]!.bn.x, a.y - f[0]!.bn.y, a.z - f[0]!.bn.z)).toBeLessThan(1);
    expect(Math.hypot(b.x - f[2]!.bn.x, b.y - f[2]!.bn.y, b.z - f[2]!.bn.z)).toBeLessThan(1);
    expect(Math.abs(Math.hypot(meio.x, meio.z) - ANEIS_VOO[1].r)).toBeLessThan(25);
    expect(v.dur).toBeCloseTo(v.comprimento / 50, 6);
  });
  it("o céu fica fora da plataforma: o voo não passa por cima do piso da central (nem perto da capela)", () => {
    for (const k of [0, 1, 2, 3]) { const v = montarViagem(1, 3, k, 1, 50);
    for (let u = 0; u <= 1; u += 0.01) { const p = naViagem(v, u); expect(Math.hypot(p.x, p.z)).toBeGreaterThan(CIDADE.bordaR + 10); expect(p.y).toBeGreaterThan(15); } }
  });
  it("todo mundo vê o mesmo trânsito (só o relógio decide) e ele está movimentado", () => {
    const t = 12345.6, a = VEICULOS_CEU.map((ve) => estadoDoVeiculo(ve, t)), b = VEICULOS_CEU.map((ve) => estadoDoVeiculo(ve, t));
    expect(a.map((e) => e && naViagem(e.v, e.u))).toEqual(b.map((e) => e && naViagem(e.v, e.u)));
    expect(a.filter(Boolean).length).toBeGreaterThan((TRAFEGO.carros + TRAFEGO.motos) * 0.7);
    expect(new Set(VEICULOS_CEU.map((v) => v.cor)).size).toBeGreaterThan(5);
  });
  it("saindo do buraco negro o veículo cresce; entrando, encolhe; a viagem nº n é sempre a mesma", () => {
    const ve = VEICULOS_CEU[3]!; let achou = false;
    for (let t = 0; t < 400 && !achou; t += 0.05) { const e = estadoDoVeiculo(ve, t); if (e && e.u < 0.01) { expect(e.escala).toBeLessThan(0.2); achou = true; } }
    expect(achou).toBe(true);
    expect(viagemDe(ve, 7).comprimento).toBe(viagemDe(ve, 7).comprimento);
  });
});
