import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ session: vi.fn(), userFind: vi.fn(), docFind: vi.fn(), docUpdate: vi.fn(), trigger: vi.fn(), guard: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: m.session }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/src/lib/ratelimit", () => ({ guard: m.guard }));
vi.mock("@/src/lib/prisma", () => ({ prisma: { user: { findUnique: m.userFind, findMany: async () => [] }, collabDoc: { findUnique: m.docFind, update: m.docUpdate } } }));
vi.mock("@/lib/collab/realtime", () => ({ triggerSafe: m.trigger }));

import { PATCH } from "./[id]/ritual/route";
import { lerConteudo } from "@/lib/lounge3d/sala";

const ID = "0123456789abcdef01234567", ME = "aaaaaaaaaaaaaaaaaaaaaaaa";
let conteudo: Record<string, unknown> = {};
const doc = () => ({ id: ID, ownerId: ME, title: "Sala", kind: "lounge_canvas", content: JSON.stringify(conteudo), members: [ME], token: "tok", updatedAt: new Date() });
const req = (b: unknown) => new Request("http://x/", { method: "PATCH", body: JSON.stringify(b), headers: { "Content-Type": "application/json" } });
const p = { params: { id: ID } };

describe("/api/lounge3d/[id]/ritual (a call do ritual da chegada do dono)", () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    process.env.LOUNGE_3D = "1"; conteudo = { notes: [{ id: "n1", x: 0, z: 0, text: "nota" }], artifacts: [], somLounge: { faixas: [{ id: "f1aaaaaa", nome: "x", arq: "lm_00000000000000000000.mp3", dur: 10, deId: ME }], estado: { i: 0, tocando: true, desde: 1, pos: 0 } } };
    m.guard.mockResolvedValue({ ok: true });
    m.session.mockResolvedValue({ user: { email: "a@b.c" } });
    m.userFind.mockResolvedValue({ id: ME, name: "Ana", image: null, role: "super_admin" });
    m.docFind.mockImplementation(async () => doc());
    m.docUpdate.mockImplementation(async (a: { data: { content: string } }) => { conteudo = JSON.parse(a.data.content); return {}; });
  });
  it("só o DONO (403 pros outros); corpo sem nada pra mudar → 400", async () => {
    m.userFind.mockResolvedValue({ id: ME, name: "Ana", image: null });
    expect((await PATCH(req({ tempestade: true }), p)).status).toBe(403);
    m.userFind.mockResolvedValue({ id: ME, name: "Ana", image: null, role: "super_admin" });
    expect((await PATCH(req({}), p)).status).toBe(400);
    expect(m.docUpdate).not.toHaveBeenCalled();
  });
  it("liga a tempestade com o RELÓGIO DO SERVIDOR (e não recomeça se já estava ligada), solta os droids, persiste sem apagar o resto e difunde", async () => {
    const t0 = Date.now();
    const d = await (await PATCH(req({ tempestade: true }), p)).json();
    expect(d.ok).toBe(true); expect(d.ritual.tempestade).toBeGreaterThanOrEqual(t0); expect(d.ritual.droids).toBe(false); expect(typeof d.agora).toBe("number");
    const salvo = lerConteudo(JSON.stringify(conteudo));
    expect(salvo.ritual).toEqual(d.ritual); expect(salvo.somLounge?.faixas).toHaveLength(1); expect(salvo.notes).toHaveLength(1);
    expect(m.trigger).toHaveBeenCalledWith(`presence-lounge3d-${ID}`, "ritual", expect.objectContaining({ ritual: d.ritual, agora: expect.any(Number) }));
    const d2 = await (await PATCH(req({ droids: true, tempestade: true }), p)).json();
    expect(d2.ritual).toEqual({ tempestade: d.ritual.tempestade, droids: true, veu: 0 });   // a formação não recomeça
    const dv = await (await PATCH(req({ veu: true }), p)).json();
    expect(dv.ritual.veu).toBeGreaterThanOrEqual(t0); expect((await (await PATCH(req({ veu: true }), p)).json()).ritual.veu).toBe(dv.ritual.veu);   // o evento não repete
    const d3 = await (await PATCH(req({ tempestade: false }), p)).json();
    expect(d3.ritual).toEqual({ tempestade: 0, droids: true, veu: 0 });   // sem tempestade, o véu volta
    const d4 = await (await PATCH(req({ droids: false }), p)).json();
    expect(d4.ritual).toEqual({ tempestade: 0, droids: false, veu: 0 });
    expect(lerConteudo(JSON.stringify(conteudo)).ritual).toBeUndefined();   // desligado de vez: some do conteúdo
  });
});
