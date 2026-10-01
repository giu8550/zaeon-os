/**
 * IDOR/author gate da rota de mensagem: A (dono), B (membro), C (fora) em privado/turma/aberto,
 * + @mention conhecido dispara turno, desconhecido não. Prisma/sessão/Pusher/fila mockados.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const A = "a".repeat(24), B = "b".repeat(24), C = "c".repeat(24), CANAL = "d".repeat(24);
const state: { canal: any; user: any; criadas: any[]; disparos: any[]; publicados: any[] } = { canal: null, user: null, criadas: [], disparos: [], publicados: [] };

vi.mock("@/lib/canal/server", () => {
  // sem importActual: o módulo real puxa src/lib/auth → db (exige MONGODB_URI no ambiente de teste)
  return {
    isObjectId: (v: unknown) => typeof v === "string" && /^[a-f0-9]{24}$/i.test(v),
    prisma: {
      canal: { findUnique: async ({ where }: any) => (where.id === state.canal?.id ? state.canal : null), update: async () => state.canal },
      canalMensagem: { create: async ({ data }: any) => { const r = { id: "m1", createdAt: new Date("2026-09-01T00:00:00Z"), ...data }; state.criadas.push(r); return r; } },
    },
    sessaoUsuario: async () => state.user,
    exigirFlag: () => null,
    agentesDoCanal: async () => [{ agentKey: "aura", nome: "Aura", avatarUrl: null }, { agentKey: "medicina", nome: "Osler", avatarUrl: null }],
  };
});
vi.mock("@/lib/canal/realtime", async () => {
  const real = await vi.importActual<typeof import("@/lib/canal/realtime")>("@/lib/canal/realtime");
  return { ...real, publicarPusher: async (c: string, ev: string, p: unknown) => { state.publicados.push([c, ev, p]); } };
});
vi.mock("@/lib/canal/queue", () => ({
  dispararTurnos: async (jobs: any[]) => { state.disparos.push(...jobs); return jobs.map(() => "inline"); },
  depsReais: async () => ({}),
}));

import { POST } from "./route";

const req = (texto: unknown) => new Request("http://x/api/canal/x/mensagem", { method: "POST", body: JSON.stringify({ texto }), headers: { "content-type": "application/json" } });
const canal = (acesso: string) => ({ id: CANAL, ownerId: A, titulo: "t", acesso, membros: [B], agentes: ["aura"] });
const user = (id: string) => ({ id, name: "N", image: null, email: "e@x", role: null });

describe("POST /api/canal/[id]/mensagem · author gate (IDOR)", () => {
  beforeEach(() => { state.criadas = []; state.disparos = []; state.publicados = []; });

  it.each([
    ["privado", A, 201], ["privado", B, 403], ["privado", C, 403],
    ["turma", A, 201], ["turma", B, 201], ["turma", C, 403],
    ["aberto", A, 201], ["aberto", B, 201], ["aberto", C, 201],
  ])("acesso=%s · user=%s → %i", async (acesso, uid, status) => {
    state.canal = canal(acesso); state.user = user(uid);
    const r = await POST(req("oi"), { params: { id: CANAL } });
    expect(r.status).toBe(status);
  });

  it("anônimo 401; canal inexistente 404; id inválido 404", async () => {
    state.canal = canal("aberto"); state.user = null;
    expect((await POST(req("oi"), { params: { id: CANAL } })).status).toBe(401);
    state.user = user(A);
    expect((await POST(req("oi"), { params: { id: "e".repeat(24) } })).status).toBe(404);
    expect((await POST(req("oi"), { params: { id: "nope" } })).status).toBe(404);
  });

  it("texto vazio 400; gigante 413", async () => {
    state.canal = canal("aberto"); state.user = user(A);
    expect((await POST(req("   "), { params: { id: CANAL } })).status).toBe(400);
    expect((await POST(req("x".repeat(4001)), { params: { id: CANAL } })).status).toBe(413);
  });
});

describe("POST /api/canal/[id]/mensagem · @mention → turno", () => {
  beforeEach(() => { state.criadas = []; state.disparos = []; state.publicados = []; state.canal = canal("turma"); state.user = user(B); });

  it("grava a mensagem humana com mencoes, publica e dispara 1 turno por agente conhecido", async () => {
    const r = await POST(req("@aura e @Osler, o que acham? @fulano"), { params: { id: CANAL } });
    expect(r.status).toBe(201);
    const j = await r.json();
    expect(j.mensagem).toMatchObject({ autorTipo: "humano", autorId: B, mencoes: ["aura", "medicina"], autorNome: "N" });
    expect(state.criadas[0].mencoes).toEqual(["aura", "medicina"]);
    expect(state.publicados.map((p) => p[1])).toEqual(["mensagem"]);
    expect(state.disparos.map((d) => d.agentKey)).toEqual(["aura", "medicina"]);
    expect(state.disparos[0]).toMatchObject({ canalId: CANAL, userId: B, mensagemId: "m1" });
    expect(j.turnos).toEqual([{ agentKey: "aura", via: "inline" }, { agentKey: "medicina", via: "inline" }]);
  });
  it("sem @mention → nenhum turno", async () => {
    const r = await POST(req("só conversando"), { params: { id: CANAL } });
    expect(r.status).toBe(201);
    expect(state.disparos).toHaveLength(0);
    expect((await r.json()).turnos).toEqual([]);
  });
});
