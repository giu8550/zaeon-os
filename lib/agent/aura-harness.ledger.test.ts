import { describe, it, expect, vi } from "vitest";

// O envelope é mockado: queremos provar o que o adaptador FAZ com ele (ctx/phase/rota/medido), sem rede.
const chamadas: any[] = [];
let totalPorChamada = 1000;
vi.mock("@/lib/llm/envelope", () => ({
  gerarJsonRes: async (req: any) => {
    chamadas.push(req);
    const texto = req.ctx.phase === "reason" ? { reasoning: "ok" } : { nucleo: "resposta", artifacts: [] };
    return { valor: texto, res: { texto: JSON.stringify(texto), usage: { promptTokens: totalPorChamada - 10, completionTokens: 10, cachedTokens: 0, totalTokens: totalPorChamada, reportado: true }, modelo: req.model ?? "m", provedor: "vertex", rota: req.rota ?? "vertex", ms: 1 } };
  },
}));

import { buildHarnessDeps } from "./aura-harness";

const ctx: any = { userId: "0123456789abcdef01234567", activeTab: "estudos", plan: "free", execMode: "auto" };
const st: any = { objective: "explique entropia", mode: "quick", academicMode: "off", intent: "explicar_conceito", spec: { tools: [], required: [] }, evidence: [], reasoning: "", steps: [] };

describe("buildHarnessDeps × envelope (C5)", () => {
  it("default genJson passa ledger + phase por call site, rota default vertex, e acumula usoMedido", async () => {
    chamadas.length = 0;
    const deps = buildHarnessDeps(ctx, { ledger: { agentKey: "medicina", mentorSlug: "medicina", surface: "estudos", userId: ctx.userId } });
    expect(typeof deps.usoMedido).toBe("function");
    expect(deps.usoMedido!()).toBe(0);
    await deps.reason(st);
    await deps.draft(st);
    expect(chamadas.map((c) => c.ctx.phase)).toEqual(["reason", "draft"]);
    expect(chamadas[0].ctx).toMatchObject({ agentKey: "medicina", surface: "estudos", userId: ctx.userId });
    expect(chamadas[0].rota).toBe("vertex");
    expect(deps.usoMedido!()).toBe(2000);
  });
  it("rota gateway + transformarSystem chegam ao envelope (é o que o turno do canal usa)", async () => {
    chamadas.length = 0;
    const deps = buildHarnessDeps(ctx, { rota: "gateway", ledger: { agentKey: "aura", surface: "canal" }, transformarSystem: (s) => s.replace(/Você é a Aura/g, "Você é Osler") + "\nASSINATURA" });
    await deps.reason(st);
    expect(chamadas[0].rota).toBe("gateway");
    expect(chamadas[0].system).toContain("Você é Osler"); expect(chamadas[0].system).toContain("ASSINATURA"); expect(chamadas[0].system).not.toContain("Você é a Aura");
  });
  it("genJson injetado (testes antigos) → sem usoMedido, envelope não é chamado", async () => {
    chamadas.length = 0;
    const deps = buildHarnessDeps(ctx, { genJson: async () => ({ reasoning: "x" }) as any });
    expect(deps.usoMedido).toBeUndefined();
    await deps.reason(st);
    expect(chamadas).toHaveLength(0);
  });
});
