import { describe, it, expect, vi, beforeEach } from "vitest";

const st: { sessao: any; existente: any; criou: any[]; atualizou: any[] } = { sessao: null, existente: null, criou: [], atualizou: [] };
vi.mock("next-auth", () => ({ getServerSession: async () => st.sessao }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/src/lib/prisma", () => ({
  prisma: {
    user: { findUnique: async () => ({ id: "u".repeat(24) }) },
    researchWork: {
      findFirst: async () => st.existente,
      create: async (a: any) => { st.criou.push(a.data); return { id: "w1" }; },
      update: async (a: any) => { st.atualizou.push(a); return { id: a.where.id }; },
    },
  },
}));

import { POST, conteudoDoProjeto } from "./route";
const req = (b: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(b) });
const projeto = { id: "p1", title: "Bioreator", description: "Projeto de bioreator.", domain: "Bio", difficultyRank: "A", agentName: "Darwin" };

describe("POST /api/projects/save", () => {
  beforeEach(() => { st.sessao = { user: { email: "a@b.c" } }; st.existente = null; st.criou = []; st.atualizou = []; });
  it("sem sessão → 401 (a página cai no localStorage)", async () => {
    st.sessao = null;
    expect((await POST(req({ project: projeto }))).status).toBe(401);
  });
  it("sem project/title → 400", async () => {
    expect((await POST(req({}))).status).toBe(400);
    expect((await POST(req({ project: { title: "  " } }))).status).toBe(400);
  });
  it("cria ResearchWork 'Projeto' do dono da SESSÃO; userId do body é ignorado", async () => {
    const r = await POST(req({ project: projeto, userId: "guest_user_123" }));
    expect(r.status).toBe(201);
    expect(st.criou[0]).toMatchObject({ userId: "u".repeat(24), title: "Bioreator", workType: "Projeto" });
    expect(st.criou[0].content).toContain("Domínio: Bio");
  });
  it("mesmo título → atualiza, não duplica", async () => {
    st.existente = { id: "w9" };
    const r = await POST(req({ project: projeto }));
    expect(r.status).toBe(200);
    expect(st.criou).toHaveLength(0);
    expect(st.atualizou[0].where).toEqual({ id: "w9" });
  });
  it("conteudoDoProjeto sem metadados é só a descrição", () => {
    expect(conteudoDoProjeto({ description: " oi " })).toBe("oi");
  });
});
