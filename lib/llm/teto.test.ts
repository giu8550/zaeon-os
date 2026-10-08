import { describe, it, expect, vi } from "vitest";
import { foraPorTeto, decidirTeto, inicioDoDiaLocal, tetoEnforce } from "./teto";

function db(teto: number | null, usado: number) {
  const aggregate = vi.fn(async () => ({ _sum: { totalTokens: usado } }));
  return { client: { agentProfile: { findUnique: async () => ({ tetoTokensDia: teto }) }, tokenLedger: { aggregate } }, aggregate };
}

describe("teto por agente", () => {
  it("sem teto → nunca fora, e nem consulta o ledger", async () => {
    const { client, aggregate } = db(null, 999_999);
    expect(await foraPorTeto(client as any, "aura")).toEqual({ fora: false, usado: 0, teto: null });
    expect(aggregate).not.toHaveBeenCalled();
  });
  it("teto 100 e 100 usados → fora; 99 → dentro", async () => {
    expect(await foraPorTeto(db(100, 100).client as any, "aura")).toMatchObject({ fora: true, usado: 100, teto: 100 });
    expect(await foraPorTeto(db(100, 99).client as any, "aura")).toMatchObject({ fora: false });
  });
  it("conta só a partir da meia-noite LOCAL (vira à meia-noite)", async () => {
    const agora = new Date(2026, 9, 7, 23, 59, 0);
    const { client, aggregate } = db(100, 5);
    await foraPorTeto(client as any, "aura", agora);
    const gte = (aggregate.mock.calls[0] as any)[0].where.at.gte as Date;
    expect(gte.getTime()).toBe(new Date(2026, 9, 7, 0, 0, 0, 0).getTime());
    expect(inicioDoDiaLocal(new Date(2026, 9, 8, 0, 0, 1)).getDate()).toBe(8);
  });
  it("decidirTeto: teto 0 = sem teto; perfil inexistente → sem teto", async () => {
    expect(decidirTeto(50, 0)).toEqual({ fora: false, usado: 50, teto: null });
    const client = { agentProfile: { findUnique: async () => null }, tokenLedger: { aggregate: vi.fn() } };
    expect(await foraPorTeto(client as any, "x")).toEqual({ fora: false, usado: 0, teto: null });
  });
  it("tetoEnforce só com '1'", () => { expect(tetoEnforce({})).toBe(false); expect(tetoEnforce({ AGENT_TETO_ENFORCE: "1" })).toBe(true); });
});
