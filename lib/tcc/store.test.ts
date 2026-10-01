import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma em memória (works + revisões + cartolina/membros pra papel) ─────────────────────
const db = vi.hoisted(() => ({
  works: new Map<string, any>(),
  revs: new Map<string, any>(),
  boards: [] as any[],
  membros: [] as any[],
  seq: 0,
  hookAntesUpdate: null as null | (() => void),
}));
const oid = () => (++db.seq).toString(16).padStart(24, "0");
const match = (row: any, where: any): boolean =>
  Object.entries(where ?? {}).every(([k, v]: [string, any]) => {
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      if ("not" in v) return row[k] !== v.not;
      if ("gte" in v) return row[k] >= v.gte;
    }
    return row[k] === v;
  });
const clone = <T,>(x: T): T => structuredClone(x);

vi.mock("@/src/lib/prisma", () => ({
  prisma: {
    researchWork: {
      findUnique: async ({ where }: any) => (db.works.has(where.id) ? clone(db.works.get(where.id)) : null),
      findFirst: async ({ where }: any) => {
        const rows = [...db.works.values()].filter((w) => match(w, where)).sort((a, b) => b.updatedAt - a.updatedAt);
        return rows[0] ? clone(rows[0]) : null;
      },
      create: async ({ data }: any) => {
        const row = { id: oid(), rev: 0, title: null, content: null, workType: null, scopeId: null, secoes: null, tccStatus: null, createdAt: new Date(), updatedAt: Date.now(), ...data };
        db.works.set(row.id, row);
        return clone(row);
      },
      updateMany: async ({ where, data }: any) => {
        db.hookAntesUpdate?.();
        const rows = [...db.works.values()].filter((w) => match(w, where));
        for (const w of rows) Object.assign(w, data, { updatedAt: Date.now() });
        return { count: rows.length };
      },
    },
    tccRevisao: {
      createMany: async ({ data }: any) => {
        for (const d of data) { const id = oid(); db.revs.set(id, { id, status: "aplicada", op: "substituir", createdAt: new Date(Date.now() + db.seq), fontes: null, nota: null, ...d }); }
        return { count: data.length };
      },
      create: async ({ data }: any) => {
        const id = oid();
        const row = { id, createdAt: new Date(Date.now() + db.seq), fontes: null, nota: null, ...data };
        db.revs.set(id, row);
        return clone(row);
      },
      findMany: async ({ where, orderBy, take }: any) => {
        const rows = [...db.revs.values()].filter((r) => match(r, where));
        rows.sort((a, b) => (orderBy?.createdAt === "desc" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
        return clone(rows.slice(0, take ?? rows.length));
      },
      findFirst: async ({ where }: any) => {
        const r = [...db.revs.values()].find((x) => match(x, where));
        return r ? clone(r) : null;
      },
      updateMany: async ({ where, data }: any) => {
        const rows = [...db.revs.values()].filter((x) => match(x, where));
        for (const r of rows) Object.assign(r, data);
        return { count: rows.length };
      },
      update: async ({ where, data }: any) => { Object.assign(db.revs.get(where.id), data); return clone(db.revs.get(where.id)); },
    },
    cartolina: {
      findFirst: async ({ where }: any) => db.boards.find((b) => match(b, where)) ?? null,
    },
    cartolinaMembro: {
      findUnique: async ({ where }: any) => {
        const k = where.cartolinaId_userId;
        return db.membros.find((m) => m.cartolinaId === k.cartolinaId && m.userId === k.userId) ?? null;
      },
    },
  },
}));

import {
  aplicarConteudoManual, aplicarNoTcc, criarTcc, decidirSugestao, desfazerRevisao, findTccDoEscopo, getTccForUser,
  historicoDoTcc, listarSugestoes, marcarStatus, opDeAceite, referenciasNovas, revisaoView, sugerirNoTcc, tccCrossOn,
} from "@/lib/tcc/store";

const DONO = "a".repeat(24), EDITOR = "b".repeat(24), LEITOR = "c".repeat(24), ESTRANHO = "d".repeat(24);

async function tccBase(scopeId: string | null = "aba1") {
  return criarTcc({
    userId: DONO, scopeId, titulo: "Fotossíntese", origem: "estudos",
    secoes: [{ titulo: "INTRODUÇÃO", corpo: "intro" }, { titulo: "METODOLOGIA" }, { titulo: "REFERÊNCIAS", corpo: "SILVA, J. Livro. 2020." }],
  });
}
const revsDe = (workId: string) => [...db.revs.values()].filter((r) => r.workId === workId);

beforeEach(() => {
  db.works.clear(); db.revs.clear(); db.boards = []; db.membros = []; db.seq = 0; db.hookAntesUpdate = null;
});

describe("flag", () => {
  it("TCC_CROSS só liga com '1'", () => {
    delete process.env.TCC_CROSS; expect(tccCrossOn()).toBe(false);
    process.env.TCC_CROSS = "1"; expect(tccCrossOn()).toBe(true);
  });
});

describe("entrelace: criar o TCC amarrado à conversa", () => {
  it("cria ResearchWork com scopeId, seções, espelho markdown e histórico das seções com texto", async () => {
    const t = await tccBase();
    const row = db.works.get(t.id);
    expect(row).toMatchObject({ userId: DONO, scopeId: "aba1", workType: "TCC", tccStatus: "pronto" });
    expect(row.secoes.map((s: any) => s.id)).toEqual(["introducao", "metodologia", "referencias"]);
    expect(row.content).toContain("# INTRODUÇÃO\n\nintro");
    expect(revsDe(t.id).map((r) => [r.secaoId, r.origem, r.op, r.antes])).toEqual([
      ["introducao", "estudos", "inserir", null], ["referencias", "estudos", "inserir", null],
    ]);
    expect(t.papel).toBe("dono");
  });
  it("findTccDoEscopo acha o TCC da conversa do dono (e só se for TCC)", async () => {
    const t = await tccBase();
    expect((await findTccDoEscopo(DONO, "aba1"))?.id).toBe(t.id);
    expect(await findTccDoEscopo(DONO, "outra")).toBeNull();
    expect(await findTccDoEscopo(EDITOR, "aba1")).toBeNull();
    db.works.get(t.id).secoes = null; // work comum com o mesmo scope não conta
    expect(await findTccDoEscopo(DONO, "aba1")).toBeNull();
  });
});

describe("autorização / IDOR", () => {
  beforeEach(() => {
    db.boards.push({ id: "e".repeat(24), ownerId: DONO, surface: "estudos", scopeId: "aba1" });
    db.membros.push({ cartolinaId: "e".repeat(24), userId: EDITOR, papel: "editor" }, { cartolinaId: "e".repeat(24), userId: LEITOR, papel: "leitor" });
  });
  it("dono e membros da conversa leem; estranho não (null = 404)", async () => {
    const t = await tccBase();
    expect((await getTccForUser(t.id, EDITOR))?.papel).toBe("editor");
    expect((await getTccForUser(t.id, LEITOR))?.papel).toBe("leitor");
    expect(await getTccForUser(t.id, ESTRANHO)).toBeNull();
    expect(await getTccForUser(t.id, "")).toBeNull();
    expect(await getTccForUser("nao-e-objectid", DONO)).toBeNull();
    expect(await getTccForUser("f".repeat(24), DONO)).toBeNull();
  });
  it("TCC sem scopeId: só o dono", async () => {
    const t = await tccBase(null);
    expect(await getTccForUser(t.id, EDITOR)).toBeNull();
  });
  it("membro de OUTRA conversa não ganha acesso", async () => {
    db.boards.push({ id: "9".repeat(24), ownerId: DONO, surface: "estudos", scopeId: "aba2" });
    db.membros.push({ cartolinaId: "9".repeat(24), userId: ESTRANHO, papel: "editor" });
    const t = await tccBase();
    expect(await getTccForUser(t.id, ESTRANHO)).toBeNull();
  });
  it("leitor NÃO edita, não sugere, não decide, não desfaz (forbidden = 403)", async () => {
    const t = await tccBase();
    expect(await aplicarNoTcc(t.id, LEITOR, [{ op: "anexar", secaoId: "introducao", corpo: "x" }], "aluno")).toEqual({ ok: false, reason: "forbidden" });
    expect(await sugerirNoTcc(t.id, LEITOR, [{ op: "anexar", secaoId: "introducao", corpo: "x" }])).toEqual({ ok: false, reason: "forbidden" });
    const s = await sugerirNoTcc(t.id, DONO, [{ op: "anexar", secaoId: "introducao", corpo: "x" }]);
    if (!s.ok) throw new Error();
    expect(await decidirSugestao(t.id, s.revisoes[0].id, LEITOR, true)).toEqual({ ok: false, reason: "forbidden" });
  });
  it("editor da conversa edita (e a revisão registra o autor)", async () => {
    const t = await tccBase();
    const r = await aplicarNoTcc(t.id, EDITOR, [{ op: "anexar", secaoId: "metodologia", corpo: "m" }], "aluno");
    expect(r.ok).toBe(true);
    expect(revsDe(t.id).find((x) => x.secaoId === "metodologia")?.autorId).toBe(EDITOR);
  });
  it("estranho editando = not_found (não vaza que o id existe)", async () => {
    const t = await tccBase();
    expect(await aplicarNoTcc(t.id, ESTRANHO, [], "aluno")).toEqual({ ok: false, reason: "not_found" });
    expect(await historicoDoTcc(t.id, ESTRANHO)).toBeNull();
    expect(await desfazerRevisao(t.id, "1".repeat(24), ESTRANHO)).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("edição por seção + última vence + desfazer", () => {
  it("op inválida = invalid (nada gravado)", async () => {
    const t = await tccBase();
    const antes = db.works.get(t.id).rev;
    expect(await aplicarNoTcc(t.id, DONO, [{ op: "substituir", secaoId: "nao-existe", corpo: "x" }], "aluno"))
      .toEqual({ ok: false, reason: "invalid", detalhe: "secao_inexistente" });
    expect(db.works.get(t.id).rev).toBe(antes);
  });
  it("2 edições na mesma seção → vale a última; o histórico restaura a anterior", async () => {
    const t = await tccBase();
    await aplicarNoTcc(t.id, DONO, [{ op: "substituir", secaoId: "introducao", corpo: "versão estudos" }], "estudos");
    await aplicarNoTcc(t.id, DONO, [{ op: "substituir", secaoId: "introducao", corpo: "versão aluno" }], "aluno");
    expect((await getTccForUser(t.id, DONO))!.secoes[0].corpo).toBe("versão aluno");

    const hist = (await historicoDoTcc(t.id, DONO))!.filter((r) => r.secaoId === "introducao");
    expect(hist.map((r) => [r.origem, r.antes, r.depois])).toEqual([
      ["aluno", "versão estudos", "versão aluno"],
      ["estudos", "intro", "versão estudos"],
      ["estudos", null, "intro"],
    ]);
    const d = await desfazerRevisao(t.id, hist[0].id, DONO);
    if (!d.ok) throw new Error(d.reason);
    expect(d.tcc.secoes[0].corpo).toBe("versão estudos");
    const ultima = (await historicoDoTcc(t.id, DONO))![0];
    expect(ultima).toMatchObject({ op: "restaurar", origem: "aluno", antes: "versão aluno", depois: "versão estudos" });
  });
  it("edições em seções diferentes não se apagam mesmo em corrida (rev otimista)", async () => {
    const t = await tccBase();
    let uma = true;
    db.hookAntesUpdate = () => {
      if (!uma) return; uma = false;
      // outra sala grava no meio: muda a METODOLOGIA e sobe o rev
      const w = db.works.get(t.id);
      w.secoes = w.secoes.map((s: any) => (s.id === "metodologia" ? { ...s, corpo: "da outra sala" } : s));
      w.rev += 1;
    };
    const r = await aplicarNoTcc(t.id, DONO, [{ op: "anexar", secaoId: "introducao", corpo: "minha" }], "aluno");
    if (!r.ok) throw new Error();
    const final = (await getTccForUser(t.id, DONO))!.secoes;
    expect(final.find((s) => s.id === "metodologia")!.corpo).toBe("da outra sala");
    expect(final.find((s) => s.id === "introducao")!.corpo).toBe("intro\n\nminha");
  });
  it("perder a corrida 5 vezes = conflict", async () => {
    const t = await tccBase();
    db.hookAntesUpdate = () => { db.works.get(t.id).rev += 1; };
    expect(await aplicarNoTcc(t.id, DONO, [{ op: "anexar", secaoId: "introducao", corpo: "x" }], "aluno")).toEqual({ ok: false, reason: "conflict" });
  });
  it("sem mudança nenhuma = ok sem gravar nada", async () => {
    const t = await tccBase();
    const r = await aplicarNoTcc(t.id, DONO, [], "aluno");
    expect(r.ok && r.efeitos).toEqual([]);
    expect(db.works.get(t.id).rev).toBe(0);
  });
  it("desfazer uma inserção remove a seção; revisão inexistente = not_found", async () => {
    const t = await tccBase();
    await aplicarNoTcc(t.id, DONO, [{ op: "inserir", titulo: "APÊNDICE", corpo: "ap" }], "estudos");
    const ins = (await historicoDoTcc(t.id, DONO))!.find((r) => r.secaoId === "apendice")!;
    const d = await desfazerRevisao(t.id, ins.id, DONO);
    expect(d.ok && d.tcc.secoes.some((s) => s.id === "apendice")).toBe(false);
    expect(await desfazerRevisao(t.id, "lixo", DONO)).toEqual({ ok: false, reason: "not_found" });
  });
  it("marcarStatus muda só o status, e só do dono", async () => {
    const t = await tccBase();
    await marcarStatus(t.id, EDITOR, "erro");
    expect(db.works.get(t.id).tccStatus).toBe("pronto");
    await marcarStatus(t.id, DONO, "gerando");
    expect((await getTccForUser(t.id, DONO))!.status).toBe("gerando");
  });
  it("título novo junto da edição", async () => {
    const t = await tccBase();
    const r = await aplicarNoTcc(t.id, DONO, [], "aluno", { titulo: "  Novo título " });
    expect(r.ok && r.tcc.titulo).toBe("Novo título");
  });
});

describe("Pesquisa: sugestões (nunca muda em silêncio)", () => {
  const fontes = [{ abnt: "SOUZA, A. Artigo. Revista, 2021.", url: "https://x" }];

  it("sugerir grava status 'sugerida' com antes/depois calculados e NÃO muda o documento", async () => {
    const t = await tccBase();
    const s = await sugerirNoTcc(t.id, DONO, [
      { op: "anexar", secaoId: "introducao", corpo: "com rigor (SOUZA, 2021).", fontes, nota: "fundamenta" },
      { op: "substituir", secaoId: "nao-existe", corpo: "x" }, // inválida: some
    ]);
    if (!s.ok) throw new Error();
    expect(s.revisoes).toHaveLength(1);
    expect(s.revisoes[0]).toMatchObject({ status: "sugerida", origem: "pesquisa", antes: "intro", depois: "intro\n\ncom rigor (SOUZA, 2021).", nota: "fundamenta" });
    expect(s.revisoes[0].fontes).toEqual(fontes);
    expect((await getTccForUser(t.id, DONO))!.secoes[0].corpo).toBe("intro");
    expect((await listarSugestoes(t.id)).map((r) => r.id)).toEqual([s.revisoes[0].id]);
  });
  it("aceitar → 'aplicada', aplica o depois, guarda o antes REAL e leva a fonte pra REFERÊNCIAS", async () => {
    const t = await tccBase();
    const s = await sugerirNoTcc(t.id, DONO, [{ op: "substituir", secaoId: "introducao", corpo: "intro rigorosa (SOUZA, 2021).", fontes }]);
    if (!s.ok) throw new Error();
    await aplicarNoTcc(t.id, DONO, [{ op: "substituir", secaoId: "introducao", corpo: "o aluno mexeu" }], "aluno");
    const d = await decidirSugestao(t.id, s.revisoes[0].id, DONO, true);
    if (!d.ok) throw new Error(d.reason);
    expect(d.revisao).toMatchObject({ status: "aplicada", antes: "o aluno mexeu", depois: "intro rigorosa (SOUZA, 2021)." });
    const doc = (await getTccForUser(t.id, DONO))!;
    expect(doc.secoes[0].corpo).toBe("intro rigorosa (SOUZA, 2021).");
    expect(doc.secoes.find((x) => x.id === "referencias")!.corpo).toBe("SILVA, J. Livro. 2020.\n\nSOUZA, A. Artigo. Revista, 2021.");
    // uma linha por mudança: a sugestão VIRA a aplicada (sem duplicata da seção principal)
    expect(revsDe(t.id).filter((r) => r.secaoId === "introducao" && r.origem === "pesquisa")).toHaveLength(1);
    expect(await listarSugestoes(t.id)).toEqual([]);
    // e desfazer a sugestão aceita devolve o que o aluno tinha
    const u = await desfazerRevisao(t.id, s.revisoes[0].id, DONO);
    expect(u.ok && u.tcc.secoes[0].corpo).toBe("o aluno mexeu");
  });
  it("aceitar duas vezes não aplica duas vezes", async () => {
    const t = await tccBase();
    const s = await sugerirNoTcc(t.id, DONO, [{ op: "anexar", secaoId: "metodologia", corpo: "m" }]);
    if (!s.ok) throw new Error();
    expect((await decidirSugestao(t.id, s.revisoes[0].id, DONO, true)).ok).toBe(true);
    expect(await decidirSugestao(t.id, s.revisoes[0].id, DONO, true)).toEqual({ ok: false, reason: "not_found" });
    expect((await getTccForUser(t.id, DONO))!.secoes[1].corpo).toBe("m");
  });
  it("rejeitar → 'rejeitada' e o documento não muda", async () => {
    const t = await tccBase();
    const s = await sugerirNoTcc(t.id, DONO, [{ op: "substituir", secaoId: "introducao", corpo: "outra" }]);
    if (!s.ok) throw new Error();
    const d = await decidirSugestao(t.id, s.revisoes[0].id, DONO, false);
    expect(d.ok && d.revisao.status).toBe("rejeitada");
    expect(db.revs.get(s.revisoes[0].id).status).toBe("rejeitada");
    expect((await getTccForUser(t.id, DONO))!.secoes[0].corpo).toBe("intro");
    expect(await decidirSugestao(t.id, s.revisoes[0].id, DONO, false)).toEqual({ ok: false, reason: "not_found" });
  });
  it("sugestão de outro TCC / id lixo = not_found", async () => {
    const t1 = await tccBase();
    const t2 = await tccBase("aba2");
    const s = await sugerirNoTcc(t1.id, DONO, [{ op: "anexar", secaoId: "introducao", corpo: "x" }]);
    if (!s.ok) throw new Error();
    expect(await decidirSugestao(t2.id, s.revisoes[0].id, DONO, true)).toEqual({ ok: false, reason: "not_found" });
    expect(await decidirSugestao(t1.id, "zz", DONO, true)).toEqual({ ok: false, reason: "not_found" });
    expect(await sugerirNoTcc("f".repeat(24), DONO, [])).toEqual({ ok: false, reason: "not_found" });
  });
  it("aceite que falha (seção sumiu e a op ficou inválida) devolve a sugestão pra fila", async () => {
    const t = await tccBase();
    const s = await sugerirNoTcc(t.id, DONO, [{ op: "inserir", titulo: "NOVA", corpo: "n" }]);
    if (!s.ok) throw new Error();
    db.works.get(t.id).secoes = Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, titulo: `S${i}`, corpo: "" })); // cheio
    expect(await decidirSugestao(t.id, s.revisoes[0].id, DONO, true)).toEqual({ ok: false, reason: "invalid" });
    expect(db.revs.get(s.revisoes[0].id).status).toBe("sugerida");
  });
});

describe("helpers de aceite", () => {
  const sec = [{ id: "a", titulo: "A", corpo: "base editada" }, { id: "referencias", titulo: "REFERÊNCIAS", corpo: "SOUZA, A. Artigo. 2021." }];
  const rev = (x: any) => revisaoView({ id: "r", secaoId: "a", titulo: "A", op: "substituir", origem: "pesquisa", antes: "base", depois: "base\n\nnovo", status: "sugerida", autorId: "u", createdAt: new Date(), ...x });
  it("anexar sobre texto que mudou anexa SÓ o trecho novo", () => {
    expect(opDeAceite(rev({ op: "anexar" }), sec)).toEqual({ op: "anexar", secaoId: "a", corpo: "novo" });
  });
  it("substituir aplica o depois; seção sumida vira inserir com o mesmo id; remover remove", () => {
    expect(opDeAceite(rev({}), sec)).toEqual({ op: "substituir", secaoId: "a", corpo: "base\n\nnovo" });
    expect(opDeAceite(rev({ secaoId: "sumiu" }), sec)).toEqual({ op: "inserir", titulo: "A", corpo: "base\n\nnovo", secaoId: "sumiu" });
    expect(opDeAceite(rev({ op: "remover" }), sec)).toEqual({ op: "remover", secaoId: "a" });
  });
  it("referenciasNovas: dedupe contra a seção e entre si; sem seção = cria", () => {
    const f = [{ abnt: "SOUZA, A. Artigo. 2021." }, { abnt: "LIMA, B. Tese. 2019." }, { abnt: "lima, b. tese. 2019." }];
    expect(referenciasNovas(sec, f).novas).toEqual(["LIMA, B. Tese. 2019."]);
    expect(referenciasNovas([], f)).toEqual({ secao: null, novas: ["SOUZA, A. Artigo. 2021.", "LIMA, B. Tese. 2019."] });
  });
  it("revisaoView limpa fontes corrompidas", () => {
    expect(rev({ fontes: [{ abnt: "X", url: 3 }, { lixo: 1 }, null] }).fontes).toEqual([{ abnt: "X" }]);
    expect(rev({ fontes: "x" }).fontes).toEqual([]);
  });
});

describe("edição manual pelo editor da Sala de Pesquisa", () => {
  it("markdown inteiro vira ops por seção (origem aluno); reenviar o mesmo texto não grava nada", async () => {
    const t = await tccBase();
    const md = (await getTccForUser(t.id, DONO))!.content.replace("intro", "intro do aluno");
    const r = await aplicarConteudoManual(t.id, DONO, md, "Título do aluno");
    if (!r.ok) throw new Error();
    expect(r.efeitos.map((e) => [e.secaoId, e.depois])).toEqual([["introducao", "intro do aluno"]]);
    expect(r.tcc.titulo).toBe("Título do aluno");
    const n = revsDe(t.id).length;
    const r2 = await aplicarConteudoManual(t.id, DONO, md, "Título do aluno");
    expect(r2.ok && r2.efeitos).toEqual([]);
    expect(revsDe(t.id).length).toBe(n);
  });
});

describe("merge de 3 vias no autosave da Sala de Pesquisa", () => {
  it("editor DESATUALIZADO não reverte a seção que a Sala de Estudos escreveu enquanto isso", async () => {
    const t = await tccBase();
    const base = (await getTccForUser(t.id, DONO))!.content; // o editor abriu aqui
    // a Sala de Estudos escreve a METODOLOGIA
    await aplicarNoTcc(t.id, DONO, [{ op: "substituir", secaoId: "metodologia", corpo: "método da Sala de Estudos" }], "estudos");
    // o aluno, com a folha velha, só mexeu na INTRODUÇÃO
    const editado = base.replace("intro", "intro do aluno");
    const r = await aplicarConteudoManual(t.id, DONO, editado, undefined, base);
    if (!r.ok) throw new Error(r.reason);
    const doc = (await getTccForUser(t.id, DONO))!.secoes;
    expect(doc.find((s) => s.id === "introducao")!.corpo).toBe("intro do aluno");
    expect(doc.find((s) => s.id === "metodologia")!.corpo).toBe("método da Sala de Estudos");
    expect(r.efeitos.map((e) => e.secaoId)).toEqual(["introducao"]);
  });
  it("sem base (cliente antigo) a folha inteira vale (última vence) — e fica no histórico", async () => {
    const t = await tccBase();
    const base = (await getTccForUser(t.id, DONO))!.content;
    await aplicarNoTcc(t.id, DONO, [{ op: "substituir", secaoId: "metodologia", corpo: "da outra sala" }], "estudos");
    const r = await aplicarConteudoManual(t.id, DONO, base);
    if (!r.ok) throw new Error();
    expect(r.tcc.secoes.find((s) => s.id === "metodologia")!.corpo).toBe("");
    expect((await historicoDoTcc(t.id, DONO))![0]).toMatchObject({ secaoId: "metodologia", antes: "da outra sala", origem: "aluno" });
  });
  it("aluno edita seção que a outra sala REMOVEU: ela volta (não se perde texto)", async () => {
    const t = await tccBase();
    const base = (await getTccForUser(t.id, DONO))!.content;
    await aplicarNoTcc(t.id, DONO, [{ op: "remover", secaoId: "metodologia" }], "estudos");
    const r = await aplicarConteudoManual(t.id, DONO, base.replace("# METODOLOGIA", "# METODOLOGIA\n\nmeu método"), undefined, base);
    if (!r.ok) throw new Error(r.reason);
    expect(r.tcc.secoes.map((s) => [s.titulo, s.corpo])).toContainEqual(["METODOLOGIA", "meu método"]);
  });
});
