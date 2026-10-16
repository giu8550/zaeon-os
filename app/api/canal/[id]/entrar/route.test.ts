/**
 * POST /api/canal/[id]/entrar — entrar num canal ABERTO vira membro e (#423) gera a linha
 * "fulano entrou no escritório" no chat. Prisma/sessão/Pusher mockados.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const A = "a".repeat(24), B = "b".repeat(24), CANAL = "d".repeat(24);
const state: { canal: any; user: any; criadas: any[]; publicados: any[] } = { canal: null, user: null, criadas: [], publicados: [] };

vi.mock("@/lib/canal/server", () => ({
  isObjectId: (v: unknown) => typeof v === "string" && /^[a-f0-9]{24}$/i.test(v),
  sessaoUsuario: async () => state.user,
  exigirFlag: () => null,
  prisma: {
    canal: {
      findUnique: async ({ where }: any) => (where.id === state.canal?.id ? state.canal : null),
      update: async ({ data }: any) => ({ ...state.canal, ...data }),
    },
    canalMensagem: { create: async ({ data }: any) => { const r = { id: "m1", createdAt: new Date(), ...data }; state.criadas.push(r); return r; } },
  },
}));
vi.mock("@/lib/canal/realtime", async () => {
  const real = await vi.importActual<typeof import("@/lib/canal/realtime")>("@/lib/canal/realtime");
  return { ...real, publicarPusher: async (c: string, ev: string, p: unknown) => { state.publicados.push([c, ev, p]); } };
});

import { POST } from "./route";

const entrar = () => POST(new Request("http://x", { method: "POST" }), { params: { id: CANAL } });
const user = (id: string, name = "Martinez") => ({ id, name, image: null, email: "e@x", role: null });

beforeEach(() => { state.criadas = []; state.publicados = []; state.user = user(B); });

describe("entrar · #423 aviso de entrada", () => {
  it("entrar num canal aberto: vira membro e aparece 'Martinez entrou no escritório'", async () => {
    state.canal = { id: CANAL, ownerId: A, acesso: "aberto", membros: [] };
    expect((await entrar()).status).toBe(200);
    expect(state.criadas).toEqual([expect.objectContaining({ autorTipo: "sistema", autorId: B, texto: "Martinez entrou no escritório" })]);
    expect(state.publicados[0]![1]).toBe("mensagem");
  });

  it("quem já é membro (ou o dono) não ganha aviso de novo", async () => {
    state.canal = { id: CANAL, ownerId: A, acesso: "aberto", membros: [B] };
    await entrar();
    state.user = user(A, "Giulia");
    await entrar();
    expect(state.criadas).toHaveLength(0);
  });

  it("canal que não é aberto: 403 e nenhum aviso", async () => {
    state.canal = { id: CANAL, ownerId: A, acesso: "turma", membros: [] };
    expect((await entrar()).status).toBe(403);
    expect(state.criadas).toHaveLength(0);
  });
});
