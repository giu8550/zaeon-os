import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.NEXTAUTH_SECRET = "segredo-de-teste";
import { criarConvite, lerConvite, VALIDADE_MS } from "@/lib/cartolina/convite";

const BOARD = "f".repeat(24);

describe("convite · token assinado", () => {
  it("ida e volta", () => {
    expect(lerConvite(criarConvite(BOARD, "editor", "sal1"), BOARD)).toEqual({ boardId: BOARD, papel: "editor", sal: "sal1" });
  });
  it("adulterado (promover leitor → editor) é recusado", () => {
    const [dados, mac] = criarConvite(BOARD, "leitor", "s").split(".");
    const o = JSON.parse(Buffer.from(dados, "base64url").toString());
    const forjado = Buffer.from(JSON.stringify({ ...o, p: "editor" })).toString("base64url") + "." + mac;
    expect(lerConvite(forjado, BOARD)).toBeNull();
  });
  it("token de outro board não abre este", () => {
    expect(lerConvite(criarConvite("e".repeat(24), "editor", "s"), BOARD)).toBeNull();
  });
  it("vencido é recusado", () => {
    const t = criarConvite(BOARD, "editor", "s", 0);
    expect(lerConvite(t, BOARD, VALIDADE_MS + 1)).toBeNull();
  });
  it("lixo nunca lança", () => {
    for (const t of [undefined, 42, "", "a", "a.b", "a.b.c", "x".repeat(700), "%%%.%%%"]) expect(lerConvite(t, BOARD)).toBeNull();
  });
  it("outro segredo = assinatura inválida", () => {
    const t = criarConvite(BOARD, "editor", "s");
    process.env.NEXTAUTH_SECRET = "outro";
    expect(lerConvite(t, BOARD)).toBeNull();
    process.env.NEXTAUTH_SECRET = "segredo-de-teste";
  });
});

// ── store em memória ────────────────────────────────────────────────────────────────────
const db = vi.hoisted(() => ({ boards: new Map<string, any>(), membros: [] as any[], coments: [] as any[], seq: 0 }));
const oid = () => String(++db.seq).padStart(24, "0");
vi.mock("@/src/lib/prisma", () => ({
  prisma: {
    cartolina: {
      findUnique: async ({ where }: any) => db.boards.get(where.id) ?? null,
      update: async ({ where, data }: any) => Object.assign(db.boards.get(where.id), data),
    },
    cartolinaMembro: {
      findUnique: async ({ where: { cartolinaId_userId: k } }: any) => db.membros.find((m) => m.cartolinaId === k.cartolinaId && m.userId === k.userId) ?? null,
      findMany: async ({ where }: any) => db.membros.filter((m) => m.cartolinaId === where.cartolinaId),
      upsert: async ({ where: { cartolinaId_userId: k }, create, update }: any) => {
        const m = db.membros.find((x) => x.cartolinaId === k.cartolinaId && x.userId === k.userId);
        if (m) return Object.assign(m, update);
        db.membros.push({ ...create }); return create;
      },
      deleteMany: async ({ where }: any) => { db.membros = db.membros.filter((m) => !(m.cartolinaId === where.cartolinaId && m.userId === where.userId)); return { count: 1 }; },
    },
    cartolinaComentario: {
      findMany: async ({ where }: any) => db.coments.filter((c) => c.cartolinaId === where.cartolinaId && (!where.createdAt || c.createdAt > where.createdAt.gt)),
      findFirst: async ({ where }: any) => db.coments.find((c) => c.id === where.id && c.cartolinaId === where.cartolinaId && c.cardId === where.cardId) ?? null,
      create: async ({ data }: any) => { const c = { id: oid(), createdAt: new Date(Date.now() + db.seq), ...data }; db.coments.push(c); return c; },
    },
    user: { findMany: async ({ where }: any) => where.id.in.map((id: string) => ({ id, name: `Nome ${id.slice(-1)}`, image: null })) },
  },
}));

import { gerarLink, revogarLinks, entrarPorConvite, listarMembros, removerMembro, comentar, listarComentarios } from "@/lib/cartolina/cowork-store";

const A = "a".repeat(24), B = "b".repeat(24), C = "c".repeat(24), D = "d".repeat(24);
const card = (id: string) => ({ id, tipo: "nota", titulo: id, x: 0, y: 0, w: 300 });

beforeEach(() => {
  db.boards.clear(); db.membros = []; db.coments = []; db.seq = 100;
  db.boards.set(BOARD, { id: BOARD, ownerId: A, surface: "estudos", scopeId: null, titulo: "T", cards: [card("k1"), card("k2")], rev: 0, conviteSalt: null, updatedAt: new Date() });
});

describe("compartilhar → entrar", () => {
  it("fluxo de aceite: A gera link de editor, B entra e passa a ver/escrever", async () => {
    const l = await gerarLink(BOARD, A, "editor");
    expect(l.ok).toBe(true);
    const j = await entrarPorConvite(BOARD, B, (l as any).token);
    expect(j).toEqual({ ok: true, papel: "editor" });
    expect((await listarMembros(BOARD, B) as any).membros.map((m: any) => m.papel)).toEqual(["dono", "editor"]);
  });
  it("só o dono gera link; estranho nem sabe que o board existe", async () => {
    db.membros.push({ cartolinaId: BOARD, userId: B, papel: "editor" });
    expect(await gerarLink(BOARD, B, "editor")).toEqual({ ok: false, reason: "forbidden" });
    expect(await gerarLink(BOARD, D, "editor")).toEqual({ ok: false, reason: "not_found" });
  });
  it("revogar mata os links já enviados (mas quem entrou continua)", async () => {
    const t1 = (await gerarLink(BOARD, A, "editor") as any).token;
    await entrarPorConvite(BOARD, B, t1);
    await revogarLinks(BOARD, A);
    expect(await entrarPorConvite(BOARD, C, t1)).toEqual({ ok: false, reason: "invalid" });
    expect(db.membros.some((m) => m.userId === B)).toBe(true);
    const t2 = (await gerarLink(BOARD, A, "editor") as any).token; // link novo funciona
    expect((await entrarPorConvite(BOARD, C, t2)).ok).toBe(true);
  });
  it("entrar é idempotente e nunca rebaixa", async () => {
    const ed = (await gerarLink(BOARD, A, "editor") as any).token;
    const le = (await gerarLink(BOARD, A, "leitor") as any).token;
    await entrarPorConvite(BOARD, B, ed);
    expect(await entrarPorConvite(BOARD, B, le)).toEqual({ ok: true, papel: "editor" });
    expect(await entrarPorConvite(BOARD, B, ed)).toEqual({ ok: true, papel: "editor" });
    expect(db.membros.filter((m) => m.userId === B)).toHaveLength(1);
    // leitor que recebe link de editor sobe
    await entrarPorConvite(BOARD, C, le);
    expect(await entrarPorConvite(BOARD, C, ed)).toEqual({ ok: true, papel: "editor" });
  });
  it("dono abrindo o próprio link não vira linha de membro", async () => {
    const t = (await gerarLink(BOARD, A, "leitor") as any).token;
    expect(await entrarPorConvite(BOARD, A, t)).toEqual({ ok: true, papel: "dono" });
    expect(db.membros).toHaveLength(0);
  });
  it("board inexistente / id malformado / board nunca compartilhado", async () => {
    const t = (await gerarLink(BOARD, A, "editor") as any).token;
    expect((await entrarPorConvite("nao", B, t)).ok).toBe(false);
    expect((await entrarPorConvite("9".repeat(24), B, t)).ok).toBe(false);
    db.boards.get(BOARD).conviteSalt = null;
    expect(await entrarPorConvite(BOARD, B, t)).toEqual({ ok: false, reason: "invalid" });
  });
  it("remover membro: só o dono, e o removido perde o acesso", async () => {
    db.membros.push({ cartolinaId: BOARD, userId: B, papel: "editor" }, { cartolinaId: BOARD, userId: C, papel: "editor" });
    expect(await removerMembro(BOARD, B, C)).toEqual({ ok: false, reason: "forbidden" });
    expect(await removerMembro(BOARD, A, "lixo")).toEqual({ ok: false, reason: "invalid" });
    expect(await removerMembro(BOARD, A, C)).toEqual({ ok: true });
    expect(await listarMembros(BOARD, C)).toEqual({ ok: false, reason: "not_found" });
  });
  it("lista de membros não expõe e-mail", async () => {
    const r = await listarMembros(BOARD, A) as any;
    expect(Object.keys(r.membros[0]).sort()).toEqual(["imagem", "nome", "papel", "userId"]);
  });
});

describe("comentários e threads", () => {
  beforeEach(() => {
    db.membros.push({ cartolinaId: BOARD, userId: B, papel: "editor" }, { cartolinaId: BOARD, userId: C, papel: "leitor" });
  });
  it("A e B comentam e respondem; os dois veem a mesma thread", async () => {
    const raiz = await comentar(BOARD, A, { cardId: "k1", texto: "Isso cai na prova?" }) as any;
    await comentar(BOARD, B, { cardId: "k1", texto: "Cai sim", parentId: raiz.id });
    const visto = (await listarComentarios(BOARD, A) as any).comentarios;
    expect(visto.map((c: any) => [c.texto, c.parentId])).toEqual([["Isso cai na prova?", null], ["Cai sim", raiz.id]]);
    expect((await listarComentarios(BOARD, B) as any).comentarios).toHaveLength(2);
  });
  it("leitor lê mas não comenta; estranho nem lê", async () => {
    await comentar(BOARD, A, { cardId: "k1", texto: "oi" });
    expect((await listarComentarios(BOARD, C) as any).comentarios).toHaveLength(1);
    expect(await comentar(BOARD, C, { cardId: "k1", texto: "x" })).toEqual({ ok: false, reason: "forbidden" });
    expect(await listarComentarios(BOARD, D)).toEqual({ ok: false, reason: "not_found" });
    expect(await comentar(BOARD, D, { cardId: "k1", texto: "x" })).toEqual({ ok: false, reason: "not_found" });
  });
  it("card inexistente, texto vazio e resposta pra comentário de OUTRO card são recusados", async () => {
    const raiz = await comentar(BOARD, A, { cardId: "k1", texto: "a" }) as any;
    expect((await comentar(BOARD, A, { cardId: "zzz", texto: "a" })).ok).toBe(false);
    expect((await comentar(BOARD, A, { cardId: "k1", texto: "   " })).ok).toBe(false);
    expect(await comentar(BOARD, A, { cardId: "k2", texto: "a", parentId: raiz.id })).toEqual({ ok: false, reason: "invalid" });
    expect(await comentar(BOARD, A, { cardId: "k1", texto: "a", parentId: "lixo" })).toEqual({ ok: false, reason: "invalid" });
  });
  it("resposta de resposta pendura na raiz (thread de um nível)", async () => {
    const r = await comentar(BOARD, A, { cardId: "k1", texto: "raiz" }) as any;
    const r1 = await comentar(BOARD, B, { cardId: "k1", texto: "r1", parentId: r.id }) as any;
    await comentar(BOARD, A, { cardId: "k1", texto: "r2", parentId: r1.id });
    expect(db.coments.at(-1).parentId).toBe(r.id);
  });
  it("texto é cortado no máximo", async () => {
    await comentar(BOARD, A, { cardId: "k1", texto: "x".repeat(5000) });
    expect(db.coments.at(-1).texto.length).toBe(2000);
  });
  it("?desde traz só os novos (polling barato)", async () => {
    await comentar(BOARD, A, { cardId: "k1", texto: "velho" });
    const corte = db.coments.at(-1).createdAt;
    await comentar(BOARD, B, { cardId: "k1", texto: "novo" });
    expect((await listarComentarios(BOARD, A, corte) as any).comentarios.map((c: any) => c.texto)).toEqual(["novo"]);
  });
});
