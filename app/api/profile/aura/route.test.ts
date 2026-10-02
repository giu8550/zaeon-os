/** GET /api/profile/aura: 401 anônimo; saldo = soma do ledger (não o cache); só dados do próprio usuário. */
import { describe, it, expect, vi, beforeEach } from "vitest";
const st: any = { me: null };
const ME = "a".repeat(24), OUTRO = "b".repeat(24);
vi.mock("@/lib/aura/academico-server", () => ({
  exigirFlag: () => null,
  eu: async () => st.me,
  prisma: {
    auraEvent: { findMany: async ({ where }: any) => [
      { id: "1", userId: ME, source: "node_validated", amount: 50, reason: "Validação", createdAt: new Date() },
      { id: "2", userId: ME, source: "brain_completed", amount: 200, reason: null, createdAt: new Date() },
      { id: "3", userId: ME, source: "reversal", amount: -50, reason: null, createdAt: new Date() },
      { id: "9", userId: OUTRO, source: "brain_completed", amount: 200, reason: null, createdAt: new Date() },
    ].filter((e) => e.userId === where.userId) },
    academicCredential: { findMany: async () => [{ id: "c", userId: ME, nivel: "mestrado", area: null, instituicao: null, metodo: "doc_review", status: "verificado", verifiedAt: new Date(), createdAt: new Date(), docRef: "SECRETO", docHash: "h" }] },
    credential: { findMany: async () => [{ id: "k", type: "skill", title: "Fotossíntese", assetId: "As1", network: "devnet", issuedAt: new Date() }] },
    user: { findUnique: async () => ({ aura: 999, academicLevel: "Mestrado" }) },
  },
}));
import { GET } from "./route";

describe("GET /api/profile/aura", () => {
  beforeEach(() => { st.me = { id: ME }; });
  it("anônimo 401", async () => { st.me = null; expect((await GET()).status).toBe(401); });
  it("saldo vem do ledger (cache desatualizado é sinalizado); contadores; nunca o documento", async () => {
    const j = await (await GET()).json();
    expect(j).toMatchObject({ aura: 200, level: 2, titulo: "Aprendiz", cacheDesatualizado: true, validatedSkills: 1, completedBrains: 1, academicLevel: "Mestrado" });
    expect(j.parede[0]).toMatchObject({ assetId: "As1" });
    expect(JSON.stringify(j)).not.toContain("SECRETO");
    expect(j.recent).toHaveLength(3);
  });
});
