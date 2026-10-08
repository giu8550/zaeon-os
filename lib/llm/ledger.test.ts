import { describe, it, expect, vi } from "vitest";
import { registrarTokens, linhaParaPrisma, surfaceLedger, type LinhaLedger } from "./ledger";

const linha: LinhaLedger = { agentKey: "aura", surface: "canal", userId: "0123456789abcdef01234567", model: "gemini-2.5-flash", provedor: "vertex", rota: "vertex", usage: { promptTokens: 200, completionTokens: 50, cachedTokens: 800, totalTokens: 1050, reportado: true }, ms: 1234.6, ok: true };

describe("registrarTokens (best-effort)", () => {
  it("grava via client injetado e devolve true", async () => {
    const create = vi.fn(async () => ({}));
    expect(await registrarTokens(linha, { tokenLedger: { create } }, {})).toBe(true);
    const data = (create.mock.calls[0] as any)[0].data;
    expect(data).toMatchObject({ agentKey: "aura", surface: "canal", promptTokens: 200, cachedTokens: 800, totalTokens: 1050, ok: true, ms: 1235, reportado: true });
    expect(data.estimatedCostUsd).toBeGreaterThan(0);
  });
  it("client lançando → false, sem lançar", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await registrarTokens(linha, { tokenLedger: { create: async () => { throw new Error("mongo caiu"); } } }, {})).toBe(false);
    warn.mockRestore();
  });
  it("TOKEN_LEDGER=0 desliga sem tocar o client; agentKey vazio não grava", async () => {
    const create = vi.fn(async () => ({}));
    expect(await registrarTokens(linha, { tokenLedger: { create } }, { TOKEN_LEDGER: "0" })).toBe(false);
    expect(await registrarTokens({ ...linha, agentKey: "" }, { tokenLedger: { create } }, {})).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
  it("userId inválido vira null; erro zera o custo", () => {
    const d = linhaParaPrisma({ ...linha, userId: "nao-e-objectid", ok: false, erro: "rate_limit" });
    expect(d.userId).toBeNull(); expect(d.estimatedCostUsd).toBe(0); expect(d.erro).toBe("rate_limit");
  });
  it("surfaceLedger normaliza", () => {
    expect(surfaceLedger("sala-de-estudos")).toBe("estudos"); expect(surfaceLedger("pesquisa")).toBe("pesquisa"); expect(surfaceLedger(null)).toBe("outro"); expect(surfaceLedger("canal")).toBe("canal");
  });
});
