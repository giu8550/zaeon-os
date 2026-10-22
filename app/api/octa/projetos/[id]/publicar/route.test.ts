import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ session: vi.fn(), guard: vi.fn(), publicar: vi.fn(), octokit: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: m.session }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/src/lib/prisma", () => ({ prisma: { tag: "prisma" } }));
vi.mock("@/src/lib/ratelimit", () => ({ guard: m.guard }));
vi.mock("@/lib/octa/publicar", () => ({ publicarProjeto: m.publicar }));
vi.mock("@/lib/projects/github-user", () => ({ getUserOctokit: m.octokit }));

import { POST } from "./route";

const ID = "0123456789abcdef01234567";
const ctx = { params: { id: ID } };
const post = (b: unknown = {}) => new Request(`http://x/api/octa/projetos/${ID}/publicar`, { method: "POST", body: JSON.stringify(b), headers: { "Content-Type": "application/json" } });

describe("POST /api/octa/projetos/[id]/publicar", () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    m.session.mockResolvedValue({ user: { id: "u1", email: "aluno@x.com" } });
    m.guard.mockResolvedValue({ ok: true });
  });

  it("sem sessão → 401 e não publica", async () => {
    m.session.mockResolvedValue(null);
    expect((await POST(post(), ctx)).status).toBe(401);
    expect(m.publicar).not.toHaveBeenCalled();
  });

  it("rate limit estourado → a resposta do guard, sem publicar", async () => {
    m.guard.mockResolvedValue({ ok: false, response: new Response("{}", { status: 429 }) });
    expect((await POST(post(), ctx)).status).toBe(429);
    expect(m.guard).toHaveBeenCalledWith(expect.any(Request), "octa-publicar", "ai-heavy");
    expect(m.publicar).not.toHaveBeenCalled();
  });

  it("dono e email vêm da SESSÃO (userId/email do corpo são ignorados) e o octokit é o do aluno", async () => {
    m.publicar.mockResolvedValue({ ok: true, repoUrl: "https://github.com/ana/site", pagesUrl: "https://ana.github.io/site/", status: "publicando", ignorados: [] });
    const r = await POST(post({ userId: "hacker", email: "h@x.com", mensagem: "primeira versão" }), ctx);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, repoUrl: "https://github.com/ana/site", pagesUrl: "https://ana.github.io/site/", status: "publicando", ignorados: [] });
    const [deps, p] = m.publicar.mock.calls[0];
    expect(p).toEqual({ userId: "u1", email: "aluno@x.com", projetoId: ID, mensagem: "primeira versão" });
    expect(deps.db).toEqual({ tag: "prisma" });
    await deps.octokitDoAluno("aluno@x.com");
    expect(m.octokit).toHaveBeenCalledWith("aluno@x.com");
  });

  it("projeto de outro dono (ou inexistente) → 404", async () => {
    m.publicar.mockResolvedValue({ ok: false, erro: "projeto_inexistente" });
    expect((await POST(post(), ctx)).status).toBe(404);
  });

  it("os outros códigos voltam como { ok:false, erro } com status coerente", async () => {
    const casos: Array<[string, number]> = [
      ["aviso_publico_pendente", 409], ["github_reconectar", 409], ["sem_arquivos_publicaveis", 409],
      ["limite_publicacoes", 429], ["limite_repos", 429], ["falha_github", 502],
    ];
    for (const [erro, status] of casos) {
      m.publicar.mockResolvedValueOnce({ ok: false, erro });
      const r = await POST(post(), ctx);
      expect(r.status, erro).toBe(status);
      expect(await r.json()).toEqual({ ok: false, erro });
    }
  });
});
