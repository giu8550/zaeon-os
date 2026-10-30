/** POST /api/canal/[id]/parar (#635): gate, grava a linha "interrompeu", apaga o balão de quem escrevia. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const A = "a".repeat(24), B = "b".repeat(24), C = "c".repeat(24), CANAL = "d".repeat(24);
const state: { canal: any; user: any; publicados: any[]; gravadas: any[] } = { canal: null, user: null, publicados: [], gravadas: [] };

vi.mock("@/lib/canal/server", () => ({
  isObjectId: (v: unknown) => typeof v === "string" && /^[a-f0-9]{24}$/i.test(v),
  sessaoUsuario: async () => state.user,
  exigirFlag: () => null,
  prisma: {
    canal: { findUnique: async ({ where }: any) => (where.id === state.canal?.id ? state.canal : null) },
    canalMensagem: { create: async ({ data }: any) => { state.gravadas.push(data); return { id: "m1", ...data, createdAt: new Date("2026-10-28T12:00:00Z") }; } },
  },
}));
vi.mock("@/lib/canal/realtime", async () => {
  const real = await vi.importActual<typeof import("@/lib/canal/realtime")>("@/lib/canal/realtime");
  return { ...real, publicarPusher: async (c: string, ev: string, p: unknown) => { state.publicados.push([c, ev, p]); } };
});

import { POST } from "./route";

const parar = (corpo: unknown = {}, id = CANAL) => POST(new Request("http://x", { method: "POST", body: JSON.stringify(corpo) }), { params: { id } });
const user = (id: string, name = "Giulia") => ({ id, name, image: null, email: "e@x", role: null });

beforeEach(() => {
  state.publicados = []; state.gravadas = [];
  state.canal = { id: CANAL, ownerId: A, acesso: "turma", membros: [B] };
  state.user = user(A);
});

describe("parar", () => {
  it("grava 'Giulia interrompeu a resposta' (sistema, autor 'parar') e apaga o balão de quem escrevia", async () => {
    const r = await parar({ agentes: ["teo", "aura"] });
    expect(r.status).toBe(200);
    expect(state.gravadas).toEqual([{ canalId: CANAL, autorTipo: "sistema", autorId: "parar", texto: "Giulia interrompeu a resposta", mencoes: [] }]);
    expect(state.publicados.map(([, ev, p]) => [ev, (p as any).autorId ?? (p as any).agentKey, (p as any).estado])).toEqual([
      ["mensagem", "parar", undefined], ["agente-digitando", "teo", "ocioso"], ["agente-digitando", "aura", "ocioso"],
    ]);
  });
  it("#645: o aviso do ■ leva a marca 'parou' (a tela não solta a agente com ele)", async () => {
    await parar({ agentes: ["teo"] });
    expect(state.publicados.find(([, ev]) => ev === "agente-digitando")![2]).toEqual({ agentKey: "teo", estado: "ocioso", parou: true });
  });
  it("lixo em `agentes` é ignorado", async () => {
    await parar({ agentes: ["teo", 3, "<script>", "x".repeat(60)] });
    expect(state.publicados.filter(([, ev]) => ev === "agente-digitando").map(([, , p]) => (p as any).agentKey)).toEqual(["teo"]);
  });
  it("gate: quem não é do canal não para (403); sem login 401; canal que não existe 404", async () => {
    state.user = user(C);
    expect((await parar()).status).toBe(403);
    state.user = null;
    expect((await parar()).status).toBe(401);
    state.user = user(A);
    expect((await parar({}, "e".repeat(24))).status).toBe(404);
    expect(state.gravadas).toEqual([]);
  });
});
