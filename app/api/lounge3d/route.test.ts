import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ session: vi.fn(), userFind: vi.fn(), docFind: vi.fn(), docUpdate: vi.fn(), docCreate: vi.fn(), trigger: vi.fn(), get: vi.fn(), guard: vi.fn(), pusher: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: m.session }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/src/lib/ratelimit", () => ({ guard: m.guard }));
vi.mock("@/src/lib/prisma", () => ({ prisma: { user: { findUnique: m.userFind, findMany: async () => [] }, collabDoc: { findUnique: m.docFind, update: m.docUpdate, create: m.docCreate, findMany: async () => [] } } }));
vi.mock("@/lib/collab/realtime", () => ({ triggerSafe: m.trigger, getPusher: () => m.pusher() }));

import { PATCH, GET } from "./[id]/route";
import { POST as CHAT } from "./[id]/chat/route";
import { POST as AUTH } from "./[id]/pusher-auth/route";
import { POST as ACESSO } from "./[id]/acesso/route";
import { POST as TOPO } from "./[id]/topo/route";
import { POST as RECADO, DELETE as APAGAR_RECADO } from "./[id]/recado/route";

const ID = "0123456789abcdef01234567", ME = "aaaaaaaaaaaaaaaaaaaaaaaa", OUTRO = "bbbbbbbbbbbbbbbbbbbbbbbb";
const json = (b: unknown, method = "POST") => new Request("http://x/", { method, body: JSON.stringify(b), headers: { "Content-Type": "application/json" } });
const doc = (members = [ME]) => ({ id: ID, ownerId: ME, title: "Sala", kind: "lounge_canvas", content: JSON.stringify({ notes: [{ id: "n1", x: 0, z: 0, text: "velha" }], artifacts: [] }), members, token: "tok", updatedAt: new Date() });

describe("/api/lounge3d/[id]", () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    process.env.LOUNGE_3D = "1";
    m.pusher.mockImplementation(() => ({ get: m.get, authorizeChannel: (s: string, c: string, d: any) => ({ auth: `${s}:${c}`, channel_data: JSON.stringify(d) }) }));
    m.guard.mockResolvedValue({ ok: true });
    m.session.mockResolvedValue({ user: { email: "a@b.c" } });
    m.userFind.mockResolvedValue({ id: ME, name: "Ana", image: null });
  });

  it("sem flag a API responde (cyberespaço em produção); sem sessão → 401; não-membro → 404 (indistinguível de inexistente); kind errado → 404", async () => {
    delete process.env.LOUNGE_3D;
    m.session.mockResolvedValue(null);
    expect((await GET(new Request("http://x/"), { params: { id: ID } })).status).toBe(401);
    m.session.mockResolvedValue({ user: { email: "a@b.c" } });
    m.docFind.mockResolvedValue(doc([OUTRO]));
    expect((await GET(new Request("http://x/"), { params: { id: ID } })).status).toBe(404);
    m.docFind.mockResolvedValue({ ...doc(), kind: "study" });
    expect((await GET(new Request("http://x/"), { params: { id: ID } })).status).toBe(404);
  });

  it("GET devolve conteúdo saneado; token só pro dono", async () => {
    m.docFind.mockResolvedValue(doc([ME, OUTRO]));
    const d = await (await GET(new Request("http://x/"), { params: { id: ID } })).json();
    expect(d.sala.conteudo.notes[0].text).toBe("velha"); expect(d.sala.token).toBe("tok"); expect(d.eu.id).toBe(ME);
    m.docFind.mockResolvedValue({ ...doc([ME, OUTRO]), ownerId: OUTRO });
    expect((await (await GET(new Request("http://x/"), { params: { id: ID } })).json()).sala.token).toBeNull();
  });

  it("PATCH aplica por item, força autorId da SESSÃO, persiste e avisa a sala", async () => {
    m.docFind.mockResolvedValue(doc()); m.docUpdate.mockImplementation(async (a: any) => ({ title: a.data.title }));
    const r = await PATCH(json({ upsertNotes: [{ id: "n2", x: 1, z: 1, text: "nova", autorId: OUTRO }], removeNotes: ["n1"], title: "<b>Sala 2</b>" }, "PATCH"), { params: { id: ID } });
    const d = await r.json();
    expect(d.conteudo.notes).toEqual([{ id: "n2", x: 1, z: 1, kind: "nota", src: "Você", text: "nova", autorId: ME }]);
    expect(JSON.parse(m.docUpdate.mock.calls[0]![0].data.content).notes).toHaveLength(1);
    expect(m.trigger).toHaveBeenCalledWith(`presence-lounge3d-${ID}`, "conteudo", expect.objectContaining({ fromUserId: ME }));
  });

  it("chat: sanitiza, identidade da sessão, difunde; vazio → 400", async () => {
    m.docFind.mockResolvedValue(doc());
    expect((await CHAT(json({ texto: "   " }), { params: { id: ID } })).status).toBe(400);
    const d = await (await CHAT(json({ texto: "oi\u0000 <script>x</script>", userId: OUTRO, name: "hacker" }), { params: { id: ID } })).json();
    expect(d.msg).toMatchObject({ userId: ME, name: "Ana", texto: "oi <script>x</script>" }); // texto é dado; a UI renderiza como texto
    expect(m.trigger).toHaveBeenCalledWith(`presence-lounge3d-${ID}`, "chat", expect.objectContaining({ userId: ME }));
  });

  it("pusher-auth: canal de outra sala → 400; não-membro → 404; 5 dentro → 403 cheia; dentro reconecta; ok → auth com nome/cor", async () => {
    const form = (ch: string) => new Request("http://x/", { method: "POST", body: `socket_id=1.2&channel_name=${ch}`, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    m.docFind.mockResolvedValue(doc());
    expect((await AUTH(form(`presence-lounge3d-${OUTRO}`), { params: { id: ID } })).status).toBe(400);
    m.docFind.mockResolvedValue(doc([OUTRO]));
    expect((await AUTH(form(`presence-lounge3d-${ID}`), { params: { id: ID } })).status).toBe(404);
    m.docFind.mockResolvedValue(doc());
    m.get.mockResolvedValue({ ok: true, json: async () => ({ users: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }] }) });
    const cheia = await AUTH(form(`presence-lounge3d-${ID}`), { params: { id: ID } });
    expect(cheia.status).toBe(403); expect((await cheia.json()).motivo).toBe("cheia");
    m.get.mockResolvedValue({ ok: true, json: async () => ({ users: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: ME }] }) });
    expect((await AUTH(form(`presence-lounge3d-${ID}`), { params: { id: ID } })).status).toBe(200);
    m.get.mockResolvedValue({ ok: false, json: async () => ({}) }); // Pusher REST fora: não bloqueia a entrada
    const ok = await (await AUTH(form(`presence-lounge3d-${ID}`), { params: { id: ID } })).json();
    expect(JSON.parse(ok.channel_data)).toMatchObject({ user_id: ME, user_info: { name: "Ana" } });
  });

  it("pusher-auth: servidor sem credenciais do Pusher → 503 (o cliente mostra o motivo, não um 'indisponível' genérico)", async () => {
    m.pusher.mockImplementation(() => null);
    m.docFind.mockResolvedValue(doc());
    const r = await AUTH(new Request("http://x/", { method: "POST", body: `socket_id=1.2&channel_name=presence-lounge3d-${ID}`, headers: { "Content-Type": "application/x-www-form-urlencoded" } }), { params: { id: ID } });
    expect(r.status).toBe(503);
  });

  it("acesso privilegiado (topo/céu/nave): só o FUNDADOR (pela sessão) recebe 200; alvo inválido 400", async () => {
    const req = (alvo: string) => new Request("http://x/", { method: "POST", body: JSON.stringify({ alvo }), headers: { "Content-Type": "application/json" } });
    m.docFind.mockResolvedValue(doc());
    // Ana (a@b.c) não está na allowlist nem tem role → 403 em tudo
    for (const alvo of ["topo", "ceu", "nave"]) expect((await ACESSO(req(alvo), { params: { id: ID } })).status).toBe(403);
    expect((await ACESSO(req("voar-pelado"), { params: { id: ID } })).status).toBe(400);
    expect((await TOPO(new Request("http://x/", { method: "POST" }), { params: { id: ID } })).status).toBe(403);
    // fundador por role no banco → 200 (o cliente nunca decide)
    m.userFind.mockResolvedValue({ id: ME, name: "Ana", image: null, role: "super_admin" });
    for (const alvo of ["topo", "ceu", "nave"]) expect((await ACESSO(req(alvo), { params: { id: ID } })).status).toBe(200);
    expect((await TOPO(new Request("http://x/", { method: "POST" }), { params: { id: ID } })).status).toBe(200);
  });

  it("recado pro QG: só o FUNDADOR manda/apaga; autor da SESSÃO; persiste no conteúdo (sem perder as notas) e difunde", async () => {
    m.docFind.mockResolvedValue(doc());
    expect((await RECADO(json({ texto: "oi Andrei" }), { params: { id: ID } })).status).toBe(403);   // Ana não é dona
    expect((await APAGAR_RECADO(new Request("http://x/", { method: "DELETE" }), { params: { id: ID } })).status).toBe(403);
    expect(m.docUpdate).not.toHaveBeenCalled();
    m.userFind.mockResolvedValue({ id: ME, name: "Ana", image: null, role: "super_admin" });
    expect((await RECADO(json({ texto: "   " }), { params: { id: ID } })).status).toBe(400);
    const d = await (await RECADO(json({ texto: "reunião às 10h\u0000", deId: OUTRO, deNome: "hacker" }), { params: { id: ID } })).json();
    expect(d.recado).toMatchObject({ texto: "reunião às 10h", deId: ME, deNome: "Ana" });
    const salvo = JSON.parse(m.docUpdate.mock.calls[0]![0].data.content);
    expect(salvo.recadoQG.texto).toBe("reunião às 10h"); expect(salvo.notes[0].text).toBe("velha");   // as notas ficam
    expect(m.trigger).toHaveBeenCalledWith(`presence-lounge3d-${ID}`, "recado-qg", { recado: expect.objectContaining({ deId: ME }) });
    // apagar: some do conteúdo e avisa a sala
    m.docFind.mockResolvedValue({ ...doc(), content: m.docUpdate.mock.calls[0]![0].data.content });
    expect((await APAGAR_RECADO(new Request("http://x/", { method: "DELETE" }), { params: { id: ID } })).status).toBe(200);
    expect(JSON.parse(m.docUpdate.mock.calls[1]![0].data.content).recadoQG).toBeUndefined();
    expect(m.trigger).toHaveBeenLastCalledWith(`presence-lounge3d-${ID}`, "recado-qg", { recado: null });
  });
});
