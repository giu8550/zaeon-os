import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ session: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), del: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: m.session }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/src/lib/prisma", () => ({
  prisma: { octaProjeto: { findFirst: m.findFirst, findMany: m.findMany, create: m.create, update: m.update, delete: m.del }, octaPublicacao: {} },
}));

import { GET, POST } from "./route";
import { GET as GET1, PATCH, DELETE } from "./[id]/route";

const ID = "0123456789abcdef01234567";
const ctx = { params: { id: ID } };
const patch = (b: unknown) => new Request("http://x/api/octa/projetos/" + ID, { method: "PATCH", body: JSON.stringify(b), headers: { "Content-Type": "application/json" } });
const meu = { id: ID, userId: "u1", nome: "Site", slug: "site", arquivos: {}, permissao: "auto" };

describe("/api/octa/projetos", () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    m.session.mockResolvedValue({ user: { id: "u1", email: "a@b.c" } });
  });

  it("sem sessão → 401 em todas as rotas", async () => {
    m.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(new Request("http://x", { method: "POST", body: "{}" }))).status).toBe(401);
    expect((await GET1(new Request("http://x"), ctx)).status).toBe(401);
    expect((await PATCH(patch({}), ctx)).status).toBe(401);
    expect((await DELETE(new Request("http://x"), ctx)).status).toBe(401);
  });

  it("POST cria com o dono da SESSÃO, ignorando userId do corpo", async () => {
    m.create.mockImplementation(async ({ data }: any) => ({ id: ID, ...data }));
    const r = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ nome: "Confeitaria da Ana!", userId: "hacker" }) }));
    expect(r.status).toBe(201);
    expect(m.create.mock.calls[0][0].data).toMatchObject({ userId: "u1", slug: "confeitaria-da-ana" });
  });

  it("projeto de outro dono (ou inexistente) → 404 em GET/PATCH/DELETE", async () => {
    m.findFirst.mockResolvedValue(null);
    expect((await GET1(new Request("http://x"), ctx)).status).toBe(404);
    expect((await PATCH(patch({ permissao: "auto" }), ctx)).status).toBe(404);
    expect((await DELETE(new Request("http://x"), ctx)).status).toBe(404);
    expect(m.findFirst).toHaveBeenCalledWith({ where: { id: ID, userId: "u1" } });
    expect(m.update).not.toHaveBeenCalled();
    expect(m.del).not.toHaveBeenCalled();
  });

  it("id malformado → 404 sem consultar o banco", async () => {
    expect((await GET1(new Request("http://x"), { params: { id: "xyz" } })).status).toBe(404);
    expect(m.findFirst).not.toHaveBeenCalled();
  });

  it("PATCH rejeita permissao fora dos 3 valores (400) e aceita os válidos", async () => {
    m.findFirst.mockResolvedValue(meu);
    expect((await PATCH(patch({ permissao: "root" }), ctx)).status).toBe(400);
    expect(m.update).not.toHaveBeenCalled();
    m.update.mockImplementation(async ({ data }: any) => ({ ...meu, ...data }));
    for (const permissao of ["auto", "antes_de_publicar", "antes_de_escrever"]) {
      expect((await PATCH(patch({ permissao, designId: "d1" }), ctx)).status).toBe(200);
    }
  });

  it("PATCH com arquivos acima de 1,5 MB → 413 e nada é gravado", async () => {
    m.findFirst.mockResolvedValue(meu);
    const r = await PATCH(patch({ arquivos: { "index.html": "x".repeat(1_500_001) } }), ctx);
    expect(r.status).toBe(413);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("PATCH grava arquivos pequenos", async () => {
    m.findFirst.mockResolvedValue(meu);
    m.update.mockImplementation(async ({ data }: any) => ({ ...meu, ...data }));
    const r = await PATCH(patch({ arquivos: { "index.html": "<h1>oi</h1>" } }), ctx);
    expect(r.status).toBe(200);
    expect(m.update.mock.calls[0][0].data).toEqual({ arquivos: { "index.html": "<h1>oi</h1>" } });
  });
});
