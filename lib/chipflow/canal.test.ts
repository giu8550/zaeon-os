import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/src/lib/prisma", () => ({ prisma: { agentChannel: { findUnique: m.findUnique, update: m.update, updateMany: m.updateMany } } }));

import { instanceIdDaEnv, registrarEnvio, resolverCanalEnvio } from "./canal";

beforeEach(() => { m.findUnique.mockReset(); m.update.mockReset(); m.updateMany.mockReset(); m.update.mockResolvedValue({}); m.updateMany.mockResolvedValue({ count: 1 }); });

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
  it("ok no mesmo dia → incremento ATÔMICO (updateMany com where diaContagem=hoje), sem ler antes", async () => {
    await registrarEnvio("c1", { ok: true }, now);
    expect(m.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", diaContagem: "2026-10-07" },
      data: { enviadosHoje: { increment: 1 }, ultimoEnvioEm: now, ultimoErro: null },
    });
    expect(m.findUnique).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  });
  it("ok em dia novo (updateMany não casou) → zera pra 1 com o dia de hoje", async () => {
    m.updateMany.mockResolvedValue({ count: 0 });
    await registrarEnvio("c1", { ok: true }, now);
    expect(m.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { enviadosHoje: 1, diaContagem: "2026-10-07", ultimoEnvioEm: now, ultimoErro: null },
    });
  });
  it("falha → só ultimoErro (truncado em 300), sem contar", async () => {
    await registrarEnvio("c1", { ok: false, error: "x".repeat(400) }, now);
    expect(m.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { ultimoErro: "x".repeat(300) } });
    expect(m.updateMany).not.toHaveBeenCalled();
  });
  it("Prisma lançando → engole (best-effort)", async () => {
    m.updateMany.mockRejectedValue(new Error("down"));
    await expect(registrarEnvio("c1", { ok: true }, now)).resolves.toBeUndefined();
  });
});
