/** POST /api/canal/[id]/digitando (#423): gate, repassa pelo tempo real, limite por pessoa, não grava nada. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const A = "a".repeat(24), B = "b".repeat(24), C = "c".repeat(24), CANAL = "d".repeat(24);
const state: { canal: any; user: any; publicados: any[]; gravou: number } = { canal: null, user: null, publicados: [], gravou: 0 };

vi.mock("@/lib/canal/server", () => ({
  isObjectId: (v: unknown) => typeof v === "string" && /^[a-f0-9]{24}$/i.test(v),
  sessaoUsuario: async () => state.user,
  exigirFlag: () => null,
  prisma: {
    canal: { findUnique: async ({ where }: any) => (where.id === state.canal?.id ? state.canal : null) },
    canalMensagem: { create: async () => { state.gravou++; return {}; } },
  },
}));
vi.mock("@/lib/canal/realtime", async () => {
  const real = await vi.importActual<typeof import("@/lib/canal/realtime")>("@/lib/canal/realtime");
  return { ...real, publicarPusher: async (c: string, ev: string, p: unknown) => { state.publicados.push([c, ev, p]); } };
});

import { POST, _limparLimite } from "./route";

const avisar = (id = CANAL) => POST(new Request("http://x", { method: "POST" }), { params: { id } });
const user = (id: string, name = "Giulia") => ({ id, name, image: null, email: "e@x", role: null });

beforeEach(() => {
  _limparLimite(); state.publicados = []; state.gravou = 0;
  state.canal = { id: CANAL, ownerId: A, acesso: "turma", membros: [B] };
  state.user = user(A);
});

describe("digitando", () => {
  it("repassa 'humano-digitando' com quem está digitando, e não grava nada no chat", async () => {
    const r = await avisar();
    expect(await r.json()).toEqual({ ok: true, enviado: true });
    expect(state.publicados).toEqual([[CANAL, "humano-digitando", { userId: A, nome: "Giulia" }]]);
    expect(state.gravou).toBe(0);
  });

  it("limite: dois avisos seguidos da mesma pessoa → só o primeiro sai", async () => {
    await avisar();
    const r = await avisar();
    expect(await r.json()).toEqual({ ok: true, enviado: false });
    expect(state.publicados).toHaveLength(1);
  });

  it("outra pessoa do canal não é barrada pelo limite da primeira", async () => {
    await avisar();
    state.user = user(B, "Martinez");
    await avisar();
    expect(state.publicados.map((p) => p[2].userId)).toEqual([A, B]);
  });

  it("quem não pode escrever no canal: 403 e nada publicado", async () => {
    state.user = user(C);
    expect((await avisar()).status).toBe(403);
    expect(state.publicados).toHaveLength(0);
  });

  it("anônimo 401; canal inexistente ou id inválido 404", async () => {
    state.user = null;
    expect((await avisar()).status).toBe(401);
    state.user = user(A);
    expect((await avisar("e".repeat(24))).status).toBe(404);
    expect((await avisar("nope")).status).toBe(404);
  });
});
