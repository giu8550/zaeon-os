import { describe, expect, it } from "vitest";
import { AREAS, areaDe } from "./areas";
import { AREAS_PADRAO, FLAGS_PADRAO, type AreasFrota } from "./agenda";
import { CONFIG_PADRAO, sanitizarAreas, sanitizarConfig } from "./config";
import { gerarFrota } from "./frota";
import { planejarDia } from "./plano";
import { CIDADE, mundo } from "../ceu";
import { PLATAFORMAS } from "../plataformas";
import { PRACA } from "../praca";
import { ESTACIONAMENTOS } from "../estacionamentosEstudo";

const frota = gerarFrota(), DIA = 20734;
const estudoPorLugar = (ar: AreasFrota) => {
  const c: Record<string, number> = {};
  for (const { blocos } of planejarDia(frota, DIA, FLAGS_PADRAO, false, ar).agentes.values()) for (const b of blocos) if (b.atividade.startsWith("estudo") && b.spot) c[b.ambiente!] = (c[b.ambiente!] ?? 0) + (b.fim - b.ini);
  return c;
};

describe("modo admin: as áreas do mapa", () => {
  it("cada lugar cai na sua área (o centro, a sala, o estacionamento, o campus, a praça; em trânsito = céu)", () => {
    expect(areaDe(CIDADE.centro)).toBe("zaeon");
    for (const s of ["lounge", "biblioteca", "jardim", "garagem"] as const) expect(areaDe(mundo(CIDADE.salas[s]))).toBe(s);
    for (const e of Object.values(ESTACIONAMENTOS)) expect(areaDe(e)).toBe(e.ambiente);
    for (const id of ["univ", "ufc", "unifor", "uece", "solana"] as const) expect(areaDe(PLATAFORMAS[id].centro)).toBe(id);
    expect(areaDe(PRACA)).toBe("praca");
    expect(areaDe(CIDADE.centro, true)).toBe("ceu");
    expect(areaDe({ x: 99999, z: 99999 })).toBe("ceu");
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(AREAS.length);
  });
  it("a config guarda os controles por área (padrão = o de hoje; fora dos limites, corta)", () => {
    expect(CONFIG_PADRAO.areas).toEqual(AREAS_PADRAO);
    expect(sanitizarConfig({}).areas).toEqual(AREAS_PADRAO);
    const a = sanitizarAreas({ proporcao: { moto: 500, andar: -3 }, pesos: { univ: 99, jardim: "x" }, loungeChao: 999, vagas: 50 });
    expect(a.proporcao.moto).toBe(100); expect(a.proporcao.andar).toBe(0); expect(a.proporcao.estudoLounge).toBe(AREAS_PADRAO.proporcao.estudoLounge);
    expect(a.pesos.univ).toBe(10); expect(a.pesos.jardim).toBe(AREAS_PADRAO.pesos.jardim);
    expect(a.loungeChao).toBe(220); expect(a.vagas).toBe(33);
  });
  it("peso 0 tira o lugar do mapa (nem quem transborda vai pra lá); peso alto puxa gente", () => {
    const base = estudoPorLugar(AREAS_PADRAO);
    const semBiblio = estudoPorLugar({ ...AREAS_PADRAO, pesos: { ...AREAS_PADRAO.pesos, biblioteca: 0 } });
    expect(base.biblioteca ?? 0).toBeGreaterThan(0); expect(semBiblio.biblioteca ?? 0).toBe(0);
    const maisUece = estudoPorLugar({ ...AREAS_PADRAO, pesos: { ...AREAS_PADRAO.pesos, uece: 10 } });
    expect(maisUece.uece!).toBeGreaterThan(base.uece! * 1.5);
  });
  it("sem lounge na proporção, ninguém estuda no lounge; vagas 0 = nenhuma moto parada; o chão do lounge respeita o limite", () => {
    expect(estudoPorLugar({ ...AREAS_PADRAO, proporcao: { ...AREAS_PADRAO.proporcao, estudoLounge: 0 } }).lounge ?? 0).toBe(0);
    const p0 = planejarDia(frota, DIA, FLAGS_PADRAO, false, { ...AREAS_PADRAO, vagas: 0 });
    expect([...p0.agentes.values()].some(({ blocos }) => blocos.some((b) => b.vaga))).toBe(false);
    const p5 = planejarDia(frota, DIA, FLAGS_PADRAO, false, { ...AREAS_PADRAO, loungeChao: 5 });
    const chao = new Set<string>(); for (const { blocos } of p5.agentes.values()) for (const b of blocos) if (b.ambiente === "lounge" && b.spot?.tipo === "piso") chao.add(b.spot.id);
    expect(chao.size).toBeLessThanOrEqual(5);
  });
});
