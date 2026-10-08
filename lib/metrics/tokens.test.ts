import { describe, it, expect } from "vitest";
import { desde, porAgente, porUsuario, porPrograma, porDia, topN, totalizador, medindoDesde, rangeValido, type LedgerRow } from "./tokens";

const AGORA = new Date("2026-10-07T15:00:00.000Z");
const row = (o: Partial<LedgerRow>): LedgerRow => ({ at: AGORA, agentKey: "aura", surface: "estudos", model: "gemini-2.5-flash", provedor: "vertex", rota: "vertex", promptTokens: 100, completionTokens: 50, cachedTokens: 0, totalTokens: 150, estimatedCostUsd: 0.001, ok: true, ...o });
const dias = (n: number) => new Date(AGORA.getTime() - n * 86_400_000);
const fixture: LedgerRow[] = [
  row({ agentKey: "aura", userId: "u1" }),
  row({ agentKey: "aura", userId: "u2", at: dias(2), cachedTokens: 80, promptTokens: 20, totalTokens: 150 }),
  row({ agentKey: "medicina", userId: "u1", at: dias(10), programId: "p1", totalTokens: 1000, promptTokens: 900, completionTokens: 100, estimatedCostUsd: 0.01 }),
  row({ agentKey: "medicina", userId: "u1", at: dias(10), ok: false, erro: "rate_limit", totalTokens: 0, promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 }),
  row({ agentKey: "enfermagem", at: dias(40), totalTokens: 999 }),
];

describe("desde / rangeValido", () => {
  it("7d/30d/all", () => {
    expect(desde("7d", AGORA)?.toISOString()).toBe("2026-09-30T15:00:00.000Z");
    expect(desde("30d", AGORA)?.toISOString()).toBe("2026-09-07T15:00:00.000Z");
    expect(desde("all", AGORA)).toBeNull();
    expect(rangeValido("7d")).toBe(true); expect(rangeValido("1y")).toBe(false);
  });
});

describe("porAgente", () => {
  it("agente SEM linha no período NÃO aparece (UI mostra '—', não 0)", () => {
    const g7 = porAgente(fixture, "7d", AGORA);
    expect(g7.map((g) => g.chave)).toEqual(["aura"]);
    const g30 = porAgente(fixture, "30d", AGORA);
    expect(g30.map((g) => g.chave)).toEqual(["medicina", "aura"]);
    expect(porAgente(fixture, "all", AGORA).map((g) => g.chave)).toEqual(["medicina", "enfermagem", "aura"]);
  });
  it("soma colunas, cached à parte, tokens/chamada só sobre ok, erros contados", () => {
    const med = porAgente(fixture, "30d", AGORA).find((g) => g.chave === "medicina")!;
    expect(med).toMatchObject({ chamadas: 2, ok: 1, erros: 1, promptTokens: 900, completionTokens: 100, totalTokens: 1000, tokensPorChamada: 1000, custoEstimadoUsd: 0.01 });
    const aura = porAgente(fixture, "7d", AGORA).find((g) => g.chave === "aura")!;
    expect(aura).toMatchObject({ chamadas: 2, promptTokens: 120, cachedTokens: 80, totalTokens: 300, tokensPorChamada: 150 });
    expect(aura.ultimo).toBe(AGORA.toISOString());
  });
});

describe("porUsuario / porPrograma", () => {
  it("ignora linhas sem a chave", () => {
    expect(porUsuario(fixture, "all", AGORA).map((g) => [g.chave, g.chamadas])).toEqual([["u1", 3], ["u2", 1]]);
    expect(porPrograma(fixture, "all", AGORA)).toEqual([expect.objectContaining({ chave: "p1", totalTokens: 1000 })]);
  });
});

describe("porDia", () => {
  it("sempre devolve `dias` entradas, zeros onde não houve, ordem cronológica", () => {
    const s = porDia(fixture, 14, AGORA);
    expect(s).toHaveLength(14);
    expect(s[13]).toMatchObject({ dia: "2026-10-07", totalTokens: 150, chamadas: 1 });
    expect(s[11]).toMatchObject({ dia: "2026-10-05", totalTokens: 150 });
    expect(s[3]).toMatchObject({ dia: "2026-09-27", totalTokens: 1000, chamadas: 2 });
    expect(s[0]).toMatchObject({ dia: "2026-09-24", totalTokens: 0, chamadas: 0 });
  });
});

describe("topN / totalizador / medindoDesde", () => {
  it("topN por coluna", () => {
    expect(topN(porAgente(fixture, "all", AGORA), "cachedTokens", 1)[0].chave).toBe("aura");
    expect(topN(porAgente(fixture, "all", AGORA), "custoEstimadoUsd", 1)[0].chave).toBe("medicina");
  });
  it("totalizador hoje × 30d", () => {
    const t = totalizador(fixture, AGORA);
    expect(t.hoje).toEqual({ totalTokens: 150, chamadas: 1, custoEstimadoUsd: 0.001 });
    expect(t.mes).toMatchObject({ totalTokens: 1300, chamadas: 4 });
  });
  it("medindoDesde = primeira linha; null sem linhas", () => {
    expect(medindoDesde(fixture)).toBe(dias(40).toISOString());
    expect(medindoDesde([])).toBeNull();
  });
});
