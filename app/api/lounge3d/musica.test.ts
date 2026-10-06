import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ session: vi.fn(), userFind: vi.fn(), docFind: vi.fn(), docUpdate: vi.fn(), trigger: vi.fn(), guard: vi.fn(), escrever: vi.fn(), ler: vi.fn(), apagar: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: m.session }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/src/lib/ratelimit", () => ({ guard: m.guard }));
vi.mock("@/src/lib/prisma", () => ({ prisma: { user: { findUnique: m.userFind, findMany: async () => [] }, collabDoc: { findUnique: m.docFind, update: m.docUpdate } } }));
vi.mock("@/lib/collab/realtime", () => ({ triggerSafe: m.trigger }));
vi.mock("@/lib/studio/storage", () => ({ writeStudioFile: m.escrever, readStudioFile: m.ler, deleteStudioFile: m.apagar }));

import { POST, PATCH, DELETE } from "./[id]/musica/route";
import { GET as ARQUIVO } from "./[id]/musica/[arq]/route";
import { DELETE as APAGAR_RECADO } from "./[id]/recado/route";

const ID = "0123456789abcdef01234567", ME = "aaaaaaaaaaaaaaaaaaaaaaaa";
let conteudo: Record<string, unknown> = {};
const doc = () => ({ id: ID, ownerId: ME, title: "Sala", kind: "lounge_canvas", content: JSON.stringify(conteudo), members: [ME], token: "tok", updatedAt: new Date() });
const subir = (nome = "Minha Música.mp3", tipo = "audio/mpeg", bytes = 1000, dur = "180") => { const f = new FormData(); f.append("file", new File([new Uint8Array(bytes)], nome, { type: tipo })); f.append("dur", dur); return new Request("http://x/", { method: "POST", body: f }); };
const p = { params: { id: ID } };

describe("/api/lounge3d/[id]/musica (toca-discos do lounge)", () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    process.env.LOUNGE_3D = "1"; conteudo = { notes: [{ id: "n1", x: 0, z: 0, text: "nota" }], artifacts: [] };
    m.guard.mockResolvedValue({ ok: true });
    m.session.mockResolvedValue({ user: { email: "a@b.c" } });
    m.userFind.mockResolvedValue({ id: ME, name: "Ana", image: null, role: "super_admin" });   // o DONO
    m.docFind.mockImplementation(async () => doc());
    m.docUpdate.mockImplementation(async (a: { data: { content: string } }) => { conteudo = JSON.parse(a.data.content); return {}; });
  });

  it("só o DONO sobe/controla/tira (403 pros outros)", async () => {
    m.userFind.mockResolvedValue({ id: ME, name: "Ana", image: null });
    expect((await POST(subir(), p)).status).toBe(403);
    expect((await PATCH(new Request("http://x/", { method: "PATCH", body: JSON.stringify({ acao: "tocar" }) }), p)).status).toBe(403);
    expect((await DELETE(new Request("http://x/?faixa=x", { method: "DELETE" }), p)).status).toBe(403);
    expect(m.escrever).not.toHaveBeenCalled();
  });
  it("sobe: guarda o arquivo com nome do SERVIDOR, a 1ª já toca, persiste (sem apagar as notas) e difunde com o relógio", async () => {
    const r = await POST(subir(), p), d = await r.json();
    expect(r.status).toBe(200);
    const [id, ext] = m.escrever.mock.calls[0]!; expect(String(id)).toMatch(/^lm_[a-f0-9]{20}$/); expect(ext).toBe("mp3");
    expect(d.som.faixas[0]).toMatchObject({ nome: "Minha Música", dur: 180, arq: `${id}.mp3` }); expect(d.som.estado.tocando).toBe(true);
    expect((conteudo.notes as unknown[]).length).toBe(1); expect((conteudo.somLounge as { faixas: unknown[] }).faixas).toHaveLength(1);
    expect(m.trigger).toHaveBeenCalledWith(`presence-lounge3d-${ID}`, "musica-lounge", expect.objectContaining({ agora: expect.any(Number) }));
  });
  it("disco sem permissão (EACCES): responde com o motivo (507), não um 500 mudo, e não mexe na playlist", async () => {
    m.escrever.mockRejectedValueOnce(Object.assign(new Error("EACCES: permission denied, mkdir '/app/.studio'"), { code: "EACCES" }));
    const r = await POST(subir(), p);
    expect(r.status).toBe(507); expect((await r.json()).error).toMatch(/permissão/);
    expect(m.docUpdate).not.toHaveBeenCalled();
  });
  it("recusa formato estranho e arquivo grande demais", async () => {
    expect((await POST(subir("virus.exe", "application/x-msdownload"), p)).status).toBe(415);
    expect((await POST(subir("grande.mp3", "audio/mpeg", 21 * 1024 * 1024), p)).status).toBe(413);
  });
  it("controla (pausar/próxima) e tira faixa (apaga o arquivo)", async () => {
    await POST(subir("a.mp3"), p); await POST(subir("b.ogg", "audio/ogg"), p);
    let d = await (await PATCH(new Request("http://x/", { method: "PATCH", body: JSON.stringify({ acao: "proxima" }) }), p)).json();
    expect(d.som.estado.i).toBe(1);
    d = await (await PATCH(new Request("http://x/", { method: "PATCH", body: JSON.stringify({ acao: "pausar" }) }), p)).json();
    expect(d.som.estado.tocando).toBe(false);
    expect((await PATCH(new Request("http://x/", { method: "PATCH", body: JSON.stringify({ acao: "explodir" }) }), p)).status).toBe(400);
    const alvo = d.som.faixas[0];
    d = await (await DELETE(new Request(`http://x/?faixa=${alvo.id}`, { method: "DELETE" }), p)).json();
    expect(d.som.faixas).toHaveLength(1); expect(m.apagar).toHaveBeenCalledWith(alvo.arq.split(".")[0], alvo.arq.split(".")[1]);
    expect((await DELETE(new Request("http://x/?faixa=naoexiste", { method: "DELETE" }), p)).status).toBe(404);
  });
  it("serve a música só pra quem é da sala e só se estiver na playlist; com Range (206)", async () => {
    await POST(subir(), p);
    const arq = (conteudo.somLounge as { faixas: { arq: string }[] }).faixas[0]!.arq;
    m.ler.mockResolvedValue(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    const tudo = await ARQUIVO(new Request("http://x/"), { params: { id: ID, arq } });
    expect(tudo.status).toBe(200); expect(tudo.headers.get("Accept-Ranges")).toBe("bytes"); expect(tudo.headers.get("Content-Type")).toBe("audio/mpeg");
    const parte = await ARQUIVO(new Request("http://x/", { headers: { range: "bytes=2-5" } }), { params: { id: ID, arq } });
    expect(parte.status).toBe(206); expect(parte.headers.get("Content-Range")).toBe("bytes 2-5/10"); expect([...new Uint8Array(await parte.arrayBuffer())]).toEqual([3, 4, 5, 6]);
    expect((await ARQUIVO(new Request("http://x/"), { params: { id: ID, arq: "lm_ffffffffffffffffffff.mp3" } })).status).toBe(404);   // não está na playlist
    expect((await ARQUIVO(new Request("http://x/"), { params: { id: ID, arq: "../../etc/passwd" } })).status).toBe(400);
  });
  it("apagar o recado do QG não apaga a playlist", async () => {
    await POST(subir(), p);
    conteudo.recadoQG = { id: "r1", texto: "oi", deId: ME, deNome: "Ana", deCor: "#ffffff", ts: 1 };
    await APAGAR_RECADO(new Request("http://x/", { method: "DELETE" }), p);
    expect(conteudo.recadoQG).toBeUndefined(); expect((conteudo.somLounge as { faixas: unknown[] }).faixas).toHaveLength(1);
  });
});
