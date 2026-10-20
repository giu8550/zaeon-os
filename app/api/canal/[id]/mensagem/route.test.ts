/**
 * IDOR/author gate da rota de mensagem: A (dono), B (membro), C (fora) em privado/turma/aberto,
 * + @mention conhecido dispara turno, desconhecido não. Prisma/sessão/Pusher/fila mockados.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const A = "a".repeat(24), B = "b".repeat(24), C = "c".repeat(24), CANAL = "d".repeat(24);
const state: { canal: any; user: any; criadas: any[]; disparos: any[]; publicados: any[]; historico: any[]; atualizacoes: any[] } = { canal: null, user: null, criadas: [], disparos: [], publicados: [], historico: [], atualizacoes: [] };

vi.mock("@/lib/canal/server", () => {
  // sem importActual: o módulo real puxa src/lib/auth → db (exige MONGODB_URI no ambiente de teste)
  return {
    isObjectId: (v: unknown) => typeof v === "string" && /^[a-f0-9]{24}$/i.test(v),
    prisma: {
      canal: { findUnique: async ({ where }: any) => (where.id === state.canal?.id ? state.canal : null), update: async ({ data }: any) => { (state as any).atualizacoes.push(data); return state.canal; } },
      canalMensagem: {
        create: async ({ data }: any) => { const r = { id: "m1", createdAt: new Date("2026-09-01T00:00:00Z"), ...data }; state.criadas.push(r); return r; },
        // histórico em ordem DESC (mais recente primeiro), como a rota pede
        findMany: async () => [...state.historico].reverse(),
      },
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
  beforeEach(() => { state.criadas = []; state.disparos = []; state.publicados = []; state.historico = []; });

  it.each([
    ["privado", A, 201], ["privado", B, 201], ["privado", C, 403],
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
  beforeEach(() => { state.criadas = []; state.disparos = []; state.publicados = []; state.historico = []; state.canal = canal("turma"); state.user = user(B); });

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
  it("sem @mention em canal compartilhado, sem agente ativo → nenhum turno", async () => {
    const r = await POST(req("só conversando"), { params: { id: CANAL } });
    expect(r.status).toBe(201);
    expect(state.disparos).toHaveLength(0);
    expect((await r.json()).turnos).toEqual([]);
  });
});

describe("POST /api/canal/[id]/mensagem · sem @ → agente ativo (lib/canal/alvo.ts)", () => {
  beforeEach(() => {
    state.criadas = []; state.disparos = []; state.publicados = []; state.historico = [];
    state.canal = { ...canal("privado"), membros: [] }; // canal de uma pessoa (dono A)
    state.user = user(A);
  });

  it("primeiro oi sem @ → a Aura responde", async () => {
    const r = await POST(req("eai"), { params: { id: CANAL } });
    expect(r.status).toBe(201);
    expect(state.disparos.map((d) => d.agentKey)).toEqual(["aura"]);
    expect(state.disparos[0]).toMatchObject({ canalId: CANAL, userId: A, mensagemId: "m1" });
    expect((await r.json()).turnos).toEqual([{ agentKey: "aura", via: "inline" }]);
    expect(state.criadas[0].mencoes).toEqual([]); // a menção gravada continua sendo só a explícita
  });

  it("no meio da conversa, sem @, continua o ÚLTIMO agente que falou", async () => {
    state.historico = [
      { autorTipo: "humano", autorId: A }, { autorTipo: "agente", autorId: "aura" },
      { autorTipo: "humano", autorId: A }, { autorTipo: "agente", autorId: "medicina" },
    ];
    await POST(req("e agora?"), { params: { id: CANAL } });
    expect(state.disparos.map((d) => d.agentKey)).toEqual(["medicina"]);
  });

  it("@ continua mandando e troca o agente", async () => {
    state.historico = [{ autorTipo: "humano", autorId: A }, { autorTipo: "agente", autorId: "aura" }];
    await POST(req("@Osler me ajuda"), { params: { id: CANAL } });
    expect(state.disparos.map((d) => d.agentKey)).toEqual(["medicina"]);
  });

  it("#396 · conversa privada (dmCom): sem @ a IA não responde sozinha (são duas pessoas conversando)", async () => {
    state.canal = { ...canal("privado"), membros: [], dmCom: B };
    state.user = user(A);
    await POST(req("oi, tudo bem?"), { params: { id: CANAL } });
    expect(state.disparos).toHaveLength(0);
    // com @ a IA entra na conversa normalmente
    await POST(req("@aura resume pra gente"), { params: { id: CANAL } });
    expect(state.disparos.map((d) => d.agentKey)).toEqual(["aura"]);
  });

  it("#396 · conversa privada: o outro lado também escreve; terceiro não (403)", async () => {
    state.canal = { ...canal("privado"), membros: [], dmCom: B };
    state.user = user(B);
    expect((await POST(req("oi"), { params: { id: CANAL } })).status).toBe(201);
    state.user = user(C);
    expect((await POST(req("oi"), { params: { id: CANAL } })).status).toBe(403);
  });

  it("canal com 2+ pessoas: outra pessoa sem @ não aciona o agente", async () => {
    state.canal = canal("turma"); // dono A + membro B
    state.user = user(B);
    state.historico = [{ autorTipo: "humano", autorId: A }, { autorTipo: "agente", autorId: "aura" }];
    await POST(req("concordo com isso"), { params: { id: CANAL } });
    expect(state.disparos).toHaveLength(0);
  });
});

describe("POST /api/canal/[id]/mensagem · #438 agente dispensada", () => {
  beforeEach(() => { state.criadas = []; state.disparos = []; state.publicados = []; state.historico = []; state.canal = canal("turma"); state.user = user(B); });
  const tipos = () => state.criadas.map((m) => [m.autorTipo, m.autorId]);

  it("'@aura pode ir embora, vlw': ela se despede, sai da conversa, e NÃO gasta turno de IA", async () => {
    const r = await POST(req("@aura pode ir embora, vlw"), { params: { id: CANAL } });
    expect(r.status).toBe(201);
    expect((await r.json()).dispensadas).toEqual(["aura"]);
    expect(state.disparos).toHaveLength(0);
    expect(tipos()).toEqual([["humano", B], ["agente", "aura"], ["sistema", "aura"]]);
    expect(state.criadas[1].texto).toContain("@aura");
    expect(state.criadas[2].texto).toBe("Aura saiu da conversa");
    // a pessoa vê tudo ao vivo: a mensagem, a despedida e a linha do sistema
    expect(state.publicados.map((p) => (p[2] as any).autorTipo)).toEqual(["humano", "agente", "sistema"]);
  });

  it("sem @, dispensando a agente da vez (quem estava falando com ela)", async () => {
    state.historico = [{ autorTipo: "humano", autorId: B }, { autorTipo: "agente", autorId: "medicina" }];
    await POST(req("é só isso, obrigada"), { params: { id: CANAL } });
    expect(state.disparos).toHaveLength(0);
    expect(tipos().slice(1)).toEqual([["agente", "medicina"], ["sistema", "medicina"]]);
  });

  it("depois que saiu, a próxima mensagem sem @ não aciona ninguém", async () => {
    state.historico = [{ autorTipo: "humano", autorId: B }, { autorTipo: "agente", autorId: "medicina" }, { autorTipo: "sistema", autorId: "medicina" }];
    await POST(req("eu quero essa gata pra mim ><"), { params: { id: CANAL } });
    expect(state.disparos).toHaveLength(0);
    expect(tipos()).toEqual([["humano", B]]);
  });

  it("'tchau' pra outra pessoa (sem o nome da agente) não tira a agente: ela segue respondendo", async () => {
    state.historico = [{ autorTipo: "humano", autorId: B }, { autorTipo: "agente", autorId: "medicina" }];
    const r = await POST(req("tchau, até amanhã"), { params: { id: CANAL } });
    expect((await r.json()).dispensadas).toBeUndefined();
    expect(state.disparos.map((d) => d.agentKey)).toEqual(["medicina"]);
  });

  it("pergunta normal continua indo pra IA", async () => {
    await POST(req("@aura pode ir pesquisando sobre python?"), { params: { id: CANAL } });
    expect(state.disparos.map((d) => d.agentKey)).toEqual(["aura"]);
  });
});

describe("POST /api/canal/[id]/mensagem · #440 sair da barra e voltar com aviso", () => {
  beforeEach(() => {
    state.criadas = []; state.disparos = []; state.publicados = []; state.historico = []; state.atualizacoes = [];
    state.canal = { ...canal("turma"), agentes: ["aura", "medicina"] }; state.user = user(B);
  });
  const tipos = () => state.criadas.map((m) => [m.autorTipo, m.autorId, m.texto]);
  const saiu = { autorTipo: "sistema", autorId: "medicina", texto: "Osler saiu da conversa" };

  it("as frases da Giulia agora dispensam: 'pode sair @osler não precisamos mais de você'", async () => {
    state.historico = [{ autorTipo: "humano", autorId: B }, { autorTipo: "agente", autorId: "medicina" }];
    const j = await (await POST(req("pode sair @Osler não precisamos mais de você"), { params: { id: CANAL } })).json();
    expect(j.dispensadas).toEqual(["medicina"]);
    expect(state.disparos).toHaveLength(0);
  });

  it("dispensada SAI da barra do escritório (canal.agentes) — pra todo mundo", async () => {
    state.historico = [{ autorTipo: "humano", autorId: B }, { autorTipo: "agente", autorId: "medicina" }];
    const j = await (await POST(req("@Osler pode ir embora, vlw"), { params: { id: CANAL } })).json();
    expect(j.agentesNoCanal).toEqual(["aura"]);
    expect(state.atualizacoes.at(-1).agentes).toEqual(["aura"]);
  });

  it("chamada com @ depois de ter saído: entra 'Osler voltou para a conversa', ela volta pra barra e responde", async () => {
    state.canal.agentes = ["aura"];
    state.historico = [{ autorTipo: "humano", autorId: B }, { autorTipo: "agente", autorId: "medicina" }, saiu];
    const j = await (await POST(req("@Osler ajude a igreja"), { params: { id: CANAL } })).json();
    expect(tipos()).toEqual([["humano", B, "@Osler ajude a igreja"], ["sistema", "medicina", "Osler voltou para a conversa"]]);
    expect(j.voltaram).toEqual(["medicina"]);
    expect(j.agentesNoCanal).toEqual(["aura", "medicina"]);
    expect(state.disparos.map((d) => d.agentKey)).toEqual(["medicina"]);
    // a pessoa vê ao vivo a mensagem e a linha de volta
    expect(state.publicados.map((p) => (p[2] as any).texto)).toEqual(["@Osler ajude a igreja", "Osler voltou para a conversa"]);
  });

  it("depois de voltar, sem @ ela continua sendo a agente da vez", async () => {
    state.historico = [{ autorTipo: "humano", autorId: B }, { autorTipo: "agente", autorId: "medicina" }, saiu,
      { autorTipo: "humano", autorId: B }, { autorTipo: "sistema", autorId: "medicina", texto: "Osler voltou para a conversa" }];
    await POST(req("e sobre o capítulo 2?"), { params: { id: CANAL } });
    expect(state.disparos.map((d) => d.agentKey)).toEqual(["medicina"]);
  });

  it("agente que nunca saiu: chamar com @ não cria linha de 'voltou'", async () => {
    state.historico = [{ autorTipo: "humano", autorId: B }, { autorTipo: "agente", autorId: "medicina" }];
    const j = await (await POST(req("@Osler e agora?"), { params: { id: CANAL } })).json();
    expect(tipos()).toEqual([["humano", B, "@Osler e agora?"]]);
    expect(j.voltaram).toBeUndefined();
  });
});

describe("POST /api/canal/[id]/mensagem · #443 dispensar uma agente não tira as outras", () => {
  beforeEach(() => {
    state.criadas = []; state.disparos = []; state.publicados = []; state.historico = []; state.atualizacoes = [];
    state.canal = { ...canal("turma"), agentes: ["aura", "medicina"] }; state.user = user(B);
  });

  it("'@aura @Osler o osler pode sair, aura continua comigo' → só o Osler sai; a Aura responde e fica na barra", async () => {
    const j = await (await POST(req("@aura @Osler o osler pode sair, aura continua comigo"), { params: { id: CANAL } })).json();
    expect(j.dispensadas).toEqual(["medicina"]);
    expect(state.disparos.map((d) => d.agentKey)).toEqual(["aura"]);
    expect(j.agentesNoCanal).toEqual(["aura"]);
    expect(state.criadas.filter((m) => m.autorTipo === "sistema").map((m) => m.autorId)).toEqual(["medicina"]);
  });

  it("'pode ir em frente' não tira ninguém: a agente da vez responde", async () => {
    state.historico = [{ autorTipo: "humano", autorId: B }, { autorTipo: "agente", autorId: "medicina" }];
    const j = await (await POST(req("pode ir em frente"), { params: { id: CANAL } })).json();
    expect(j.dispensadas).toBeUndefined();
    expect(state.disparos.map((d) => d.agentKey)).toEqual(["medicina"]);
  });
});
