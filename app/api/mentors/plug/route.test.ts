/** Teto de contratação no POST /api/mentors/plug: aluno 3 / professor 10 → 403 no teto; re-contratar ativo não conta. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const st = { count: 0, jaAtivo: null as null | { enabled: boolean }, role: "student", upserts: 0, deletes: 0 };
vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    pluggedMentor = {
      // count reflete o banco: antes do upsert = st.count; depois, +1 por plug NOVO (já ativo não soma)
      count: async () => st.count + (st.jaAtivo?.enabled ? 0 : st.upserts),
      findUnique: async () => st.jaAtivo,
      upsert: async () => { st.upserts++; return {}; },
      deleteMany: async () => { st.deletes++; st.upserts--; return { count: 1 }; },
    };
  },
}));
vi.mock("@/lib/agent/transcript", () => ({ resolveUserId: async () => "u".repeat(24) }));
vi.mock("@/lib/agent/mentors-server", () => ({ templateIdFrom: async (_p: unknown, b: any) => (b?.slug ? { id: "t".repeat(24), slug: b.slug } : null) }));
vi.mock("next-auth", () => ({ getServerSession: async () => ({ user: { email: "x@y.z", role: st.role } }) }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));

import { POST } from "./route";
const req = (slug?: string) => new Request("http://x", { method: "POST", body: JSON.stringify(slug ? { slug } : {}) });

describe("POST /api/mentors/plug · limite", () => {
  beforeEach(() => { st.count = 0; st.jaAtivo = null; st.role = "student"; st.upserts = 0; st.deletes = 0; });
  it("aluno com 2 contrata (count vira 3); com 3 → 403 com mensagem amigável", async () => {
    st.count = 2;
    const ok = await POST(req("medicina"));
    const jok = await ok.json();
    expect(ok.status, JSON.stringify(jok)).toBe(200);
    expect(jok).toMatchObject({ ok: true, limit: 3, count: 3 });
    st.count = 3; st.upserts = 0; // banco já com 3 ativos
    const r = await POST(req("fisica"));
    expect(r.status).toBe(403);
    const j = await r.json();
    expect(j.error).toContain("3 mentores");
    expect(j).toMatchObject({ limit: 3, count: 3 });
    expect(st.upserts).toBe(0); // o 403 nunca grava
  });
  it("professor: 10", async () => {
    st.role = "teacher"; st.count = 9;
    expect((await POST(req("medicina"))).status).toBe(200);
    st.count = 10;
    expect((await POST(req("fisica"))).status).toBe(403);
  });
  it("re-contratar um já ativo no teto não é barrado nem conta", async () => {
    st.count = 3; st.jaAtivo = { enabled: true };
    const r = await POST(req("medicina"));
    expect(r.status).toBe(200);
    expect((await r.json()).count).toBe(3);
  });
  it("corrida: dois plugs passam a checagem com 2/3, o segundo estoura na recontagem → desfeito + 403", async () => {
    st.count = 2;
    // simula o 2º request vendo o banco já com 3 depois do upsert do 1º: count = 2 + upserts
    const [a, b] = await Promise.all([POST(req("medicina")), POST(req("fisica"))]);
    const statuses = [a.status, b.status].sort();
    // Fail-safe: NUNCA os dois passam. Dependendo da interleaving, 1 passa ou os 2 recuam (e o aluno tenta de novo).
    expect([[200, 403], [403, 403]]).toContainEqual(statuses);
    expect(st.deletes).toBeGreaterThanOrEqual(1);
    expect(st.count + st.upserts).toBeLessThanOrEqual(3); // teto respeitado no banco
  });
  it("slug ausente → 404", async () => {
    expect((await POST(req())).status).toBe(404);
  });
});
