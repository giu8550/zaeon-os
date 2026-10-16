/**
 * /api/canal/[id] depois do #396 (item D): a conversa privada (dmCom) só abre pras duas pessoas, não
 * muda de acesso nem recebe gente; adicionar pessoa a um canal exige convite ACEITO (contato).
 * Prisma/sessão mockados (mesmo padrão dos outros testes de rota do canal).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const A = "a".repeat(24), B = "b".repeat(24), C = "c".repeat(24), CANAL = "d".repeat(24);
const state: { canal: any; user: any; convites: any[]; atualizado: any; criadas: any[]; publicados: any[] } = { canal: null, user: null, convites: [], atualizado: null, criadas: [], publicados: [] };
const EMAILS: Record<string, string> = { "martinez@z.com": B, "ana@z.com": C };

vi.mock("@/lib/canal/server", () => ({
  isObjectId: (v: unknown) => typeof v === "string" && /^[a-f0-9]{24}$/i.test(v),
  sessaoUsuario: async () => state.user,
  exigirFlag: () => null,
  agentesDoCanal: async () => [],
  agentesPublicos: (l: any[]) => l,
  paraWire: (m: any) => m,
  pessoas: async (ids: string[]) => new Map([...new Set(ids)].map((id) => [id, { id, nome: id, avatar: null }])),
  prisma: {
    canal: {
      findUnique: async ({ where }: any) => (where.id === state.canal?.id ? state.canal : null),
      update: async ({ data }: any) => { state.atualizado = data; return { ...state.canal, ...data }; },
    },
    canalMensagem: {
      findMany: async () => [],
      create: async ({ data }: any) => { const r = { id: `m${state.criadas.length + 1}`, createdAt: new Date("2026-10-16T10:00:00Z"), ...data }; state.criadas.push(r); return r; },
    },
    user: {
      findUnique: async ({ where }: any) => {
        const id = where.email ? EMAILS[where.email] : [A, B, C].includes(where.id) ? where.id : undefined;
        return id ? { id } : null;
      },
    },
    canalConvite: {
      findFirst: async ({ where }: any) =>
        state.convites.find((c) => c.status === where.status && where.OR.some((o: any) => c.deId === o.deId && c.paraId === o.paraId)) ?? null,
    },
  },
}));

vi.mock("@/lib/canal/realtime", async () => {
  const real = await vi.importActual<typeof import("@/lib/canal/realtime")>("@/lib/canal/realtime");
  return { ...real, publicarPusher: async (c: string, ev: string, p: unknown) => { state.publicados.push([c, ev, p]); } };
});

import { GET, PATCH } from "./route";

const ctx = { params: { id: CANAL } };
const patch = (body: unknown) => PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), ctx);
const user = (id: string) => ({ id, name: "N", image: null, email: "e@x", role: null });
const turma = { id: CANAL, ownerId: A, titulo: "t", acesso: "turma", membros: [], agentes: [], cartolinaId: null, dmCom: null };
const dm = { ...turma, acesso: "privado", dmCom: B };

beforeEach(() => { state.convites = []; state.atualizado = null; state.criadas = []; state.publicados = []; state.user = user(A); state.canal = { ...turma }; });

describe("canal/[id] · #423 · aviso 'fulano entrou' quando alguém é ADICIONADO", () => {
  it("adicionar um contato grava a linha do sistema e avisa o canal", async () => {
    state.convites.push({ deId: A, paraId: B, status: "aceito" });
    expect((await patch({ adicionarMembro: B })).status).toBe(200);
    expect(state.criadas).toHaveLength(1);
    expect(state.criadas[0]).toMatchObject({ canalId: CANAL, autorTipo: "sistema", autorId: B, texto: `${B} entrou no escritório` });
    expect(state.publicados).toHaveLength(1);
    expect(state.publicados[0]![1]).toBe("mensagem");
    expect(state.publicados[0]![2]).toMatchObject({ autorTipo: "sistema", autorId: B });
  });

  it("'adicionar' quem já é membro não repete o aviso", async () => {
    state.canal = { ...turma, membros: [B] };
    state.convites.push({ deId: A, paraId: B, status: "aceito" });
    await patch({ adicionarMembro: B });
    expect(state.criadas).toHaveLength(0);
  });

  it("remover membro, mudar título ou acesso não gera aviso", async () => {
    state.canal = { ...turma, membros: [B] };
    await patch({ removerMembro: B });
    await patch({ titulo: "novo" });
    await patch({ acesso: "aberto" });
    expect(state.criadas).toHaveLength(0);
  });

  it("quem não aceitou convite (409) não entra e não gera aviso", async () => {
    expect((await patch({ adicionarEmail: "martinez@z.com" })).status).toBe(409);
    expect(state.criadas).toHaveLength(0);
  });
});

describe("canal/[id] · conversa privada (dmCom)", () => {
  it("abre pras duas pessoas e pra mais ninguém", async () => {
    state.canal = { ...dm };
    state.user = user(A); expect((await GET(new Request("http://x"), ctx)).status).toBe(200);
    state.user = user(B); expect((await GET(new Request("http://x"), ctx)).status).toBe(200);
    state.user = user(C); expect((await GET(new Request("http://x"), ctx)).status).toBe(403);
  });

  it("lista as duas pessoas (inclui o outro lado)", async () => {
    state.canal = { ...dm };
    const j = await (await GET(new Request("http://x"), ctx)).json();
    expect(j.pessoas.map((p: any) => p.id).sort()).toEqual([A, B].sort());
  });

  it("não muda de acesso nem recebe/perde gente (400)", async () => {
    state.canal = { ...dm };
    state.convites.push({ deId: A, paraId: C, status: "aceito" });
    for (const body of [{ acesso: "aberto" }, { adicionarEmail: "ana@z.com" }, { adicionarMembro: C }, { removerMembro: B }]) {
      expect((await patch(body)).status).toBe(400);
    }
    expect(state.atualizado).toBeNull();
  });

  it("o convidado conversa, mas não gere a conversa (403)", async () => {
    state.canal = { ...dm };
    state.user = user(B);
    expect((await patch({ titulo: "novo" })).status).toBe(403);
  });
});

describe("canal/[id] · adicionar pessoa exige convite aceito", () => {
  it("sem convite aceito → 409, ninguém entra", async () => {
    expect((await patch({ adicionarEmail: "martinez@z.com" })).status).toBe(409);
    state.convites.push({ deId: A, paraId: B, status: "pendente" });
    expect((await patch({ adicionarEmail: "martinez@z.com" })).status).toBe(409);
    expect(state.atualizado).toBeNull();
  });

  it("com convite aceito (em qualquer direção) entra, por e-mail ou pelo id do contato", async () => {
    state.convites.push({ deId: B, paraId: A, status: "aceito" });
    const r1 = await patch({ adicionarEmail: "Martinez@Z.com" });
    expect(r1.status).toBe(200);
    expect(state.atualizado.membros).toEqual([B]);

    state.convites.push({ deId: A, paraId: C, status: "aceito" });
    state.atualizado = null;
    const r2 = await patch({ adicionarMembro: C });
    expect(r2.status).toBe(200);
    expect(state.atualizado.membros).toEqual([C]);
  });

  it("e-mail que não existe → 404", async () => {
    expect((await patch({ adicionarEmail: "ninguem@z.com" })).status).toBe(404);
  });

  it("remover membro continua livre pro dono (sem precisar de convite)", async () => {
    state.canal = { ...turma, membros: [B] };
    const r = await patch({ removerMembro: B });
    expect(r.status).toBe(200);
    expect(state.atualizado.membros).toEqual([]);
  });
});
