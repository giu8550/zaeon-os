/** Envio de credencial acadêmica: 401 anônimo, 400 nível/doc inválidos, declarado vs doc_review, docHash duplicado sinalizado, GET sem documento. */
import { describe, it, expect, vi, beforeEach } from "vitest";
const st: any = { me: null, rows: [] as any[] };
vi.mock("@/lib/aura/academico-server", () => ({
  exigirFlag: () => null,
  eu: async () => st.me,
  prisma: {
    academicCredential: {
      findMany: async ({ where }: any) => st.rows.filter((r: any) => r.userId === where.userId),
      count: async ({ where }: any) => st.rows.filter((r: any) => r.docHash === where.docHash && r.userId !== where.userId.not).length,
      create: async ({ data }: any) => { const r = { id: "c1", createdAt: new Date(), verifiedAt: null, ...data }; st.rows.push(r); return r; },
    },
  },
}));
import { GET, POST } from "./route";
const req = (b: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(b) });
const PDF = "data:application/pdf;base64,QUJD";

describe("/api/credentials/academic", () => {
  beforeEach(() => { st.me = { id: "a".repeat(24) }; st.rows = []; });
  it("anônimo 401", async () => { st.me = null; expect((await POST(req({ nivel: "mestrado" }))).status).toBe(401); expect((await GET()).status).toBe(401); });
  it("nível inválido 400; documento inválido 400", async () => {
    expect((await POST(req({ nivel: "phd" }))).status).toBe(400);
    expect((await POST(req({ nivel: "mestrado", doc: "https://x/d.pdf" }))).status).toBe(400);
  });
  it("sem doc = declarado (0 AURA); com doc = doc_review pendente; resposta sem documento", async () => {
    const a = await (await POST(req({ nivel: "graduacao", area: " Agro ", instituicao: "UFX" }))).json();
    expect(a.credencial).toMatchObject({ nivel: "graduacao", area: "Agro", metodo: "declarado", status: "pendente" });
    expect(a.credencial).not.toHaveProperty("docRef");
    const b = await (await POST(req({ nivel: "mestrado", doc: PDF }))).json();
    expect(b.credencial).toMatchObject({ metodo: "doc_review", status: "pendente" });
    expect(b.aviso).toBeNull();
    expect(st.rows[1].docHash).toHaveLength(64);
  });
  it("mesmo documento em outra conta → aviso", async () => {
    st.rows.push({ id: "z", userId: "b".repeat(24), docHash: (await import("@/lib/aura/academico")).hashDocumento(PDF), nivel: "mestrado", metodo: "doc_review", status: "pendente", createdAt: new Date(), verifiedAt: null, area: null, instituicao: null });
    const r = await (await POST(req({ nivel: "mestrado", doc: PDF }))).json();
    expect(r.aviso).toContain("outra conta");
  });
  it("GET lista só as minhas, sem docRef", async () => {
    await POST(req({ nivel: "mestrado", doc: PDF }));
    st.rows.push({ id: "o", userId: "b".repeat(24), nivel: "doutorado", metodo: "doc_review", status: "pendente", createdAt: new Date(), verifiedAt: null, area: null, instituicao: null, docRef: "x" });
    const j = await (await GET()).json();
    expect(j.credenciais).toHaveLength(1);
    expect(j.credenciais[0]).not.toHaveProperty("docRef");
  });
});
