/**
 * Convites do escritório (#396, item D): convidar por e-mail/nome, não duplicar, não se convidar,
 * teto de pendentes, listar (recebidos/enviados/contatos), e responder (só o convidado, só uma vez;
 * aceitar cria a conversa privada só entre os dois). Prisma/sessão/Pusher mockados.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const A = "a".repeat(24), B = "b".repeat(24), C = "c".repeat(24), X = "f".repeat(24);
type Conv = { id: string; deId: string; paraId: string; status: string; dmCanalId: string | null; createdAt: Date; respondidoEm?: Date | null };
const USERS = [
  { id: A, name: "Giulia", email: "giulia@z.com" },
  { id: B, name: "Martinez", email: "martinez@z.com" },
  { id: C, name: "Ana", email: "ana1@z.com" },
  { id: X, name: "Ana", email: "ana2@z.com" },
];
const state: { user: any; convites: Conv[]; canais: any[]; avisos: any[]; mensagens: any[]; seq: number; sinos: any[] } = { user: null, convites: [], canais: [], avisos: [], mensagens: [], seq: 0, sinos: [] };
const novoId = () => (++state.seq).toString(16).padStart(24, "0");

const casa = (r: any, w: any): boolean => {
  if (!w) return true;
  if (w.OR && !w.OR.some((o: any) => casa(r, o))) return false;
  for (const k of ["id", "deId", "paraId"]) if (w[k] !== undefined && r[k] !== w[k]) return false;
  if (w.status !== undefined) {
    if (typeof w.status === "string" && r.status !== w.status) return false;
    if (w.status?.in && !w.status.in.includes(r.status)) return false;
  }
  return true;
};

vi.mock("@/lib/canal/server", () => ({
  isObjectId: (v: unknown) => typeof v === "string" && /^[a-f0-9]{24}$/i.test(v),
  sessaoUsuario: async () => state.user,
  exigirFlag: () => null,
  pessoas: async (ids: string[]) => new Map([...new Set(ids)].map((id) => [id, { id, nome: USERS.find((u) => u.id === id)?.name ?? "Alguém", avatar: null }])),
  prisma: {
    user: {
      findUnique: async ({ where }: any) => {
        const u = USERS.find((x) => (where.email ? x.email === where.email : x.id === where.id));
        return u ? { id: u.id, name: u.name } : null;
      },
      findMany: async ({ where, take }: any) =>
        USERS.filter((x) => x.name.toLowerCase() === String(where.name.equals).toLowerCase()).slice(0, take).map((u) => ({ id: u.id, name: u.name })),
    },
    canalConvite: {
      findMany: async ({ where }: any) => state.convites.filter((c) => casa(c, where)),
      findUnique: async ({ where }: any) => state.convites.find((c) => c.id === where.id) ?? null,
      count: async ({ where }: any) => state.convites.filter((c) => casa(c, where)).length,
      create: async ({ data }: any) => { const r = { id: novoId(), dmCanalId: null, createdAt: new Date(), ...data }; state.convites.push(r); return r; },
      updateMany: async ({ where, data }: any) => {
        const alvo = state.convites.filter((c) => casa(c, where));
        alvo.forEach((c) => Object.assign(c, data));
        return { count: alvo.length };
      },
      update: async ({ where, data }: any) => { const c = state.convites.find((x) => x.id === where.id)!; Object.assign(c, data); return c; },
    },
    canal: {
      create: async ({ data }: any) => { const r = { id: novoId(), ...data }; state.canais.push(r); return r; },
      findUnique: async ({ where }: any) => state.canais.find((c) => c.id === where.id) ?? null,
      findMany: async ({ where }: any) => state.canais.filter((c) => where.id.in.includes(c.id)).map((c) => ({ id: c.id, titulo: c.titulo })),
      update: async ({ where, data }: any) => { const c = state.canais.find((x) => x.id === where.id)!; Object.assign(c, data); return c; },
    },
    canalSino: { findUnique: async ({ where }: any) => state.sinos.find((x) => x.userId === where.userId) ?? null },
    canalMensagem: { create: async ({ data }: any) => { const r = { id: novoId(), createdAt: new Date(), ...data }; state.mensagens.push(r); return r; } },
  },
}));
vi.mock("@/lib/collab/realtime", () => ({ triggerSafe: async (canal: string, ev: string, p: unknown) => { state.avisos.push([canal, ev, p]); } }));

import { GET, POST, MAX_PENDENTES } from "./route";
import { POST as RESPONDER } from "./[id]/route";

const post = (body: unknown) => new Request("http://x/api/canal/convites", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const responder = (id: string, acao: unknown) => RESPONDER(new Request("http://x", { method: "POST", body: JSON.stringify({ acao }), headers: { "content-type": "application/json" } }), { params: { id } });
const user = (id: string) => ({ id, name: USERS.find((u) => u.id === id)?.name ?? "N", image: null, email: "e@x", role: null });

beforeEach(() => { state.convites = []; state.canais = []; state.avisos = []; state.mensagens = []; state.seq = 0; state.sinos = []; state.user = user(A); });

describe("convites · convidar", () => {
  it("por e-mail: cria pendente e avisa a pessoa no canal pessoal", async () => {
    const r = await POST(post({ para: "Martinez@Z.com" }));
    expect(r.status).toBe(201);
    expect(state.convites).toHaveLength(1);
    expect(state.convites[0]).toMatchObject({ deId: A, paraId: B, status: "pendente" });
    expect(state.avisos[0]![0]).toBe(`user_${B}`);
    expect(state.avisos[0]![1]).toBe("zaeon-notice");
  });

  it("por nome, quando só uma pessoa tem aquele nome", async () => {
    expect((await POST(post({ para: "martinez" }))).status).toBe(201);
  });

  it("nome repetido → 409 pedindo e-mail; nome/e-mail inexistente → 404", async () => {
    expect((await POST(post({ para: "Ana" }))).status).toBe(409);
    expect((await POST(post({ para: "Fulano" }))).status).toBe(404);
    expect((await POST(post({ para: "ninguem@z.com" }))).status).toBe(404);
    expect(state.convites).toHaveLength(0);
  });

  it("vazio → 400; a si mesma → 400; anônimo → 401", async () => {
    expect((await POST(post({ para: "" }))).status).toBe(400);
    expect((await POST(post({ para: "giulia@z.com" }))).status).toBe(400);
    state.user = null;
    expect((await POST(post({ para: "martinez@z.com" }))).status).toBe(401);
  });

  it("não duplica: pendente nas duas direções → 409", async () => {
    await POST(post({ para: "martinez@z.com" }));
    expect((await POST(post({ para: "martinez@z.com" }))).status).toBe(409);
    state.user = user(B);
    expect((await POST(post({ para: "giulia@z.com" }))).status).toBe(409);
    expect(state.convites).toHaveLength(1);
  });

  it("já são contatos → 200 com a conversa existente, sem criar outro", async () => {
    state.convites.push({ id: novoId(), deId: B, paraId: A, status: "aceito", dmCanalId: "9".repeat(24), createdAt: new Date() });
    const r = await POST(post({ para: "martinez@z.com" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ jaContatos: true, dmCanalId: "9".repeat(24) });
  });

  it("recusado antes libera um convite novo", async () => {
    state.convites.push({ id: novoId(), deId: A, paraId: B, status: "recusado", dmCanalId: null, createdAt: new Date() });
    expect((await POST(post({ para: "martinez@z.com" }))).status).toBe(201);
  });

  it(`teto de ${MAX_PENDENTES} convites esperando resposta`, async () => {
    for (let i = 0; i < MAX_PENDENTES; i++) state.convites.push({ id: novoId(), deId: A, paraId: `${i}`.padStart(24, "e"), status: "pendente", dmCanalId: null, createdAt: new Date() });
    expect((await POST(post({ para: "martinez@z.com" }))).status).toBe(429);
  });
});

describe("convites · listar", () => {
  it("separa recebidos, enviados e contatos, sempre com a OUTRA pessoa", async () => {
    state.convites.push(
      { id: "1".repeat(24), deId: B, paraId: A, status: "pendente", dmCanalId: null, createdAt: new Date() },
      { id: "2".repeat(24), deId: A, paraId: C, status: "pendente", dmCanalId: null, createdAt: new Date() },
      { id: "3".repeat(24), deId: X, paraId: A, status: "aceito", dmCanalId: "9".repeat(24), createdAt: new Date() },
      { id: "4".repeat(24), deId: B, paraId: C, status: "pendente", dmCanalId: null, createdAt: new Date() }, // não é meu
    );
    const j = await (await GET()).json();
    expect(j.recebidos.map((c: any) => c.pessoa.id)).toEqual([B]);
    expect(j.enviados.map((c: any) => c.pessoa.id)).toEqual([C]);
    expect(j.contatos.map((c: any) => [c.pessoa.id, c.dmCanalId])).toEqual([[X, "9".repeat(24)]]);
  });

  it("#423 · histórico pro sino: aceitos e RECUSADOS, nas duas direções, do mais recente pro mais antigo", async () => {
    state.convites.push(
      { id: "1".repeat(24), deId: A, paraId: B, status: "aceito", dmCanalId: "9".repeat(24), createdAt: new Date("2026-10-01"), respondidoEm: new Date("2026-10-02") },
      { id: "2".repeat(24), deId: C, paraId: A, status: "recusado", dmCanalId: null, createdAt: new Date("2026-10-03"), respondidoEm: new Date("2026-10-05") },
      { id: "3".repeat(24), deId: A, paraId: X, status: "recusado", dmCanalId: null, createdAt: new Date("2026-10-01"), respondidoEm: new Date("2026-10-04") },
      { id: "4".repeat(24), deId: A, paraId: C, status: "pendente", dmCanalId: null, createdAt: new Date("2026-10-06") },
    );
    const j = await (await GET()).json();
    expect(j.historico.map((h: any) => [h.pessoa.id, h.direcao, h.status])).toEqual([
      [C, "recebido", "recusado"], // 05/10
      [X, "enviado", "recusado"],  // 04/10
      [B, "enviado", "aceito"],    // 02/10
    ]);
    // o pendente não entra no histórico; continua em "enviados"
    expect(j.enviados.map((c: any) => c.pessoa.id)).toEqual([C]);
    // recusado não vira contato
    expect(j.contatos.map((c: any) => c.pessoa.id)).toEqual([B]);
  });
});

describe("convites · #425 sino no banco", () => {
  const respondidos = () => state.convites.push(
    { id: "1".repeat(24), deId: A, paraId: B, status: "aceito", dmCanalId: "9".repeat(24), createdAt: new Date("2026-10-01"), respondidoEm: new Date("2026-10-02") },
    { id: "2".repeat(24), deId: C, paraId: A, status: "recusado", dmCanalId: null, createdAt: new Date("2026-10-08"), respondidoEm: new Date("2026-10-09") },
    { id: "3".repeat(24), deId: X, paraId: A, status: "pendente", dmCanalId: null, createdAt: new Date("2026-10-01") },
  );

  it("sem registro: sino em branco e o histórico inteiro", async () => {
    respondidos();
    const j = await (await GET()).json();
    expect(j.sino).toEqual({ vistoEm: null, limpoAte: null });
    expect(j.historico).toHaveLength(2);
  });

  it("limpou em 05/10: o histórico só traz o que veio depois; o pendente continua", async () => {
    respondidos();
    state.sinos.push({ userId: A, vistoEm: new Date("2026-10-05"), limpoAte: new Date("2026-10-05") });
    const j = await (await GET()).json();
    expect(j.historico.map((h: any) => h.pessoa.id)).toEqual([C]);
    expect(j.recebidos.map((c: any) => c.pessoa.id)).toEqual([X]);
    expect(j.sino).toEqual({ vistoEm: +new Date("2026-10-05"), limpoAte: +new Date("2026-10-05") });
  });

  it("o registro é por pessoa: o limpar da outra pessoa não mexe no meu", async () => {
    respondidos();
    state.sinos.push({ userId: B, vistoEm: new Date("2026-10-30"), limpoAte: new Date("2026-10-30") });
    const j = await (await GET()).json();
    expect(j.historico).toHaveLength(2);
    expect(j.sino.limpoAte).toBeNull();
  });

  it("limpar não muda os contatos (a conversa continua)", async () => {
    respondidos();
    state.sinos.push({ userId: A, vistoEm: new Date("2026-10-30"), limpoAte: new Date("2026-10-30") });
    const j = await (await GET()).json();
    expect(j.historico).toEqual([]);
    expect(j.contatos.map((c: any) => c.pessoa.id)).toEqual([B]);
  });
});

describe("convites · responder", () => {
  const pendente = () => { const c = { id: novoId(), deId: A, paraId: B, status: "pendente", dmCanalId: null, createdAt: new Date() }; state.convites.push(c); return c; };

  it("aceitar cria a conversa privada SÓ entre os dois e avisa quem convidou", async () => {
    const c = pendente();
    state.user = user(B);
    const r = await responder(c.id, "aceitar");
    expect(r.status).toBe(200);
    expect(state.canais).toHaveLength(1);
    expect(state.canais[0]).toMatchObject({ ownerId: A, dmCom: B, acesso: "privado", membros: [], agentes: [], titulo: "Giulia e Martinez" });
    expect(state.convites[0]).toMatchObject({ status: "aceito", dmCanalId: state.canais[0].id });
    expect(state.avisos.at(-1)![0]).toBe(`user_${A}`);
  });

  it("#423 · aceitar já abre a conversa com a linha 'fulano aceitou o convite e entrou na conversa'", async () => {
    const c = pendente();
    state.user = user(B);
    await responder(c.id, "aceitar");
    expect(state.mensagens).toHaveLength(1);
    expect(state.mensagens[0]).toMatchObject({ canalId: state.canais[0].id, autorTipo: "sistema", autorId: B, texto: "Martinez aceitou o convite e entrou na conversa" });
    // e vai pro canal em tempo real
    expect(state.avisos.some(([canal, ev]) => canal === `canal-${state.canais[0].id}` && ev === "mensagem")).toBe(true);
  });

  it("recusar não cria conversa nem aviso", async () => {
    const c = pendente();
    state.user = user(B);
    await responder(c.id, "recusar");
    expect(state.mensagens).toHaveLength(0);
  });

  it("recusar não cria conversa", async () => {
    const c = pendente();
    state.user = user(B);
    expect((await responder(c.id, "recusar")).status).toBe(200);
    expect(state.canais).toHaveLength(0);
    expect(state.convites[0]!.status).toBe("recusado");
  });

  it("quem convidou não pode aceitar pelo outro; terceiro também não (403)", async () => {
    const c = pendente();
    expect((await responder(c.id, "aceitar")).status).toBe(403);
    state.user = user(C);
    expect((await responder(c.id, "aceitar")).status).toBe(403);
    expect(state.canais).toHaveLength(0);
  });

  it("responder duas vezes → 409, e só UMA conversa é criada", async () => {
    const c = pendente();
    state.user = user(B);
    expect((await responder(c.id, "aceitar")).status).toBe(200);
    expect((await responder(c.id, "aceitar")).status).toBe(409);
    expect(state.canais).toHaveLength(1);
  });

  it("ação inválida → 400; convite inexistente → 404", async () => {
    const c = pendente();
    state.user = user(B);
    expect((await responder(c.id, "apagar")).status).toBe(400);
    expect((await responder("9".repeat(24), "aceitar")).status).toBe(404);
    expect((await responder("nope", "aceitar")).status).toBe(404);
  });
});

describe("convites · #425 o + chama alguém PARA A CONVERSA", () => {
  const CONVERSA = "e".repeat(24);
  // Giulia (A) é a dona da conversa de dois com o Martinez (B), o caso que deu errado em produção
  const conversaDeDois = () => { const c = { id: CONVERSA, ownerId: A, dmCom: B, acesso: "privado", membros: [] as string[], agentes: [], titulo: "Giulia e Martinez" }; state.canais.push(c); return c; };
  const chamar = (para: string, canalId: unknown = CONVERSA) => POST(post({ para, canalId }));

  it("dona chama a Ana: convite pendente ligado à conversa, e o aviso diz qual é", async () => {
    conversaDeDois();
    const r = await chamar("ana1@z.com");
    expect(r.status).toBe(201);
    expect((await r.json()).convite).toMatchObject({ canalId: CONVERSA, canalTitulo: "Giulia e Martinez", pessoa: { id: C } });
    expect(state.convites).toHaveLength(1);
    expect(state.convites[0]).toMatchObject({ deId: A, paraId: C, status: "pendente", canalId: CONVERSA });
    expect(state.avisos.at(-1)![0]).toBe(`user_${C}`);
    expect(state.avisos.at(-1)![2].text).toContain("Giulia e Martinez");
  });

  it("aceitar ENTRA na conversa: não cria outra, e a conversa de dois vira grupo privado com os três", async () => {
    const conversa = conversaDeDois();
    await chamar("ana1@z.com");
    state.user = user(C);
    const r = await responder(state.convites[0]!.id, "aceitar");
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(state.canais).toHaveLength(1); // nenhuma conversa nova
    expect(j.canal.id).toBe(CONVERSA);
    expect(conversa.dmCom).toBeNull();
    expect(conversa.acesso).toBe("privado");
    expect(conversa.membros.sort()).toEqual([B, C].sort());
    expect(conversa.ownerId).toBe(A);
    // a linha "Ana aceitou o convite e entrou na conversa" na própria conversa
    expect(state.mensagens.map((m) => [m.canalId, m.autorTipo])).toEqual([[CONVERSA, "sistema"]]);
    // e o sino de quem convidou abre a MESMA conversa
    expect(state.convites[0]!.dmCanalId).toBe(CONVERSA);
  });

  it("depois do aceite: as três pessoas leem; quem é de fora continua barrado", async () => {
    const { podeLer } = await import("@/lib/canal/gate");
    const conversa = conversaDeDois();
    await chamar("ana1@z.com");
    state.user = user(C);
    await responder(state.convites[0]!.id, "aceitar");
    for (const quem of [A, B, C]) expect(podeLer(conversa, quem)).toBe(true);
    expect(podeLer(conversa, X)).toBe(false);
  });

  it("recusar: ninguém entra e a conversa continua de dois", async () => {
    const conversa = conversaDeDois();
    await chamar("ana1@z.com");
    state.user = user(C);
    expect((await responder(state.convites[0]!.id, "recusar")).status).toBe(200);
    expect(conversa.dmCom).toBe(B);
    expect(conversa.membros).toEqual([]);
  });

  it("só a dona chama: o Martinez (que não é dono) recebe 403 e nada é criado", async () => {
    conversaDeDois();
    state.user = user(B);
    const r = await chamar("ana1@z.com");
    expect(r.status).toBe(403);
    expect(state.convites).toHaveLength(0);
  });

  it("quem já está na conversa → 409; convite pendente repetido → 409", async () => {
    conversaDeDois();
    expect((await chamar("martinez@z.com")).status).toBe(409);
    expect((await chamar("ana1@z.com")).status).toBe(201);
    expect((await chamar("ana1@z.com")).status).toBe(409);
    expect(state.convites).toHaveLength(1);
  });

  it("conversa inexistente ou id inválido → 404", async () => {
    expect((await chamar("ana1@z.com")).status).toBe(404);
    expect((await chamar("ana1@z.com", "nope")).status).toBe(404);
  });

  it("a conversa sumiu antes do aceite → 410, e o convite continua pendente", async () => {
    conversaDeDois();
    await chamar("ana1@z.com");
    state.canais = [];
    state.user = user(C);
    expect((await responder(state.convites[0]!.id, "aceitar")).status).toBe(410);
    expect(state.convites[0]!.status).toBe("pendente");
  });

  it("já ser contato não impede chamar pra conversa (antes o + só dizia 'vocês já são contatos')", async () => {
    conversaDeDois();
    state.convites.push({ id: novoId(), deId: A, paraId: C, status: "aceito", dmCanalId: "9".repeat(24), createdAt: new Date() });
    expect((await chamar("ana1@z.com")).status).toBe(201);
  });

  it("entrar numa conversa pelo convite dela não vira 'contato'; o sino mostra o título", async () => {
    conversaDeDois();
    await chamar("ana1@z.com");
    state.user = user(C);
    await responder(state.convites[0]!.id, "aceitar");
    const j = await (await GET()).json();
    expect(j.contatos).toEqual([]);
    expect(j.historico[0]).toMatchObject({ canalId: CONVERSA, canalTitulo: "Giulia e Martinez", dmCanalId: CONVERSA, status: "aceito" });
  });

  it("sem canalId continua o convite de contato de sempre (cria a conversa de dois no aceite)", async () => {
    expect((await POST(post({ para: "ana1@z.com" }))).status).toBe(201);
    state.user = user(C);
    await responder(state.convites[0]!.id, "aceitar");
    expect(state.canais).toHaveLength(1);
    expect(state.canais[0]).toMatchObject({ ownerId: A, dmCom: C });
  });
});
