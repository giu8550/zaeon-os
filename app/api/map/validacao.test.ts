import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  user: vi.fn(), guard: vi.fn(), getMapaForUser: vi.fn(), patchMapa: vi.fn(),
  valFind: vi.fn(), mapaFind: vi.fn(), aplicarNo: vi.fn(), decidir: vi.fn(), verificador: vi.fn(), vinculado: vi.fn(),
}));
vi.mock("@/lib/agent/transcript", () => ({ resolveUserId: m.user }));
vi.mock("@/src/lib/ratelimit", () => ({ guard: m.guard }));
vi.mock("@/lib/map/store", async (o) => ({ ...(await o<any>()), getMapaForUser: m.getMapaForUser, patchMapa: m.patchMapa }));
vi.mock("@/lib/map/validacao", async (o) => ({ ...(await o<any>()), aplicarNo: m.aplicarNo, decidirValidacao: m.decidir }));
vi.mock("@/lib/map/validacao-server", () => ({ depsReais: () => ({}), OID: /^[a-f0-9]{24}$/i, verificadorAtual: m.verificador, vinculadoAoAluno: m.vinculado }));
vi.mock("@/src/lib/prisma", () => ({ prisma: { mapaValidacao: { findUnique: m.valFind }, mapaProbabilistico: { findUnique: m.mapaFind } } }));

import { POST as APPLY } from "./[id]/node/[noId]/apply/route";
import { POST as DECIDIR } from "./validacao/[vId]/route";
import { PATCH } from "./[id]/route";

const ID = "0123456789abcdef01234567", VID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const req = (b: unknown) => new Request("http://x/", { method: "POST", body: JSON.stringify(b), headers: { "Content-Type": "application/json" } });
const mapa = { id: ID, ownerId: "u1", nos: [{ id: "k_1", label: "A", tipo: "conceito", estado: "aprendido", peso: 1, msgIds: [] }], backbone: ["k_1"], modoValidacao: "humana", tipoTopico: "aplicavel" };

describe("rotas de validação", () => {
  beforeEach(() => { Object.values(m).forEach((f) => f.mockReset()); process.env.MAP_HARNESS = "1"; m.guard.mockResolvedValue({ ok: true }); m.user.mockResolvedValue("u1"); });

  it("apply: só o DONO (editor/leitor → 403); sem professor → 409; ok → 201 com validação", async () => {
    m.getMapaForUser.mockResolvedValue({ mapa, papel: "editor" });
    expect((await APPLY(req({ evidencia: "x" }), { params: { id: ID, noId: "k_1" } })).status).toBe(403);
    m.getMapaForUser.mockResolvedValue({ mapa, papel: "dono" });
    m.aplicarNo.mockResolvedValue({ ok: false, motivo: "sem_professor" });
    expect((await APPLY(req({}), { params: { id: ID, noId: "k_1" } })).status).toBe(409);
    m.aplicarNo.mockResolvedValue({ ok: true, mapa, validacao: { id: VID, status: "pendente" }, estado: "aplicado" });
    const r = await APPLY(req({ evidencia: "laudo", validadorId: "zz" }), { params: { id: ID, noId: "k_1" } });
    expect(r.status).toBe(201);
    expect(m.aplicarNo.mock.calls.at(-1)!.slice(2)).toEqual(["k_1", "laudo", null]); // validadorId inválido vira null
    m.getMapaForUser.mockResolvedValue(null);
    expect((await APPLY(req({}), { params: { id: ID, noId: "k_1" } })).status).toBe(404);
  });

  it("decidir: endereçada a outro → 404; próprio aluno → 403; sem vínculo → 403; ok → aprova", async () => {
    m.valFind.mockResolvedValue({ id: VID, mapaId: ID, noId: "k_1", alunoId: "u1", validadorId: "prof", status: "pendente" });
    m.verificador.mockResolvedValue({ id: "outro", role: "teacher", verificadorHabilitado: true, temCredencialVerificada: false, institution: null });
    expect((await DECIDIR(req({ status: "aprovada" }), { params: { vId: VID } })).status).toBe(404);
    m.valFind.mockResolvedValue({ id: VID, mapaId: ID, noId: "k_1", alunoId: "u1", validadorId: "u1", status: "pendente" });
    m.verificador.mockResolvedValue({ id: "u1", role: "teacher", verificadorHabilitado: true, temCredencialVerificada: false, institution: null });
    m.vinculado.mockResolvedValue(true);
    const self = await DECIDIR(req({ status: "aprovada" }), { params: { vId: VID } });
    expect(self.status).toBe(403); expect((await self.json()).motivo).toBe("conflito");
    m.valFind.mockResolvedValue({ id: VID, mapaId: ID, noId: "k_1", alunoId: "u1", validadorId: "prof", status: "pendente" });
    m.verificador.mockResolvedValue({ id: "prof", role: "teacher", verificadorHabilitado: true, temCredencialVerificada: false, institution: null });
    m.vinculado.mockResolvedValue(false);
    expect((await DECIDIR(req({ status: "aprovada" }), { params: { vId: VID } })).status).toBe(403);
    m.vinculado.mockResolvedValue(true);
    expect((await DECIDIR(req({ status: "talvez" }), { params: { vId: VID } })).status).toBe(400);
    m.mapaFind.mockResolvedValue({ id: ID, ownerId: "u1", nos: [], arestas: [], backbone: [], rev: 0 });
    m.decidir.mockResolvedValue({ ok: true, validacao: { status: "aprovada" }, estado: "validado", credentialId: "c1", mapa: { completudeConclusao: 1 } });
    const ok = await DECIDIR(req({ status: "aprovada", comentario: "bom" }), { params: { vId: VID } });
    expect(await ok.json()).toMatchObject({ ok: true, estado: "validado", credentialId: "c1" });
    expect(m.decidir.mock.calls[0]!.slice(3)).toEqual(["aprovada", "bom"]);
    m.decidir.mockResolvedValue({ ok: false, motivo: "ja_decidida" });
    expect((await DECIDIR(req({ status: "rejeitada" }), { params: { vId: VID } })).status).toBe(409);
  });

  it("PATCH: aluno só avança pra 'aprendido' (nunca validado) e acrescenta msgIds; leitor → 403", async () => {
    m.getMapaForUser.mockResolvedValue({ mapa, papel: "leitor" });
    expect((await PATCH(new Request("http://x/", { method: "PATCH", body: JSON.stringify({ noId: "k_1", estado: "aprendido" }) }), { params: { id: ID } })).status).toBe(403);
    m.getMapaForUser.mockResolvedValue({ mapa, papel: "dono" });
    expect((await PATCH(new Request("http://x/", { method: "PATCH", body: JSON.stringify({ noId: "k_1", estado: "validado" }) }), { params: { id: ID } })).status).toBe(400);
    m.patchMapa.mockImplementation(async (_id: string, fn: any) => ({ ok: true, mapa: { ...mapa, ...fn({ ...mapa, nos: mapa.nos.map((n) => ({ ...n, estado: "a_conquistar" })) }) } }));
    const r = await PATCH(new Request("http://x/", { method: "PATCH", body: JSON.stringify({ noId: "k_1", estado: "aprendido", msgIds: ["m9", "bad id"] }) }), { params: { id: ID } });
    const d = await r.json();
    expect(d.mapa.nos[0]).toMatchObject({ estado: "aprendido", msgIds: ["m9"] });
  });
});
