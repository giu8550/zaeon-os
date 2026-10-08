import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sessao = vi.fn();
const estado: { rows: any[]; perfis: any[] } = { rows: [], perfis: [] };
vi.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => sessao(...a) }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/src/lib/prisma", () => ({
  prisma: {
    tokenLedger: {
      findMany: async ({ where }: any) => estado.rows.filter((r) => !where?.at?.gte || new Date(r.at) >= where.at.gte),
      findFirst: async () => (estado.rows.length ? { at: estado.rows.map((r) => new Date(r.at)).sort((a, b) => +a - +b)[0] } : null),
    },
    agentProfile: { findMany: async () => estado.perfis },
    user: { findMany: async ({ where }: any) => where.id.in.map((id: string) => ({ id, name: id === "1".repeat(24) ? "Ana" : null, email: null })) },
  },
}));
import { GET } from "./route";

const ADMIN = { user: { email: "donmartinezcaiudoceu@gmail.com" } };
const req = (q = "") => new Request(`http://x/api/admin/agents/tokens${q}`);
const row = (o: any) => ({ at: new Date(), agentKey: "aura", surface: "canal", model: "gemini-2.5-flash", provedor: "vertex", rota: "vertex", promptTokens: 100, completionTokens: 20, cachedTokens: 0, totalTokens: 120, estimatedCostUsd: 0.001, ok: true, ...o });

const prev = process.env.NEXT_PUBLIC_AGENTS_ADMIN;
beforeEach(() => { process.env.NEXT_PUBLIC_AGENTS_ADMIN = "1"; estado.rows = []; estado.perfis = []; sessao.mockResolvedValue(ADMIN); });
afterEach(() => { if (prev === undefined) delete process.env.NEXT_PUBLIC_AGENTS_ADMIN; else process.env.NEXT_PUBLIC_AGENTS_ADMIN = prev; });

describe("/api/admin/agents/tokens", () => {
  it("gate: flag off 404; anônimo 401; não-admin 403", async () => {
    delete process.env.NEXT_PUBLIC_AGENTS_ADMIN; expect((await GET(req())).status).toBe(404);
    process.env.NEXT_PUBLIC_AGENTS_ADMIN = "1";
    sessao.mockResolvedValue(null); expect((await GET(req())).status).toBe(401);
    sessao.mockResolvedValue({ user: { email: "aluno@x.com", role: "student" } }); expect((await GET(req())).status).toBe(403);
  });
  it("range/groupBy inválidos → 400", async () => {
    expect((await GET(req("?range=1y"))).status).toBe(400);
    expect((await GET(req("?groupBy=modelo"))).status).toBe(400);
  });
  it("ledger vazio → grupos [], medindoDesde null (a UI declara o vazio, não mostra 0)", async () => {
    const j = await (await GET(req())).json();
    expect(j.grupos).toEqual([]); expect(j.medindoDesde).toBeNull(); expect(j.serie14d).toHaveLength(14); expect(j.totais.hoje.totalTokens).toBe(0);
  });
  it("agrega por agente; agente sem linha no período NÃO aparece; medindoDesde = primeira linha", async () => {
    const antiga = new Date(Date.now() - 20 * 86_400_000);
    estado.rows = [row({}), row({ agentKey: "aura", cachedTokens: 50, promptTokens: 50 }), row({ agentKey: "medicina", at: antiga, totalTokens: 999 })];
    const j7 = await (await GET(req("?range=7d"))).json();
    expect(j7.grupos.map((g: any) => g.chave)).toEqual(["aura"]);
    expect(j7.grupos[0]).toMatchObject({ chamadas: 2, totalTokens: 240, cachedTokens: 50, promptTokens: 150, tokensPorChamada: 120 });
    expect(j7.medindoDesde).toBe(antiga.toISOString());
    const j30 = await (await GET(req("?range=30d"))).json();
    expect(j30.grupos.map((g: any) => g.chave).sort()).toEqual(["aura", "medicina"]);
  });
  it("groupBy=usuario resolve nome; hoje/tetos: estouraria o teto → fora:true", async () => {
    estado.rows = [row({ userId: "1".repeat(24), totalTokens: 150 }), row({ userId: "1".repeat(24), totalTokens: 150 })];
    estado.perfis = [{ agentKey: "aura", tetoTokensDia: 200 }, { agentKey: "medicina", tetoTokensDia: null }];
    const j = await (await GET(req("?groupBy=usuario"))).json();
    expect(j.grupos[0]).toMatchObject({ chave: "1".repeat(24), nome: "Ana", chamadas: 2 });
    expect(j.hoje.aura).toBe(300);
    expect(j.tetos.aura).toEqual({ fora: true, usado: 300, teto: 200 });
    expect(j.tetos.medicina).toEqual({ fora: false, usado: 0, teto: null });
  });
});
