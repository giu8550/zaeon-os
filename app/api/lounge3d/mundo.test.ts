import { describe, it, expect, vi, beforeEach } from "vitest";

// o MUNDO: todos no MESMO servidor do cyberespaço (a sala do fundador). Bug: a Giulia e o dono não se viam — cada
// um caía na própria sala.
const m = vi.hoisted(() => ({ session: vi.fn(), userFind: vi.fn(), userFindMany: vi.fn(), docFind: vi.fn(), docFindMany: vi.fn(), docUpdate: vi.fn(), guard: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: m.session }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/src/lib/ratelimit", () => ({ guard: m.guard }));
vi.mock("@/lib/auth/roles", () => ({ SUPER_ADMINS: ["dono@zaeon.com"], SUPER_ADMIN_ROLE: "super_admin", isSuperAdmin: ({ email }: { email?: string }) => email === "dono@zaeon.com" }));
vi.mock("@/src/lib/prisma", () => ({ prisma: { user: { findUnique: m.userFind, findMany: m.userFindMany }, collabDoc: { findUnique: m.docFind, findMany: m.docFindMany, update: m.docUpdate } } }));

import { POST as MUNDO } from "./mundo/route";

const MUNDO_ID = "0123456789abcdef01234567", DONO = "aaaaaaaaaaaaaaaaaaaaaaaa", GIULIA = "cccccccccccccccccccccccc";
const req = () => new Request("http://x/", { method: "POST" });

describe("POST /api/lounge3d/mundo — o servidor único do cyberespaço", () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    delete process.env.CYBER_MUNDO_SALA_ID;
    m.guard.mockResolvedValue({ ok: true });
    m.session.mockResolvedValue({ user: { email: "giulia@zaeon.com" } });
    m.userFind.mockResolvedValue({ id: GIULIA, name: "Giulia Fernanda", image: null });
    m.userFindMany.mockResolvedValue([{ id: DONO }]);
    m.docFindMany.mockResolvedValue([{ id: MUNDO_ID, members: [DONO] }]);
  });

  it("quem entra cai na sala do FUNDADOR e vira membro dela (uma vez só)", async () => {
    const r = await MUNDO(req());
    expect(r.status).toBe(200); expect(await r.json()).toEqual({ id: MUNDO_ID });
    expect(m.docFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ kind: "lounge_canvas", ownerId: { in: [DONO] } }), orderBy: { updatedAt: "desc" } }));
    expect(m.docUpdate).toHaveBeenCalledWith({ where: { id: MUNDO_ID }, data: { members: { push: GIULIA } } });
    // já é membro: não duplica
    m.docUpdate.mockReset(); m.docFindMany.mockResolvedValue([{ id: MUNDO_ID, members: [DONO, GIULIA] }]);
    expect((await (await MUNDO(req())).json()).id).toBe(MUNDO_ID); expect(m.docUpdate).not.toHaveBeenCalled();
  });
  it("o dono e a Giulia recebem a MESMA sala", async () => {
    const a = await (await MUNDO(req())).json();
    m.session.mockResolvedValue({ user: { email: "dono@zaeon.com" } }); m.userFind.mockResolvedValue({ id: DONO, name: "Dono", image: null });
    const b = await (await MUNDO(req())).json();
    expect(a.id).toBe(b.id);
  });
  it("entre as salas dos fundadores, vale a com MAIS membros (uma sala de teste mais recente não rouba o mundo)", async () => {
    m.docFindMany.mockResolvedValue([{ id: "bbbbbbbbbbbbbbbbbbbbbbbb", members: [DONO] }, { id: MUNDO_ID, members: [DONO, GIULIA, "x", "y"] }]);
    expect((await (await MUNDO(req())).json()).id).toBe(MUNDO_ID);
  });
  it("CYBER_MUNDO_SALA_ID fixa a sala; sem fundador com sala → 404 (o cliente cai na sala própria); sem sessão → 401", async () => {
    process.env.CYBER_MUNDO_SALA_ID = "fedcba9876543210fedcba98";
    m.docFind.mockResolvedValue({ id: "fedcba9876543210fedcba98", kind: "lounge_canvas", members: [GIULIA] });
    expect((await (await MUNDO(req())).json()).id).toBe("fedcba9876543210fedcba98");
    delete process.env.CYBER_MUNDO_SALA_ID;
    m.docFindMany.mockResolvedValue([]); expect((await MUNDO(req())).status).toBe(404);
    m.session.mockResolvedValue(null); expect((await MUNDO(req())).status).toBe(401);
  });
});
