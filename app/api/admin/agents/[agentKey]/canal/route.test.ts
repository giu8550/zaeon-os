import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  admin: { ok: true, email: "dono@zaeon" } as any, flag: true,
  findMany: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), mentores: vi.fn(), profile: vi.fn(),
}));
vi.mock("@/lib/admin/assertAdmin", () => ({ assertAdmin: async () => m.admin }));
vi.mock("@/lib/canal/flags", () => ({ agentsAdmin: () => m.flag }));
vi.mock("@/src/lib/prisma", () => ({ prisma: {
  agentChannel: { findMany: m.findMany, upsert: m.upsert, updateMany: m.updateMany },
  mentorTemplate: { findMany: m.mentores },
  agentProfile: { findUnique: m.profile },
} }));

import { GET, PUT, DELETE, parseChipflowId } from "@/app/api/admin/agents/[agentKey]/canal/route";

const P = (agentKey: string) => ({ params: { agentKey } });
const put = (agentKey: string, body: any) => PUT(new Request("http://x/", { method: "PUT", body: JSON.stringify(body) }), P(agentKey));

beforeEach(() => {
  m.admin = { ok: true, email: "dono@zaeon" }; m.flag = true;
  for (const f of [m.findMany, m.upsert, m.updateMany, m.mentores, m.profile]) f.mockReset();
  m.mentores.mockResolvedValue([]); m.profile.mockResolvedValue(null);
  m.upsert.mockImplementation(async ({ create }: any) => ({ id: "c1", ...create, chipflowToken: create.chipflowToken ?? null }));
  m.updateMany.mockResolvedValue({ count: 1 });
});

describe("parseChipflowId", () => {
  it("inteiro positivo (número ou string numérica); resto null", () => {
    expect(parseChipflowId(42)).toBe(42);
    expect(parseChipflowId("42")).toBe(42);
    for (const v of ["42abc", 0, -1, 1.5, "", null, undefined, {}]) expect(parseChipflowId(v)).toBeNull();
  });
});

describe("gate", () => {
  it("flag off → 404; sem admin → 401/403", async () => {
    m.flag = false; expect((await GET(new Request("http://x/"), P("aura"))).status).toBe(404);
    m.flag = true; m.admin = { ok: false, status: 403 }; expect((await GET(new Request("http://x/"), P("aura"))).status).toBe(403);
    m.admin = { ok: false, status: 401 }; expect((await put("aura", { chipflowId: 1 })).status).toBe(401);
  });
});

describe("PUT", () => {
  it("agente desconhecido → 404; chipflowId inválido → 400; numero inválido → 400", async () => {
    expect((await put("zz", { chipflowId: 1 })).status).toBe(404);
    expect((await put("aura", { chipflowId: "42abc" })).status).toBe(400);
    expect((await put("aura", { chipflowId: 42, numero: "abc" })).status).toBe(400);
    expect(m.upsert).not.toHaveBeenCalled();
  });
  it("upsert por [agentKey,tipo] vira vinculado/chipflow; token mascarado na resposta", async () => {
    const r = await put("aura", { chipflowId: "42", chipflowToken: "abcd-efgh-1234", numero: "11 99999-9999", limiteDia: 50, pool: "operator", tierReportado: "baby" });
    expect(r.status).toBe(200);
    const { canal } = await r.json();
    const arg = m.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ agentKey_tipo: { agentKey: "aura", tipo: "whatsapp" } });
    expect(arg.create).toMatchObject({ agentKey: "aura", tipo: "whatsapp", origem: "chipflow", chipflowId: 42, chipflowToken: "abcd-efgh-1234", numero: "+5511999999999", limiteDia: 50, pool: "operator", tierReportado: "baby", estado: "vinculado" });
    expect(arg.create.tokenAtualizadoEm).toBeInstanceOf(Date);
    expect(arg.update).toMatchObject({ chipflowId: 42, estado: "vinculado" });
    expect(canal.chipflowToken).toBe("••••1234");
  });
  it("mentor do banco é agente válido", async () => {
    m.mentores.mockResolvedValue([{ slug: "medicina", name: "Dra. Lia", course: "Medicina", emoji: "🩺", personaText: "x".repeat(50), order: 1 }]);
    expect((await put("medicina", { chipflowId: 7 })).status).toBe(200);
  });
});

describe("GET / DELETE", () => {
  it("GET lista os canais do agente com token mascarado", async () => {
    m.findMany.mockResolvedValue([{ id: "c1", agentKey: "aura", tipo: "whatsapp", chipflowToken: "zzzz9999", estado: "vinculado" }]);
    const { canais } = await (await GET(new Request("http://x/"), P("aura"))).json();
    expect(canais[0].chipflowToken).toBe("••••9999");
    expect(m.findMany).toHaveBeenCalledWith({ where: { agentKey: "aura" }, orderBy: { tipo: "asc" } });
  });
  it("DELETE desvincula (mantém o documento)", async () => {
    const r = await DELETE(new Request("http://x/?tipo=whatsapp"), P("aura"));
    expect(r.status).toBe(200);
    expect(m.updateMany).toHaveBeenCalledWith({
      where: { agentKey: "aura", tipo: "whatsapp" },
      data: { estado: "nao_vinculado", chipflowId: null, chipflowToken: null, tokenAtualizadoEm: null },
    });
  });
});
