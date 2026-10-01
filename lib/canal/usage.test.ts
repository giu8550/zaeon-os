import { describe, it, expect, vi } from "vitest";
import { registrarUso, agregarUso } from "./usage";

const U1 = "1".repeat(24), U2 = "2".repeat(24), U3 = "3".repeat(24);

describe("usage · registrarUso", () => {
  it("upsert idempotente por (agentKey,userId) com increment", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const ok = await registrarUso({ agentUsage: { upsert } }, "aura", U1);
    expect(ok).toBe(true);
    const arg = upsert.mock.calls[0]![0];
    expect(arg.where).toEqual({ agentKey_userId: { agentKey: "aura", userId: U1 } });
    expect(arg.update.contagem).toEqual({ increment: 1 });
    expect(arg.create).toMatchObject({ agentKey: "aura", userId: U1, contagem: 1 });
  });
  it("ignora userId inválido/ausente e engole erro de banco", async () => {
    const upsert = vi.fn().mockRejectedValue(new Error("down"));
    expect(await registrarUso({ agentUsage: { upsert } }, "aura", null)).toBe(false);
    expect(await registrarUso({ agentUsage: { upsert } }, "aura", "nope")).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
    expect(await registrarUso({ agentUsage: { upsert } }, "aura", U1)).toBe(false);
  });
});

describe("usage · agregarUso", () => {
  it("total, usuários distintos, último uso e top N", () => {
    const agg = agregarUso([
      { agentKey: "aura", userId: U1, contagem: 5, ultimoUso: "2026-09-01T00:00:00.000Z" },
      { agentKey: "aura", userId: U2, contagem: 9, ultimoUso: "2026-09-03T00:00:00.000Z" },
      { agentKey: "aura", userId: U3, contagem: 1, ultimoUso: "2026-09-02T00:00:00.000Z" },
      { agentKey: "medicina", userId: U1, contagem: 2, ultimoUso: new Date("2026-08-01T00:00:00.000Z") },
    ], 2);
    expect(agg.aura!.total).toBe(15);
    expect(agg.aura!.usuarios).toBe(3);
    expect(agg.aura!.ultimoUso).toBe("2026-09-03T00:00:00.000Z");
    expect(agg.aura!.top.map((t) => t.userId)).toEqual([U2, U1]);
    expect(agg.medicina!.total).toBe(2);
    expect(agg.nina).toBeUndefined();
  });
});
