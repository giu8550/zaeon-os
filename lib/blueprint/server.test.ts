import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { blueprintDoTurno, gravarDoc, listarBlueprints, type BlueprintDb, type GenJson } from "./server";
import { docVazio, type DocBlueprint } from "./tipos";
import { bancoFalso } from "./__teste__/banco";

const plano = { titulo: "Privacy on Solana", resumo: "transferências confidenciais", area: "tecnologia", passos: [{ id: "p1", titulo: "Fundamentos", fase: 1 }], pecas: [{ id: "zk", nome: "prova ZK", fase: 2 }], criticos: [{ id: "r1", fase: 1, titulo: "Explique num README", prova: "repo com README", tipoProva: "repo" }], termosRepo: ["solana confidential transfer"] };
const gen = (saida: unknown = plano): GenJson => async <T,>() => saida as T;
const base = { userId: "u".repeat(24), scopeId: "thread-1", prompt: "quero estudar privacidade na solana", answerTexto: "…", history: [], repos: async () => [{ nome: "a/b", url: "https://github.com/a/b", estrelas: 9 }], passosBase: async () => ["Fundamentos"] };

describe("blueprintDoTurno — a conversa válida cria e melhora UM blueprint", () => {
  beforeEach(() => { process.env.BLUEPRINT_PRATICO = "1"; });
  afterEach(() => { delete process.env.BLUEPRINT_PRATICO; });

  it("flag desligada não faz nada", async () => {
    delete process.env.BLUEPRINT_PRATICO; const { db, linhas } = bancoFalso();
    expect(await blueprintDoTurno({ ...base, sinal: { estudavel: true, tituloSugerido: "X" }, db, gen: gen() })).toBe("off"); expect(linhas).toHaveLength(0);
  });
  it("conversa que não é estudo não cria nada", async () => {
    const { db, linhas } = bancoFalso(false);
    expect(await blueprintDoTurno({ ...base, sinal: { estudavel: false, tituloSugerido: "X" }, db, gen: gen() })).toBe("nao-estudo"); expect(linhas).toHaveLength(0);
  });
  it("estudo válido: cria e compõe (com os repositórios da API)", async () => {
    const { db, linhas } = bancoFalso();
    expect(await blueprintDoTurno({ ...base, sinal: { estudavel: true, tituloSugerido: "Privacidade na Solana" }, db, gen: gen(), agora: 1e6 })).toBe("composto");
    expect(linhas).toHaveLength(1); const d = linhas[0]!.cards as DocBlueprint;
    expect(d).toMatchObject({ titulo: "Privacy on Solana", area: "tecnologia", turnos: 1, compostoEm: 1e6 });
    expect(d.repos.map((r) => r.nome)).toEqual(["a/b"]); expect(d.criticos[0]).toMatchObject({ id: "r1", abertoEm: 1e6, status: "aberto" });
  });
  it("conversa já marcada estudável no banco também cria (gatekeeper sem sinal neste turno)", async () => {
    const { db, linhas } = bancoFalso(true);
    expect(await blueprintDoTurno({ ...base, sinal: null, db, gen: gen() })).toBe("composto"); expect(linhas).toHaveLength(1);
  });
  it("dois turnos ao mesmo tempo: um blueprint só", async () => {
    const { db, linhas } = bancoFalso();
    const s = { estudavel: true, tituloSugerido: "X" };
    await Promise.all([blueprintDoTurno({ ...base, sinal: s, db, gen: gen() }), blueprintDoTurno({ ...base, sinal: s, db, gen: gen() })]);
    expect(linhas).toHaveLength(1);
  });
  it("menos de 2 min depois: aguarda (a menos que force)", async () => {
    const { db } = bancoFalso(); const s = { estudavel: true, tituloSugerido: "X" };
    await blueprintDoTurno({ ...base, sinal: s, db, gen: gen(), agora: 1e6 });
    expect(await blueprintDoTurno({ ...base, sinal: s, db, gen: gen(), agora: 1e6 + 30_000 })).toBe("aguardando");
    expect(await blueprintDoTurno({ ...base, sinal: s, db, gen: gen(), agora: 1e6 + 30_000, forcar: true })).toBe("composto");
  });
  it("saída ruim do modelo: falhou e o documento fica como estava", async () => {
    const { db, linhas } = bancoFalso(); const s = { estudavel: true, tituloSugerido: "X" };
    await blueprintDoTurno({ ...base, sinal: s, db, gen: gen(), agora: 1e6 }); const antes = JSON.stringify(linhas[0]!.cards);
    expect(await blueprintDoTurno({ ...base, sinal: s, db, gen: gen({}), agora: 2e6 })).toBe("falhou");
    expect(JSON.stringify(linhas[0]!.cards)).toBe(antes);
  });
});

describe("a loja", () => {
  beforeEach(() => { process.env.BLUEPRINT_PRATICO = "1"; });
  it("lista com fase, críticos abertos da fase e fases aprovadas", async () => {
    const { db, linhas } = bancoFalso();
    await blueprintDoTurno({ ...base, sinal: { estudavel: true, tituloSugerido: "X" }, db, gen: gen() });
    const [r] = await listarBlueprints(base.userId, db);
    expect(r).toMatchObject({ id: linhas[0]!.id, titulo: "Privacy on Solana", fase: 1, criticosAbertos: 1, fasesAprovadas: 0 });
  });
  it("gravarDoc sem papel = not_found", async () => {
    const { db } = bancoFalso(); const c = await db.cartolina.create({ data: { ownerId: "o".repeat(24), surface: "blueprint", scopeId: "t", titulo: "X", cards: docVazio("X", 0) as never } });
    expect(await gravarDoc(c.id, "x".repeat(24), (d) => d, db)).toEqual({ ok: false, motivo: "not_found" });
  });
});

describe("duplicatas que escaparam da corrida", () => {
  beforeEach(() => { process.env.BLUEPRINT_PRATICO = "1"; });
  it("o turno seguinte deixa só o mais antigo", async () => {
    const { db, linhas } = bancoFalso(); const onde = { ownerId: base.userId, surface: "blueprint", scopeId: base.scopeId, titulo: "X", cards: docVazio("X", 0) as never };
    await db.cartolina.create({ data: onde }); await db.cartolina.create({ data: onde });
    expect(linhas).toHaveLength(2); const primeiro = linhas[0]!.id;
    await blueprintDoTurno({ ...base, sinal: { estudavel: true, tituloSugerido: "X" }, db, gen: gen() });
    expect(linhas.map((l) => l.id)).toEqual([primeiro]);
  });
});

describe("documentos do turno", () => {
  beforeEach(() => { process.env.BLUEPRINT_PRATICO = "1"; });
  it("as fontes da resposta entram no blueprint e a Zaeon marca a base", async () => {
    const { db, linhas } = bancoFalso();
    const answer = { sources: [{ title: "Zether", url: "https://doi.org/10.1007/zether" }] };
    const { documentosDaResposta } = await import("@/lib/videodoc/documentos");
    const id = documentosDaResposta(answer)[0]!.id;
    await blueprintDoTurno({ ...base, sinal: { estudavel: true, tituloSugerido: "X" }, db, gen: gen({ ...plano, documentosBase: [id] }), answer });
    expect((linhas[0]!.cards as DocBlueprint).documentos).toEqual([expect.objectContaining({ id, titulo: "Zether", base: true })]);
  });
});

describe("Sala sem vídeo automático; figura garantida", () => {
  beforeEach(() => { process.env.BLUEPRINT_PRATICO = "1"; });
  it("documentos-base não disparam vídeo na Sala (o card do YouTube substitui)", async () => {
    const { db, linhas } = bancoFalso();
    const sources = ["a", "b"].map((k) => ({ title: `Artigo ${k}`, url: `https://doi.org/10.1007/${k}` }));
    const { documentosDaResposta } = await import("@/lib/videodoc/documentos");
    const ids = documentosDaResposta({ sources }).map((d) => d.id);
    let n = 0; const videos = async () => ({ videoId: (++n).toString(16).padStart(24, "f") });
    await blueprintDoTurno({ ...base, sinal: { estudavel: true, tituloSugerido: "X" }, db, gen: gen({ ...plano, documentosBase: ids }), answer: { sources }, videos });
    expect(n).toBe(0); expect((linhas[0]!.cards as DocBlueprint).documentos.filter((d) => d.base)).toHaveLength(2);
  });
  it("composição sem peças → um pedido só da figura; a máquina aparece", async () => {
    const { db, linhas } = bancoFalso(); const { PECAS_SYSTEM } = await import("./compor");
    const pecas = { pecas: [{ id: "a", nome: "Carteira", fase: 1 }, { id: "b", nome: "Cifrador", fase: 1 }, { id: "c", nome: "Prova ZK", fase: 2 }], ligacoes: [["a", "b"], ["b", "c"]] };
    const g: GenJson = async <T,>(system: string) => (system === PECAS_SYSTEM ? pecas : { ...plano, pecas: [] }) as T;
    await blueprintDoTurno({ ...base, sinal: { estudavel: true, tituloSugerido: "X" }, db, gen: g });
    expect((linhas[0]!.cards as DocBlueprint).pecas.map((p) => p.nome)).toEqual(["Carteira", "Cifrador", "Prova ZK"]);
  });
});

describe("vídeo que falhou não segura lugar", () => {
  it("o documento com vídeo em erro solta o vídeo e o lugar vai pra outro base", async () => {
    const { db, linhas } = bancoFalso();
    const { docVazio: dv } = await import("./tipos");
    const d0 = { ...dv("X", 0), documentos: [
      { id: "a", titulo: "A", tipo: "artigo" as const, url: "https://doi.org/10.1007/a", base: true, videoId: "a".repeat(24) },
      { id: "b", titulo: "B", tipo: "artigo" as const, url: "https://doi.org/10.1007/b", base: true },
    ] };
    const l = await db.cartolina.create({ data: { ownerId: base.userId, surface: "blueprint", scopeId: "t", titulo: "X", cards: d0 as never } });
    const { videosDosDocumentosBase } = await import("./server");
    const n = await videosDosDocumentosBase(l.id, base.userId, d0, db, async () => ({ videoId: "b".repeat(24) }), async () => ({ ["a".repeat(24)]: "error" }));
    expect(n).toBe(1);
    const docs = (linhas[0]!.cards as DocBlueprint).documentos;
    expect(docs.find((d) => d.id === "a")).toMatchObject({ base: false }); expect(docs.find((d) => d.id === "a")!.videoId).toBeUndefined();
    expect(docs.find((d) => d.id === "b")!.videoId).toBe("b".repeat(24));
  });
});
