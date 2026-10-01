import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  email: "a@b.c" as string | null,
  findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), aplicar: vi.fn(),
}));
vi.mock("next-auth", () => ({ getServerSession: async () => (m.email ? { user: { email: m.email } } : null) }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/src/lib/prisma", () => ({
  prisma: {
    user: { findUnique: async () => ({ id: "u1" }) },
    researchWork: { findFirst: m.findFirst, findUnique: m.findUnique, update: m.update },
  },
}));
vi.mock("@/lib/tcc/store", () => ({ aplicarConteudoManual: m.aplicar }));

import { POST } from "@/app/api/research-works/route";

const post = (body: any) => POST(new Request("http://x/api/research-works", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  Object.values(m).forEach((f: any) => f?.mockReset?.());
  m.email = "a@b.c";
  m.findUnique.mockResolvedValue({ id: "w1", content: "# A\n\nnovo" });
  m.update.mockImplementation(async ({ data }: any) => ({ id: "w1", ...data }));
});

describe("POST /api/research-works — TCC cross-sala", () => {
  it("work COM seções: o autosave vira operações por seção (merge com a base), não sobrescreve o content", async () => {
    m.findFirst.mockResolvedValue({ id: "w1", secoes: [{ id: "a", titulo: "A", corpo: "" }] });
    m.aplicar.mockResolvedValue({ ok: true, tcc: {}, efeitos: [] });
    const r = await post({ id: "w1", title: "T", content: "# A\n\nnovo", tccBase: "# A\n" });
    expect(r.status).toBe(200);
    expect(m.aplicar).toHaveBeenCalledWith("w1", "u1", "# A\n\nnovo", "T", "# A\n");
    expect(m.update).not.toHaveBeenCalled();
    expect(await r.json()).toEqual({ id: "w1", content: "# A\n\nnovo" });
  });
  it("sem base manda undefined (último vence); conflito = 409; outra recusa = 400", async () => {
    m.findFirst.mockResolvedValue({ id: "w1", secoes: [] });
    m.aplicar.mockResolvedValueOnce({ ok: true, tcc: {}, efeitos: [] });
    await post({ id: "w1", content: "x" });
    expect(m.aplicar.mock.calls[0][4]).toBeUndefined();
    m.aplicar.mockResolvedValueOnce({ ok: false, reason: "conflict" });
    expect((await post({ id: "w1", content: "x" })).status).toBe(409);
    m.aplicar.mockResolvedValueOnce({ ok: false, reason: "invalid" });
    expect((await post({ id: "w1", content: "x" })).status).toBe(400);
  });
  it("work comum (sem seções) segue o caminho de sempre", async () => {
    m.findFirst.mockResolvedValue({ id: "w1", secoes: null });
    await post({ id: "w1", content: "texto" });
    expect(m.aplicar).not.toHaveBeenCalled();
    expect(m.update).toHaveBeenCalledWith({ where: { id: "w1" }, data: { content: "texto" } });
  });
  it("TCC sem content no corpo (só título/tipo) também segue o caminho de sempre", async () => {
    m.findFirst.mockResolvedValue({ id: "w1", secoes: [] });
    await post({ id: "w1", title: "novo" });
    expect(m.aplicar).not.toHaveBeenCalled();
  });
});
