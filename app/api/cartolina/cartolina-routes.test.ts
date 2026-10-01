import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  userId: "u1" as string | null,
  rl: { ok: true } as any,
  findOwn: vi.fn(), create: vi.fn(), getBoard: vi.fn(), patch: vi.fn(), gerar: vi.fn(),
}));
vi.mock("@/src/lib/ratelimit", () => ({ guard: async () => m.rl }));
vi.mock("@/lib/agent/transcript", () => ({ resolveUserId: async () => m.userId }));
vi.mock("@/lib/caderno/cartolina", async (orig) => ({ ...(await orig<any>()), gerarCartolina: m.gerar }));
vi.mock("@/lib/cartolina/store", async (orig) => ({
  ...(await orig<any>()),
  findOwnBoard: m.findOwn, createBoard: m.create, getBoardForUser: m.getBoard, patchBoard: m.patch,
}));

import { GET, POST } from "@/app/api/cartolina/route";
import { GET as GET_ID, PATCH } from "@/app/api/cartolina/[id]/route";

const req = (url: string, body?: any, method = "GET") =>
  new Request("http://x" + url, { method, body: body ? JSON.stringify(body) : undefined, headers: { "content-type": "application/json" } });

beforeEach(() => {
  process.env.CARTOLINA_MEMORIA = "1";
  m.userId = "u1"; m.rl = { ok: true };
  Object.values(m).forEach((f: any) => f?.mockReset?.());
  m.findOwn.mockResolvedValue(null);
  m.gerar.mockResolvedValue([{ id: "c0", tipo: "titulo", titulo: "T", x: 0, y: 0, w: 300 }]);
  m.create.mockImplementation(async (i: any) => ({ id: "b1", ...i }));
});

describe("flag CARTOLINA_MEMORIA", () => {
  it("desligada = 404 em todas as rotas (merge não muda nada)", async () => {
    delete process.env.CARTOLINA_MEMORIA;
    expect((await GET(req("/api/cartolina"))).status).toBe(404);
    expect((await POST(req("/api/cartolina", { topic: "x" }, "POST"))).status).toBe(404);
    expect((await GET_ID(req("/api/cartolina/1"), { params: { id: "1" } })).status).toBe(404);
    expect((await PATCH(req("/api/cartolina/1", {}, "PATCH"), { params: { id: "1" } })).status).toBe(404);
  });
});

describe("sessão e rate-limit", () => {
  it("sem sessão = 401", async () => {
    m.userId = null;
    expect((await GET(req("/api/cartolina"))).status).toBe(401);
    expect((await PATCH(req("/api/cartolina/1", {}, "PATCH"), { params: { id: "1" } })).status).toBe(401);
  });
  it("rate-limit estourado devolve a resposta do guard", async () => {
    m.rl = { ok: false, response: new Response("slow down", { status: 429 }) };
    expect((await GET(req("/api/cartolina"))).status).toBe(429);
  });
  it("o dono do board vem da SESSÃO, nunca do corpo", async () => {
    await POST(req("/api/cartolina", { topic: "água", ownerId: "atacante", userId: "atacante" }, "POST"));
    expect(m.create.mock.calls[0][0].ownerId).toBe("u1");
  });
});

describe("GET /api/cartolina", () => {
  it("surface inválida = 400; válida consulta o board do usuário logado", async () => {
    expect((await GET(req("/api/cartolina?surface=hack"))).status).toBe(400);
    m.findOwn.mockResolvedValue({ id: "b1" });
    const r = await GET(req("/api/cartolina?surface=estudos&scopeId=t1"));
    expect(await r.json()).toEqual({ board: { id: "b1" } });
    expect(m.findOwn).toHaveBeenCalledWith("u1", "estudos", "t1");
  });
  it("scopeId com lixo vira null (não chega ao banco)", async () => {
    await GET(req("/api/cartolina?scopeId=" + encodeURIComponent("a b<script>")));
    expect(m.findOwn).toHaveBeenCalledWith("u1", "estudos", null);
  });
});

describe("POST /api/cartolina", () => {
  it("gera e persiste (201)", async () => {
    const r = await POST(req("/api/cartolina", { topic: "ciclo da água", scopeId: "t1" }, "POST"));
    expect(r.status).toBe(201);
    expect(m.gerar).toHaveBeenCalledWith("ciclo da água");
    expect(m.create).toHaveBeenCalledOnce();
  });
  it("já existe board na conversa: devolve o existente sem gastar modelo", async () => {
    m.findOwn.mockResolvedValue({ id: "ja" });
    const r = await POST(req("/api/cartolina", { topic: "x", scopeId: "t1" }, "POST"));
    expect(r.status).toBe(200);
    expect(m.gerar).not.toHaveBeenCalled();
  });
  it("regenerar:true gera de novo mesmo com board existente", async () => {
    m.findOwn.mockResolvedValue({ id: "ja" });
    await POST(req("/api/cartolina", { topic: "x", regenerar: true }, "POST"));
    expect(m.gerar).toHaveBeenCalled();
  });
  it("tópico vazio = 400; geração sem cards = 502", async () => {
    expect((await POST(req("/api/cartolina", { topic: "  " }, "POST"))).status).toBe(400);
    m.gerar.mockResolvedValue([]);
    expect((await POST(req("/api/cartolina", { topic: "x" }, "POST"))).status).toBe(502);
  });
});

describe("/api/cartolina/:id", () => {
  const p = { params: { id: "b1" } };
  it("GET: sem acesso = 404", async () => {
    m.getBoard.mockResolvedValue(null);
    expect((await GET_ID(req("/api/cartolina/b1"), p)).status).toBe(404);
    expect(m.getBoard).toHaveBeenCalledWith("b1", "u1");
  });
  it("PATCH mapeia razões: ok 200 · forbidden 403 · not_found 404 · conflict 409", async () => {
    const chamar = () => PATCH(req("/api/cartolina/b1", { upsert: [] }, "PATCH"), p);
    m.patch.mockResolvedValueOnce({ ok: true, board: { id: "b1" } });
    expect((await chamar()).status).toBe(200);
    m.patch.mockResolvedValueOnce({ ok: false, reason: "forbidden" });
    expect((await chamar()).status).toBe(403);
    m.patch.mockResolvedValueOnce({ ok: false, reason: "not_found" });
    expect((await chamar()).status).toBe(404);
    m.patch.mockResolvedValueOnce({ ok: false, reason: "conflict" });
    expect((await chamar()).status).toBe(409);
  });
  it("PATCH usa o usuário da sessão e limita o tamanho do lote", async () => {
    m.patch.mockResolvedValue({ ok: true, board: {} });
    await PATCH(req("/api/cartolina/b1", { upsert: Array.from({ length: 500 }, () => ({})), userId: "atacante" }, "PATCH"), p);
    expect(m.patch.mock.calls[0][1]).toBe("u1");
    expect(m.patch.mock.calls[0][2].upsert).toHaveLength(50);
  });
});
