import { describe, it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({ userId: "u1" as string | null, gerar: vi.fn(), revogar: vi.fn(), entrar: vi.fn(), listar: vi.fn(), comentar: vi.fn(), membros: vi.fn(), remover: vi.fn() }));
vi.mock("@/src/lib/ratelimit", () => ({ guard: async () => ({ ok: true }) }));
vi.mock("@/lib/agent/transcript", () => ({ resolveUserId: async () => m.userId }));
vi.mock("@/lib/cartolina/cowork-store", async (o) => ({
  ...(await o<any>()),
  gerarLink: m.gerar, revogarLinks: m.revogar, entrarPorConvite: m.entrar, listarComentarios: m.listar, comentar: m.comentar, listarMembros: m.membros, removerMembro: m.remover,
}));
import { POST as SHARE, DELETE as REVOKE } from "@/app/api/cartolina/[id]/share/route";
import { POST as JOIN } from "@/app/api/cartolina/[id]/join/route";
import { GET as LIST, POST as COMMENT } from "@/app/api/cartolina/[id]/comentarios/route";
import { GET as MEMBERS, DELETE as KICK } from "@/app/api/cartolina/[id]/membros/route";

const p = { params: { id: "b1" } };
const req = (body?: any, url = "http://x/") => new Request(url, { method: body ? "POST" : "GET", body: body ? JSON.stringify(body) : undefined });

beforeEach(() => {
  process.env.CARTOLINA_MEMORIA = "1"; process.env.CARTOLINA_COWORK = "1"; m.userId = "u1";
  Object.values(m).forEach((f: any) => f?.mockReset?.());
});

describe("rotas de coworking", () => {
  it("exigem as DUAS flags", async () => {
    delete process.env.CARTOLINA_COWORK;
    for (const r of [SHARE(req({}), p), JOIN(req({}), p), LIST(req(), p), MEMBERS(req(), p)]) expect((await r).status).toBe(404);
    process.env.CARTOLINA_COWORK = "1"; delete process.env.CARTOLINA_MEMORIA;
    expect((await JOIN(req({}), p)).status).toBe(404);
  });
  it("sem sessão = 401 (convidado precisa entrar como ele mesmo)", async () => {
    m.userId = null;
    expect((await JOIN(req({ token: "t" }), p)).status).toBe(401);
    expect((await COMMENT(req({ cardId: "k", texto: "x" }), p)).status).toBe(401);
  });
  it("share: papel inválido = 400; devolve URL relativa /estudo/:id?convite=", async () => {
    expect((await SHARE(req({ papel: "dono" }), p)).status).toBe(400);
    m.gerar.mockResolvedValue({ ok: true, token: "a.b" });
    const r = await SHARE(req({ papel: "leitor" }), p);
    expect(await r.json()).toEqual({ url: "/estudo/b1?convite=a.b", token: "a.b" });
    expect(m.gerar).toHaveBeenCalledWith("b1", "u1", "leitor");
  });
  it("share default = editor; falhas mapeadas", async () => {
    m.gerar.mockResolvedValue({ ok: false, reason: "forbidden" });
    expect((await SHARE(req({}), p)).status).toBe(403);
    expect(m.gerar.mock.calls[0][2]).toBe("editor");
    m.revogar.mockResolvedValue({ ok: false, reason: "not_found" });
    expect((await REVOKE(req(), p)).status).toBe(404);
  });
  it("join: convite inválido = 400; ok devolve o papel", async () => {
    m.entrar.mockResolvedValueOnce({ ok: false, reason: "invalid" });
    expect((await JOIN(req({ token: "x" }), p)).status).toBe(400);
    m.entrar.mockResolvedValueOnce({ ok: true, papel: "editor" });
    expect(await (await JOIN(req({ token: "x" }), p)).json()).toEqual({ papel: "editor" });
    expect(m.entrar).toHaveBeenLastCalledWith("b1", "u1", "x");
  });
  it("comentários: ?desde válido vira Date; inválido é ignorado; POST 201", async () => {
    m.listar.mockResolvedValue({ ok: true, comentarios: [] });
    await LIST(req(undefined, "http://x/?desde=2026-01-01T00:00:00Z"), p);
    expect(m.listar.mock.calls[0][2]).toBeInstanceOf(Date);
    await LIST(req(undefined, "http://x/?desde=ontem"), p);
    expect(m.listar.mock.calls[1][2]).toBeUndefined();
    m.comentar.mockResolvedValue({ ok: true, id: "c1" });
    expect((await COMMENT(req({ cardId: "k", texto: "x", userId: "atacante" }), p)).status).toBe(201);
    expect(m.comentar.mock.calls[0][1]).toBe("u1");
  });
  it("membros: lista e remove pelo usuário da sessão", async () => {
    m.membros.mockResolvedValue({ ok: true, membros: [] });
    expect((await MEMBERS(req(), p)).status).toBe(200);
    m.remover.mockResolvedValue({ ok: false, reason: "forbidden" });
    const r = await KICK(new Request("http://x/", { method: "DELETE", body: JSON.stringify({ userId: "u2" }) }), p);
    expect(r.status).toBe(403);
    expect(m.remover).toHaveBeenCalledWith("b1", "u1", "u2");
  });
});
