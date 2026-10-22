import { describe, expect, it, vi } from "vitest";
import { lerAvaliacao, promptAvaliacao } from "./avaliar";
import { conferirProva } from "./provas-server";
import { docVazio, type Critico } from "./tipos";

const c = (o: Partial<Critico> = {}): Critico => ({ id: "r1", fase: 2, titulo: "devnet", prova: "repo com script", tipoProva: "repo", abertoEm: 1000, status: "aberto", ...o });

describe("conferirProva — o servidor confere o artefato", () => {
  it("javascript: e rede interna são recusados", async () => {
    expect(await conferirProva(c(), "javascript:alert(1)")).toMatchObject({ ok: false, motivo: expect.stringContaining("link inválido") });
    expect(await conferirProva(c({ tipoProva: "link" }), "http://127.0.0.1/x")).toMatchObject({ ok: false });
  });
  it("repo sem push depois de aberto o crítico = recusado (não vale colar repo famoso)", async () => {
    const r = await conferirProva(c(), "https://github.com/solana-program/token-2022", { repoInfo: async () => ({ nome: "solana-program/token-2022", publico: true, pushedAt: 500, criadoEm: 0 }) });
    expect(r).toMatchObject({ ok: false, motivo: expect.stringContaining("depois que o crítico foi aberto") });
  });
  it("repo privado = recusado; inexistente = recusado", async () => {
    expect(await conferirProva(c(), "https://github.com/a/b", { repoInfo: async () => ({ nome: "a/b", publico: false, pushedAt: 2000, criadoEm: 900 }) })).toMatchObject({ ok: false, motivo: expect.stringContaining("público") });
    expect(await conferirProva(c(), "https://github.com/a/b", { repoInfo: async () => null })).toMatchObject({ ok: false });
  });
  it("repo público com push novo = entrega", async () => {
    const r = await conferirProva(c(), "https://github.com/voce/privado", { repoInfo: async () => ({ nome: "voce/privado", publico: true, pushedAt: 2000, criadoEm: 900 }), agora: 3000 });
    expect(r).toMatchObject({ ok: true, entrega: { url: "https://github.com/voce/privado", em: 3000 } });
  });
  it("link/demo: vale se responde", async () => {
    const vivo = vi.fn(async () => true);
    expect(await conferirProva(c({ tipoProva: "demo" }), "https://demo.example.org", { vivo })).toMatchObject({ ok: true, entrega: { detalhe: "demo no ar" } });
    expect(await conferirProva(c({ tipoProva: "link" }), "https://x.example.org", { vivo: async () => false })).toMatchObject({ ok: false, motivo: expect.stringContaining("não respondeu") });
  });
});

describe("avaliação da Zaeon", () => {
  it("lê a rubrica (clamp 0..100) e exige parecer", () => {
    expect(lerAvaliacao({ rigor: 140, originalidade: 50, usabilidade: 60, viabilidade: 70, impacto: -3, parecer: "bom" }, 2, 9)).toEqual({ fase: 2, em: 9, nota: { rigor: 100, originalidade: 50, usabilidade: 60, viabilidade: 70, impacto: 0 }, parecer: "bom" });
    expect(lerAvaliacao({ rigor: 1, originalidade: 1, usabilidade: 1, viabilidade: 1, impacto: 1 }, 2, 9)).toBeNull();
    expect(lerAvaliacao({ rigor: 1, parecer: "x" }, 2, 9)).toBeNull();
  });
  it("o prompt traz a URL da entrega", () => {
    const d = { ...docVazio("T", 0), fase: 2 as const, criticos: [c({ status: "provado", entrega: { url: "https://github.com/voce/privado", em: 1, detalhe: "repo público" } })] };
    expect(promptAvaliacao(d, 2)).toContain("https://github.com/voce/privado");
  });
});

describe("provarEAvaliar — prova conferida → Zaeon avalia → fase avança", () => {
  it("a última prova da fase dispara a avaliação; aprovada, a fase 3 abre e a recomposição é chamada", async () => {
    const { bancoFalso } = await import("./__teste__/banco");
    const { provarEAvaliar } = await import("./provas-server");
    const { db } = bancoFalso();
    const dono = "d".repeat(24);
    const doc = { ...docVazio("Privacy on Solana", 0), fase: 2 as const, criticos: [c(), c({ id: "r2", tipoProva: "link" })] };
    const linha = await db.cartolina.create({ data: { ownerId: dono, surface: "blueprint", scopeId: "t1", titulo: "X", cards: doc as never } });
    const conferir = async (k: Critico, url: string) => ({ ok: true as const, entrega: { url, em: 5, detalhe: k.tipoProva } });
    const recompor = vi.fn(async () => "composto" as const);
    const gen = async <T,>() => ({ rigor: 80, originalidade: 70, usabilidade: 70, viabilidade: 75, impacto: 65, parecer: "entregou" }) as T;
    const um = await provarEAvaliar({ id: linha.id, userId: dono, criticoId: "r1", url: "https://github.com/voce/x", db, gen, conferir, recompor });
    expect(um.ok).toBe(true); expect(um.avaliacao).toBeUndefined(); expect(um.view!.doc.fase).toBe(2);
    const dois = await provarEAvaliar({ id: linha.id, userId: dono, criticoId: "r2", url: "https://x.example.org", db, gen, conferir, recompor });
    expect(dois.avaliacao).toMatchObject({ fase: 2, aprovada: true }); expect(dois.view!.doc.fase).toBe(3);
    expect(recompor).toHaveBeenCalledTimes(1);
  });
  it("prova recusada não muda nada e devolve o motivo", async () => {
    const { bancoFalso } = await import("./__teste__/banco");
    const { provarEAvaliar } = await import("./provas-server");
    const { db, linhas } = bancoFalso(); const dono = "d".repeat(24);
    const linha = await db.cartolina.create({ data: { ownerId: dono, surface: "blueprint", scopeId: "t1", titulo: "X", cards: { ...docVazio("X", 0), fase: 2, criticos: [c()] } as never } });
    const antes = JSON.stringify(linhas[0]!.cards);
    const r = await provarEAvaliar({ id: linha.id, userId: dono, criticoId: "r1", url: "https://github.com/a/b", db, conferir: async () => ({ ok: false, motivo: "não" }) });
    expect(r).toEqual({ ok: false, motivo: "não" }); expect(JSON.stringify(linhas[0]!.cards)).toBe(antes);
  });
});

describe("anti-cópia e corrida", () => {
  const info = (o: Partial<{ publico: boolean; pushedAt: number; criadoEm: number }> = {}) => async () => ({ nome: "x/y", publico: true, pushedAt: 9e12, criadoEm: 9e12, ...o });
  it("repositório famoso, criado anos antes do estudo, não prova (mesmo com push de hoje)", async () => {
    const r = await conferirProva(c({ abertoEm: 1.7e12 }), "https://github.com/torvalds/linux", { repoInfo: info({ criadoEm: 1.1e12, pushedAt: 1.8e12 }), inicioEstudo: 1.7e12 });
    expect(r).toMatchObject({ ok: false, motivo: expect.stringContaining("criado depois") });
  });
  it("a mesma URL não prova dois críticos", async () => {
    const r = await conferirProva(c({ tipoProva: "link" }), "https://demo.example.org/", { vivo: async () => true, usadas: ["https://demo.example.org"] });
    expect(r).toMatchObject({ ok: false, motivo: expect.stringContaining("já provou") });
  });
  it("crítico que sumiu durante a conferência: não diz que provou", async () => {
    const { bancoFalso } = await import("./__teste__/banco");
    const { provarEAvaliar } = await import("./provas-server");
    const { db, linhas } = bancoFalso(); const dono = "d".repeat(24);
    const linha = await db.cartolina.create({ data: { ownerId: dono, surface: "blueprint", scopeId: "t1", titulo: "X", cards: { ...docVazio("X", 0), fase: 2, criticos: [c()] } as never } });
    const conferir = async (_k: Critico, url: string) => { (linhas[0]!.cards as { criticos: unknown[] }).criticos = []; return { ok: true as const, entrega: { url, em: 5, detalhe: "" } }; };
    const r = await provarEAvaliar({ id: linha.id, userId: dono, criticoId: "r1", url: "https://github.com/voce/x", db, conferir });
    expect(r.ok).toBe(false); expect(r.motivo).toContain("recompôs");
  });
  it("avaliação que falhou pode ser pedida de novo; reprovada traz críticos novos", async () => {
    const { bancoFalso } = await import("./__teste__/banco");
    const { pedirAvaliacao, provarEAvaliar } = await import("./provas-server");
    const { db } = bancoFalso(); const dono = "d".repeat(24);
    const linha = await db.cartolina.create({ data: { ownerId: dono, surface: "blueprint", scopeId: "t1", titulo: "X", cards: { ...docVazio("X", 0), fase: 2, criticos: [c()] } as never } });
    const conferir = async (_k: Critico, url: string) => ({ ok: true as const, entrega: { url, em: 5, detalhe: "" } });
    const falha = await provarEAvaliar({ id: linha.id, userId: dono, criticoId: "r1", url: "https://github.com/voce/x", db, conferir, gen: async () => { throw new Error("vertex"); } });
    expect(falha.motivo).toContain("falhou");
    const recompor = vi.fn(async () => "composto" as const);
    const reprova = await pedirAvaliacao({ id: linha.id, userId: dono, db, recompor, gen: async <T,>() => ({ rigor: 20, originalidade: 20, usabilidade: 20, viabilidade: 20, impacto: 20, parecer: "não roda" }) as T });
    expect(reprova.avaliacao).toMatchObject({ aprovada: false }); expect(reprova.view!.doc.fase).toBe(2);
    expect(recompor).toHaveBeenCalledWith(expect.objectContaining({ prompt: expect.stringContaining("REPROVOU") }));
    expect(await pedirAvaliacao({ id: linha.id, userId: dono, db })).toMatchObject({ ok: false });
  });
});
