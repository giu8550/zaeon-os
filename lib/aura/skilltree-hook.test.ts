/** masteryUpdate: com AURA_ECONOMY o nó dominado paga AURA no ledger (idempotente) e NÃO soma xp; sem flag, xp como antes. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({ grant: vi.fn(), updates: [] as any[], progress: {} as Record<string, any> }));
vi.mock("@/lib/aura/ledger", () => ({ grantNodeLearned: h.grant }));
vi.mock("@/src/lib/prisma", () => ({
  prisma: {
    skillTree: { findUnique: async () => ({ topicSlug: "foto", topicLabel: "Fotossíntese", nodes: [{ id: "n1", title: "Luz", branch: "a", level: 1, prereqs: [], summary: "" }] }) },
    skillProgress: {
      findMany: async () => Object.values(h.progress),
      upsert: async ({ where, create, update }: any) => { const k = where.userId_topicSlug_nodeId.nodeId; h.progress[k] = { ...(h.progress[k] ?? create), ...update }; return h.progress[k]; },
      count: async () => 1,
    },
    user: { findUnique: async () => ({ skills: {} }), update: async (a: any) => { h.updates.push(a.data); return {}; } },
  },
}));
vi.mock("@/lib/skilltree/credential", () => ({ issueCredential: async () => ({ ok: false, reason: "test" }) }));
import { masteryUpdate } from "@/lib/skilltree/progress";

const U = "a".repeat(24);
const prev = process.env.AURA_ECONOMY;
afterEach(() => { if (prev === undefined) delete process.env.AURA_ECONOMY; else process.env.AURA_ECONOMY = prev; });
beforeEach(() => { h.grant.mockReset().mockResolvedValue({ ok: true }); h.updates.length = 0; for (const k of Object.keys(h.progress)) delete h.progress[k]; });

describe("skilltree → AURA", () => {
  it("flag ON: grantNodeLearned com chave topic:node, sem xp", async () => {
    process.env.AURA_ECONOMY = "1";
    const r = await masteryUpdate(U, "foto", "n1", 1);
    expect(r.ok && r.newlyMastered).toBe(true);
    expect(h.grant).toHaveBeenCalledTimes(1);
    expect(h.grant.mock.calls[0]!.slice(1, 3)).toEqual([U, "foto:n1"]);
    expect(h.updates.some((d) => d.xp)).toBe(false);
  });
  it("flag OFF: xp legado, sem ledger", async () => {
    delete process.env.AURA_ECONOMY;
    await masteryUpdate(U, "foto", "n1", 1);
    expect(h.grant).not.toHaveBeenCalled();
    expect(h.updates.some((d) => d.xp?.increment === 25)).toBe(true);
  });
});
