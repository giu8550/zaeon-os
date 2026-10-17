/** GET /api/canal/[id]/pessoa/[userId] (#425): perfil de quem é do escritório, sem cérebros, só pra quem lê o canal. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const A = "a".repeat(24), B = "b".repeat(24), C = "c".repeat(24), F = "f".repeat(24), CANAL = "d".repeat(24);
const state: { canal: any; user: any; selects: any[] } = { canal: null, user: null, selects: [] };
const USERS: Record<string, any> = {
  [A]: { id: A, name: "Giulia", image: "/g.png", course: "Computação", academicLevel: "Graduação", institution: "UFX", bio: "Oi", email: "g@z.com", aura: 10 },
  [B]: { id: B, name: "Martinez", image: null, course: null, academicLevel: "Mestrado", institution: null, bio: null, email: "m@z.com", aura: 99 },
  [F]: { id: F, name: "Fora", image: null, email: "f@z.com" },
};

vi.mock("@/lib/canal/server", () => ({
  isObjectId: (v: unknown) => typeof v === "string" && /^[a-f0-9]{24}$/i.test(v),
  sessaoUsuario: async () => state.user,
  exigirFlag: () => null,
  prisma: {
    canal: { findUnique: async ({ where }: any) => (where.id === state.canal?.id ? state.canal : null) },
    user: {
      // devolve o usuário INTEIRO (como se o banco mandasse tudo) — quem filtra tem que ser a rota
      findUnique: async ({ where, select }: any) => { state.selects.push(select); return USERS[where.id] ? { ...USERS[where.id], cerebros: [{ titulo: "segredo" }] } : null; },
    },
  },
}));

import { GET } from "./route";

const ver = (userId: string, id = CANAL) => GET(new Request("http://x"), { params: { id, userId } });
const user = (id: string) => ({ id, name: USERS[id]?.name ?? "N", image: null, email: "e@x", role: null });

beforeEach(() => {
  state.selects = [];
  state.canal = { id: CANAL, ownerId: A, acesso: "turma", membros: [B], dmCom: null };
  state.user = user(B);
});

describe("perfil pela foto", () => {
  it("membro vê o perfil do dono: campos públicos + papel", async () => {
    const r = await ver(A);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      pessoa: { id: A, nome: "Giulia", avatar: "/g.png", curso: "Computação", nivel: "Graduação", instituicao: "UFX", bio: "Oi" },
      papel: "dono",
    });
  });

  it("os cérebros (e e-mail, aura) nunca saem, nem se o banco mandar", async () => {
    const texto = await (await ver(A)).text();
    expect(texto).not.toMatch(/cerebro|segredo|email|aura/i);
    // e a rota nem pede esses campos ao banco
    expect(Object.keys(state.selects[0]).sort()).toEqual(["academicLevel", "bio", "course", "id", "image", "institution", "name"]);
  });

  it("dono vê o perfil de um membro (papel membro)", async () => {
    state.user = user(A);
    expect((await (await ver(B)).json()).papel).toBe("membro");
  });

  it("conversa privada: os dois se veem", async () => {
    state.canal = { id: CANAL, ownerId: A, acesso: "privado", membros: [], dmCom: B };
    expect((await ver(A)).status).toBe(200);
    state.user = user(A);
    expect((await ver(B)).status).toBe(200);
  });

  it("quem NÃO é do escritório: 404 (não serve pra espiar qualquer perfil pelo id)", async () => {
    expect((await ver(F)).status).toBe(404);
    expect(state.selects).toHaveLength(0);
  });

  it("quem não pode ler o canal: 403, sem tocar no banco de usuários", async () => {
    state.user = user(C);
    expect((await ver(A)).status).toBe(403);
    expect(state.selects).toHaveLength(0);
  });

  it("anônimo 401; ids inválidos ou canal inexistente 404", async () => {
    state.user = null;
    expect((await ver(A)).status).toBe(401);
    state.user = user(B);
    expect((await ver("nope")).status).toBe(404);
    expect((await ver(A, "e".repeat(24))).status).toBe(404);
  });
});
