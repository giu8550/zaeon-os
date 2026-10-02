/** Fila do verificador: aluno 403; professor habilitado vê só alunos vinculados, sem documento, com flag de duplicado. */
import { describe, it, expect, vi, beforeEach } from "vitest";
const st: any = { me: null, alunos: [] as string[], rows: [] as any[] };
const P = "b".repeat(24), A1 = "1".repeat(24), A2 = "2".repeat(24);
vi.mock("@/lib/aura/academico-server", () => ({
  exigirFlag: () => null,
  eu: async () => st.me,
  comoVerificador: async (me: any) => ({ id: me.id, role: me.role, verificadorHabilitado: me.verificadorHabilitado, temCredencialVerificada: false, isSuperAdmin: false }),
  alunosDoVerificador: async () => st.alunos,
  prisma: {
    academicCredential: {
      findMany: async ({ where }: any) => st.rows.filter((r: any) => r.status === where.status && where.userId.in.includes(r.userId)),
      groupBy: async ({ where }: any) => { const m: Record<string, number> = {}; for (const r of st.rows) if (r.docHash && where.docHash.in.includes(r.docHash)) m[r.docHash] = (m[r.docHash] ?? 0) + 1; return Object.entries(m).map(([docHash, n]) => ({ docHash, _count: { _all: n } })); },
    },
    user: { findMany: async ({ where }: any) => where.id.in.map((id: string) => ({ id, name: `N${id[0]}`, email: null })) },
  },
}));
import { GET } from "./route";
const req = (q = "") => new Request(`http://x/api/academic/fila${q}`);
const row = (id: string, userId: string, docHash: string | null) => ({ id, userId, nivel: "mestrado", area: null, instituicao: null, docRef: docHash ? "SECRETO" : null, docHash, metodo: docHash ? "doc_review" : "declarado", status: "pendente", verifiedAt: null, createdAt: new Date() });

describe("GET /api/academic/fila", () => {
  beforeEach(() => {
    st.me = { id: P, role: "teacher", verificadorHabilitado: true }; st.alunos = [A1];
    st.rows = [row("c1", A1, "h1"), row("c2", A2, "h1"), row("c3", A1, null), { ...row("c4", A1, "h2"), status: "verificado" }];
  });
  it("aluno 403; professor não habilitado 403; anônimo 401", async () => {
    st.me = { id: P, role: "student", verificadorHabilitado: false };
    expect((await GET(req())).status).toBe(403);
    st.me = { id: P, role: "teacher", verificadorHabilitado: false };
    expect((await GET(req())).status).toBe(403);
    st.me = null;
    expect((await GET(req())).status).toBe(401);
  });
  it("vê só alunos vinculados e pendentes; sem documento; duplicado sinalizado", async () => {
    const j = await (await GET(req("?status=pendente"))).json();
    expect(j.papel).toBe("professor");
    expect(j.fila.map((f: any) => f.id)).toEqual(["c1", "c3"]);
    expect(j.fila[0]).toMatchObject({ temDoc: true, docDuplicado: true, aluno: { id: A1, nome: "N1" } });
    expect(j.fila[1]).toMatchObject({ temDoc: false, docDuplicado: false });
    expect(JSON.stringify(j)).not.toContain("SECRETO");
  });
});
