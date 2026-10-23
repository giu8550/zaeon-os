import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  admin: { ok: true, email: "a@x.com" } as any,
  findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn(),
}));
vi.mock("@/lib/admin/assertAdmin", () => ({ assertAdmin: async () => m.admin }));
vi.mock("@/src/lib/prisma", () => ({
  prisma: { blueprint: { findMany: m.findMany, create: m.create, updateMany: m.updateMany, findUnique: m.findUnique, deleteMany: m.deleteMany } },
}));

import { GET, POST } from "@/app/api/admin/blueprints/route";
import { PATCH, DELETE } from "@/app/api/admin/blueprints/[id]/route";
import { GET as PUBLICO } from "@/app/api/blueprints/route";

const ID = "a".repeat(24);
const json = (body: unknown, method = "POST") => new Request("http://x/", { method, body: JSON.stringify(body) });
const ctx = (id = ID) => ({ params: { id } });

beforeEach(() => {
  Object.values(m).forEach((f: any) => f?.mockReset?.());
  m.admin = { ok: true, email: "a@x.com" };
  m.findMany.mockResolvedValue([]);
  m.create.mockImplementation(async ({ data }: any) => ({ id: ID, ...data }));
  m.updateMany.mockResolvedValue({ count: 1 });
  m.findUnique.mockResolvedValue({ id: ID, title: "T" });
  m.deleteMany.mockResolvedValue({ count: 1 });
});

describe("sem admin", () => {
  it.each([401, 403])("devolve %i e não toca no banco", async (status) => {
    m.admin = { ok: false, status };
    expect((await GET()).status).toBe(status);
    expect((await POST(json({ title: "x" }))).status).toBe(status);
    expect((await PATCH(json({ published: true }, "PATCH"), ctx())).status).toBe(status);
    expect((await DELETE(new Request("http://x/", { method: "DELETE" }), ctx())).status).toBe(status);
    expect(m.findMany).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
    expect(m.updateMany).not.toHaveBeenCalled();
    expect(m.deleteMany).not.toHaveBeenCalled();
  });
});

describe("admin", () => {
  it("POST cria com os dados validados (rascunho por padrão)", async () => {
    const r = await POST(json({ title: " Cidade solar " }));
    expect(r.status).toBe(201);
    expect(m.create.mock.calls[0][0].data).toMatchObject({ title: "Cidade solar", published: false, order: 0 });
  });
  it("POST inválido devolve 400 sem gravar", async () => {
    const r = await POST(json({ title: "" }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "titulo_obrigatorio" });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("PATCH publica; id inexistente ou malformado dá 404", async () => {
    expect((await PATCH(json({ published: true }, "PATCH"), ctx())).status).toBe(200);
    expect(m.updateMany.mock.calls[0][0]).toEqual({ where: { id: ID }, data: { published: true } });
    m.updateMany.mockResolvedValue({ count: 0 });
    expect((await PATCH(json({ published: true }, "PATCH"), ctx())).status).toBe(404);
    expect((await PATCH(json({ published: true }, "PATCH"), ctx("nao-e-id"))).status).toBe(404);
  });
  it("DELETE apaga; inexistente dá 404", async () => {
    expect((await DELETE(new Request("http://x/", { method: "DELETE" }), ctx())).status).toBe(200);
    m.deleteMany.mockResolvedValue({ count: 0 });
    expect((await DELETE(new Request("http://x/", { method: "DELETE" }), ctx())).status).toBe(404);
  });
});

describe("GET /api/blueprints (público)", () => {
  it("só pede os publicados e devolve só os campos do card", async () => {
    m.findMany.mockResolvedValue([{ id: ID, title: "T", description: null, imageUrl: null, href: null, tags: [] }]);
    const r = await PUBLICO();
    expect(m.findMany.mock.calls[0][0].where).toEqual({ published: true });
    expect(await r.json()).toEqual({ blueprints: [{ id: ID, title: "T", description: null, imageUrl: null, href: null, tags: [] }] });
  });
  it("banco fora do ar ⇒ lista vazia (a seção some)", async () => {
    m.findMany.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await (await PUBLICO()).json()).toEqual({ blueprints: [] });
  });
});
