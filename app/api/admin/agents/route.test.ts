/** Gate do gateway de agentes: flag desligada 404; não-admin 403; anônimo 401; admin lista com uso. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sessao = vi.fn();
vi.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => sessao(...a) }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/src/lib/prisma", () => ({
  prisma: {
    mentorTemplate: { findMany: async () => [], findUnique: async () => null, create: async (a: any) => a.data },
    agentProfile: {
      findMany: async () => [{ agentKey: "aura", tipo: "persona", nome: "Aura", avatarUrl: "https://x/a.png", bio: null, ativo: true, ordem: 0 }],
      findUnique: async () => null,
      create: async (a: any) => ({ id: "p1", ...a.data }),
    },
    agentUsage: { findMany: async () => [
      { agentKey: "aura", userId: "1".repeat(24), contagem: 3, ultimoUso: new Date("2026-09-01T00:00:00Z") },
      { agentKey: "aura", userId: "2".repeat(24), contagem: 7, ultimoUso: new Date("2026-09-02T00:00:00Z") },
    ] },
    user: { findMany: async () => [{ id: "2".repeat(24), name: "Bia", email: "bia@x" }] },
  },
}));

import { GET, POST, validarAvatar } from "./route";

const prev = process.env.NEXT_PUBLIC_AGENTS_ADMIN;
beforeEach(() => { process.env.NEXT_PUBLIC_AGENTS_ADMIN = "1"; });
afterEach(() => { if (prev === undefined) delete process.env.NEXT_PUBLIC_AGENTS_ADMIN; else process.env.NEXT_PUBLIC_AGENTS_ADMIN = prev; });

describe("/api/admin/agents · gate", () => {
  it("flag off → 404 mesmo pra admin", async () => {
    delete process.env.NEXT_PUBLIC_AGENTS_ADMIN;
    sessao.mockResolvedValue({ user: { email: "donmartinezcaiudoceu@gmail.com" } });
    expect((await GET()).status).toBe(404);
  });
  it("anônimo 401 / não-admin 403", async () => {
    sessao.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    sessao.mockResolvedValue({ user: { email: "aluno@x.com", role: "student" } });
    expect((await GET()).status).toBe(403);
    expect((await POST(new Request("http://x", { method: "POST", body: "{}" }))).status).toBe(403);
  });
  it("admin: lista roster + profile + uso agregado com nome do top usuário", async () => {
    sessao.mockResolvedValue({ user: { email: "donmartinezcaiudoceu@gmail.com" } });
    const r = await GET();
    expect(r.status).toBe(200);
    const { agentes } = await r.json();
    const aura = agentes.find((a: any) => a.agentKey === "aura");
    expect(aura.avatarUrl).toBe("https://x/a.png");
    expect(aura.uso.total).toBe(10);
    expect(aura.uso.usuarios).toBe(2);
    expect(aura.uso.top[0]).toMatchObject({ userId: "2".repeat(24), contagem: 7, nome: "Bia", email: "bia@x" });
    expect(agentes.find((a: any) => a.agentKey === "medicina").uso.total).toBe(0);
  });
  it("POST cria persona custom; mentor novo exige curso+personaText; chave inválida 400", async () => {
    sessao.mockResolvedValue({ user: { email: "donmartinezcaiudoceu@gmail.com" } });
    const post = (b: unknown) => POST(new Request("http://x", { method: "POST", body: JSON.stringify(b) }));
    expect((await post({ agentKey: "Bad Key", nome: "x" })).status).toBe(400);
    expect((await post({ agentKey: "novo", tipo: "mentor", nome: "Novo" })).status).toBe(400);
    const ok = await post({ agentKey: "novo", tipo: "persona", nome: "Novo", bio: "oi", avatarUrl: "https://x/n.png" });
    expect(ok.status).toBe(201);
    expect((await ok.json()).profile).toMatchObject({ agentKey: "novo", tipo: "persona", nome: "Novo", avatarUrl: "https://x/n.png" });
    expect((await post({ agentKey: "novo2", nome: "N", avatarUrl: "javascript:alert(1)" })).status).toBe(400);
  });
});

describe("validarAvatar", () => {
  it("aceita data:image, https e caminho local; rejeita o resto", () => {
    expect(validarAvatar("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(validarAvatar("https://a/b.png")).toBe("https://a/b.png");
    expect(validarAvatar("/agents/aura.png")).toBe("/agents/aura.png");
    expect(validarAvatar(null)).toBeNull();
    expect(validarAvatar("")).toBeNull();
    expect(validarAvatar("http://insecure/x.png")).toBeUndefined();
    expect(validarAvatar("data:text/html;base64,AAAA")).toBeUndefined();
    expect(validarAvatar(42)).toBeUndefined();
  });
});
