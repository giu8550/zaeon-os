import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn() }));
vi.mock("@/src/lib/prisma", () => ({ prisma: { agentChannel: { findUnique: m.findUnique, update: m.update } } }));

import { instanceIdDaEnv, registrarEnvio, resolverCanalEnvio } from "./canal";

beforeEach(() => { m.findUnique.mockReset(); m.update.mockReset(); m.update.mockResolvedValue({}); });

describe("instanceIdDaEnv", () => {
  it("inteiro positivo; lixo/zero/negativo/decimal → null", () => {
    expect(instanceIdDaEnv({ BRIDGE_INSTANCE_ID: "42" })).toBe(42);
    expect(instanceIdDaEnv({ BRIDGE_INSTANCE_ID: " 7 " })).toBe(7);
    for (const v of ["abc", "0", "-3", "1.5", "", undefined]) expect(instanceIdDaEnv({ BRIDGE_INSTANCE_ID: v })).toBeNull();
  });
});

describe("resolverCanalEnvio", () => {
  it("canal whatsapp vinculado com chipflowId → fonte canal", async () => {
    m.findUnique.mockResolvedValue({ id: "c1", estado: "vinculado", chipflowId: 42 });
    expect(await resolverCanalEnvio("medicina", {})).toEqual({ fonte: "canal", canalId: "c1", chipflowId: 42 });
    expect(m.findUnique).toHaveBeenCalledWith({ where: { agentKey_tipo: { agentKey: "medicina", tipo: "whatsapp" } } });
  });
  it("canal não vinculado / sem chipflowId → cai na env; sem env → null", async () => {
    m.findUnique.mockResolvedValue({ id: "c1", estado: "pausado_na_origem", chipflowId: 42 });
    expect(await resolverCanalEnvio("aura", { BRIDGE_INSTANCE_ID: "9" })).toEqual({ fonte: "env", chipflowId: 9 });
    m.findUnique.mockResolvedValue({ id: "c1", estado: "vinculado", chipflowId: null });
    expect(await resolverCanalEnvio("aura", {})).toBeNull();
    m.findUnique.mockResolvedValue(null);
    expect(await resolverCanalEnvio("aura", { BRIDGE_INSTANCE_ID: "abc" })).toBeNull();
  });
  it("Prisma lançando (coleção ainda sem db push) → usa a env, não derruba", async () => {
    m.findUnique.mockRejectedValue(new Error("no collection"));
    expect(await resolverCanalEnvio("aura", { BRIDGE_INSTANCE_ID: "9" })).toEqual({ fonte: "env", chipflowId: 9 });
  });
});

describe("registrarEnvio", () => {
  const now = new Date("2026-10-07T15:00:00-03:00");
  it("ok em dia novo → zera e conta 1, grava diaContagem e ultimoEnvioEm, limpa ultimoErro", async () => {
    m.findUnique.mockResolvedValue({ id: "c1", enviadosHoje: 17, diaContagem: "2026-10-06" });
    await registrarEnvio("c1", { ok: true }, now);
    expect(m.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { enviadosHoje: 1, diaContagem: "2026-10-07", ultimoEnvioEm: now, ultimoErro: null },
    });
  });
  it("ok no mesmo dia → incrementa", async () => {
    m.findUnique.mockResolvedValue({ id: "c1", enviadosHoje: 3, diaContagem: "2026-10-07" });
    await registrarEnvio("c1", { ok: true }, now);
    expect(m.update.mock.calls[0][0].data.enviadosHoje).toBe(4);
  });
  it("falha → só ultimoErro (truncado em 300), sem contar", async () => {
    m.findUnique.mockResolvedValue({ id: "c1", enviadosHoje: 3, diaContagem: "2026-10-07" });
    await registrarEnvio("c1", { ok: false, error: "x".repeat(400) }, now);
    expect(m.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { ultimoErro: "x".repeat(300) } });
  });
  it("Prisma lançando → engole (best-effort)", async () => {
    m.findUnique.mockRejectedValue(new Error("down"));
    await expect(registrarEnvio("c1", { ok: true }, now)).resolves.toBeUndefined();
  });
});
