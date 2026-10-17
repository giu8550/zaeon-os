/**
 * GET /api/perfil/[userId] (#427): o perfil de outra pessoa, só pra quem divide escritório com ela, e os
 * CÉREBROS nunca saem (nem a lista, nem o contador, nem as linhas do extrato, nem a lista de validações).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const EU = "a".repeat(24), MARTINEZ = "b".repeat(24), ESTRANHO = "c".repeat(24), PADRINHO = "d".repeat(24);
const state: { email: string | null; canais: any[]; consultas: string[] } = { email: null, canais: [], consultas: [] };
const USERS: Record<string, any> = {
  [EU]: { id: EU, email: "giulia@z.com", name: "Giulia", role: null },
  [MARTINEZ]: { id: MARTINEZ, email: "martinez@z.com", name: "Martinez", course: "Engenharia", image: "/m.png", academicLevel: "Mestrado", eduVerified: true, plan: "free", referredBy: PADRINHO, role: null },
  [ESTRANHO]: { id: ESTRANHO, email: "x@z.com", name: "Estranho", role: null },
  [PADRINHO]: { id: PADRINHO, name: "Padrinho", image: null, course: "Direito" },
};

vi.mock("next-auth", () => ({ getServerSession: async () => (state.email ? { user: { email: state.email } } : null) }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/lounge3d/corposDeUsuario", () => ({ corpoDoUsuario: () => null }));
vi.mock("@/lib/cyber/cores", () => ({ corDaArmadura: () => "#22d3ee" }));
vi.mock("@/src/lib/prisma", () => ({
  prisma: {
    user: {
      // como o banco: só devolve os campos do select
      findUnique: async ({ where, select }: any) => {
        const u = where.email ? Object.values(USERS).find((x: any) => x.email === where.email) : USERS[where.id];
        if (!u) return null;
        return select ? Object.fromEntries(Object.keys(select).map((k) => [k, u[k] ?? null])) : { ...u };
      },
    },
    canal: {
      findMany: async ({ where }: any) => {
        const me = where.OR[0].ownerId;
        return state.canais.filter((c) => c.ownerId === me || c.membros.includes(me) || c.dmCom === me);
      },
    },
    auraEvent: {
      findMany: async () => [
        { id: "e1", source: "node_learned", amount: 5, reason: "Aprendido: Funções em Python", createdAt: new Date("2026-10-16") },
        { id: "e2", source: "credential_verified", amount: 100, reason: "Título verificado: Mestrado", createdAt: new Date("2026-10-15") },
        { id: "e3", source: "brain_completed", amount: 50, reason: "Cérebro completo: Python desde as origens", createdAt: new Date("2026-10-14") },
        { id: "e4", source: "node_validated", amount: 20, reason: "Validado: Decoradores", createdAt: new Date("2026-10-13") },
      ],
    },
    academicCredential: { findMany: async () => [{ id: "t1", nivel: "mestrado", area: "Engenharia", instituicao: "USP", metodo: "documento", status: "verificado", verifiedAt: new Date("2026-10-01"), createdAt: new Date("2026-09-01"), docHash: "segredo-do-diploma" }] },
    credential: { findMany: async () => [{ id: "k1", type: "academic", title: "Mestrado em Engenharia", assetId: null, network: "devnet", issuedAt: new Date("2026-10-02") }] },
    mapaValidacao: { count: async () => { state.consultas.push("mapaValidacao.count"); return 3; } },
    // se a rota tentar ler os cérebros, o teste percebe
    mapaProbabilistico: { findMany: async () => { state.consultas.push("mapaProbabilistico"); return [{ titulo: "CEREBRO-SECRETO" }]; } },
  },
}));

import { GET } from "./route";

const ver = (id: string) => GET(new Request("http://x"), { params: { userId: id } });

beforeEach(() => {
  state.email = "giulia@z.com";
  state.consultas = [];
  state.canais = [{ ownerId: EU, membros: [MARTINEZ], dmCom: null }];
  process.env.AURA_ECONOMY = "1";
  process.env.MAP_HARNESS = "1";
});

describe("perfil de outra pessoa", () => {
  it("quem divide escritório vê: dados do perfil, AURA, títulos, atestados e o número de validações", async () => {
    const r = await ver(MARTINEZ);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.pessoa).toMatchObject({ id: MARTINEZ, name: "Martinez", course: "Engenharia", image: "/m.png", academicLevel: "Mestrado", eduVerified: true });
    expect(j.pessoa.inviter).toEqual({ name: "Padrinho", image: null, course: "Direito" });
    expect(j.aura.aura).toBe(175);
    expect(j.aura.validatedSkills).toBe(1);
    expect(j.aura.academicas[0]).toMatchObject({ nivel: "mestrado", area: "Engenharia", status: "verificado" });
    expect(j.aura.parede[0].title).toBe("Mestrado em Engenharia");
    expect(j.validacoesPendentes).toBe(3);
  });

  it("CÉREBROS nunca saem: nem lista, nem contador, nem linhas do extrato, e a rota nem lê os mapas", async () => {
    const j = await (await ver(MARTINEZ)).json();
    expect(j.aura.cerebros).toBeUndefined();
    expect(j.aura.completedBrains).toBeUndefined();
    expect(j.aura.recent.map((e: any) => e.reason)).toEqual(["Título verificado: Mestrado"]);
    const texto = JSON.stringify(j);
    expect(texto).not.toMatch(/Aprendido|Cérebro completo|Decoradores|CEREBRO-SECRETO|cerebros|completedBrains/);
    expect(state.consultas).not.toContain("mapaProbabilistico");
  });

  it("validações de estudo: só o número, sem a lista (nomes e passos dos cérebros de outros alunos)", async () => {
    const j = await (await ver(MARTINEZ)).json();
    expect(typeof j.validacoesPendentes).toBe("number");
    expect(Object.keys(j).sort()).toEqual(["aura", "pessoa", "validacoesPendentes"]);
  });

  it("e-mail, papel e documento do diploma não saem", async () => {
    const texto = JSON.stringify(await (await ver(MARTINEZ)).json());
    expect(texto).not.toMatch(/martinez@z\.com|segredo-do-diploma|"role"|"email"/);
  });

  it("quem NÃO divide escritório com a pessoa: 404 (não dá pra espiar pelo id)", async () => {
    expect((await ver(ESTRANHO)).status).toBe(404);
    state.canais = [];
    expect((await ver(MARTINEZ)).status).toBe(404);
  });

  it("a própria pessoa pode abrir o próprio perfil por aqui", async () => {
    expect((await ver(EU)).status).toBe(200);
  });

  it("AURA desligada: o perfil abre sem o cartão da AURA; mapa desligado: sem validações", async () => {
    process.env.AURA_ECONOMY = "0"; delete process.env.NEXT_PUBLIC_AURA_ECONOMY;
    process.env.MAP_HARNESS = "0";
    const j = await (await ver(MARTINEZ)).json();
    expect(j.aura).toBeNull();
    expect(j.validacoesPendentes).toBeNull();
  });

  it("anônimo 401; id inválido 404", async () => {
    state.email = null;
    expect((await ver(MARTINEZ)).status).toBe(401);
    state.email = "giulia@z.com";
    expect((await ver("nope")).status).toBe(404);
  });
});
