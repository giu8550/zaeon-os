/** POST /api/canal/sino (#425): o "visto" e o "Limpar" do sino guardados no banco, por pessoa. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const A = "a".repeat(24), B = "b".repeat(24);
const state: { user: any; sinos: any[] } = { user: null, sinos: [] };

vi.mock("@/lib/canal/server", () => ({
  sessaoUsuario: async () => state.user,
  exigirFlag: () => null,
  prisma: {
    canalSino: {
      upsert: async ({ where, create, update }: any) => {
        const r = state.sinos.find((x) => x.userId === where.userId);
        if (r) { Object.assign(r, update); return r; }
        const novo = { ...create }; state.sinos.push(novo); return novo;
      },
    },
  },
}));

import { POST } from "./route";

const enviar = (body: unknown) => POST(new Request("http://x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));
const user = (id: string) => ({ id, name: "N", image: null, email: "e@x", role: null });

beforeEach(() => { state.sinos = []; state.user = user(A); vi.useRealTimers(); });

describe("sino no banco", () => {
  it("'visto' grava quando abriu, sem limpar nada", async () => {
    const j = await (await enviar({ acao: "visto" })).json();
    expect(j.ok).toBe(true);
    expect(j.sino.vistoEm).toBeTypeOf("number");
    expect(j.sino.limpoAte).toBeNull();
    expect(state.sinos).toHaveLength(1);
    expect(state.sinos[0].userId).toBe(A);
  });

  it("'limpar' grava até quando limpou e também conta como visto", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-16T22:00:00Z"));
    const j = await (await enviar({ acao: "limpar" })).json();
    expect(j.sino).toEqual({ vistoEm: +new Date("2026-10-16T22:00:00Z"), limpoAte: +new Date("2026-10-16T22:00:00Z") });
  });

  it("abrir de novo depois de limpar não apaga o 'limpo'", async () => {
    await enviar({ acao: "limpar" });
    const antes = state.sinos[0].limpoAte;
    await enviar({ acao: "visto" });
    expect(state.sinos).toHaveLength(1);
    expect(state.sinos[0].limpoAte).toBe(antes);
  });

  it("cada pessoa tem o seu registro", async () => {
    await enviar({ acao: "limpar" });
    state.user = user(B);
    await enviar({ acao: "visto" });
    expect(state.sinos.map((s) => [s.userId, s.limpoAte ? "limpo" : "-"])).toEqual([[A, "limpo"], [B, "-"]]);
  });

  it("ação inválida → 400 sem gravar; anônimo → 401", async () => {
    expect((await enviar({ acao: "apagar" })).status).toBe(400);
    expect((await enviar({})).status).toBe(400);
    state.user = null;
    expect((await enviar({ acao: "visto" })).status).toBe(401);
    expect(state.sinos).toHaveLength(0);
  });
});
