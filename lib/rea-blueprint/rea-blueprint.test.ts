import { describe, it, expect, vi } from "vitest";
import { docVazio, sanitizarDoc, reaBlueprintOn, reaBlueprintUiOn } from "./tipos";
import { lerPlano, mesclarComposicao, promptComposicao, COMPOR_SYSTEM } from "./compor";
import { garantirRea, gravarDoc, reaDoUsuario, reaBlueprintDoTurno, type ReaDb } from "./server";

describe("rea-blueprint · tipos (saneamento)", () => {
  it("doc vazio é válido e tem turnos 0", () => {
    const d = docVazio("Shazam"); expect(d.titulo).toBe("Shazam"); expect(d.turnos).toBe(0); expect(d.achados).toEqual([]);
  });
  it("sanitiza: proveniência inválida vira inferência, limites, ids únicos; lixo → null", () => {
    const d = sanitizarDoc({ v: 1, titulo: "X", achados: [{ afirmacao: "faz hash", prov: "observacao" }, { afirmacao: "deduz", prov: "xpto" }, { prov: "observacao" }], reconstrucao: [{ titulo: "passo 1", verifica: "roda" }], incertezas: ["o resto"] })!;
    expect(d.achados).toHaveLength(2);
    expect(d.achados[1].prov).toBe("inferencia");
    expect(new Set(d.achados.map((a) => a.id)).size).toBe(2);
    expect(d.reconstrucao[0].verifica).toBe("roda");
    expect(sanitizarDoc("lixo")).toBeNull();
    expect(sanitizarDoc(null)).toBeNull();
  });
  it("flags off por padrão", () => { expect(reaBlueprintOn()).toBe(false); expect(reaBlueprintUiOn()).toBe(false); });
});

describe("rea-blueprint · compor", () => {
  it("prompt carrega a conversa e a evidência do motor; o system exige proveniência", () => {
    const p = promptComposicao({ doc: docVazio("x"), conversa: [{ role: "user", text: "como o shazam funciona?" }], evidencia: "{\"sig\":\"fingerprint\"}" });
    expect(p).toContain("como o shazam funciona");
    expect(p).toContain("EVIDÊNCIA DO MOTOR");
    expect(COMPOR_SYSTEM).toMatch(/OBSERVADO|proveniência|DESCONHECIDO/i);
  });
  it("lerPlano: JSON do modelo → plano; nada útil → null", () => {
    expect(lerPlano({ comoFunciona: "faz um hash do áudio", achados: [{ afirmacao: "usa FFT", prov: "derivacao" }], incertezas: ["o índice"] })!.achados).toHaveLength(1);
    expect(lerPlano({ achados: [] })).toBeNull();
    expect(lerPlano("x")).toBeNull();
  });
  it("mesclar substitui o conteúdo, soma turno e junta ferramentas", () => {
    const d = mesclarComposicao(docVazio("x"), { comoFunciona: "y", achados: [{ id: "", afirmacao: "a", prov: "observacao" }] }, 1000, ["analyze", "ghidra"]);
    expect(d.turnos).toBe(1); expect(d.comoFunciona).toBe("y"); expect(d.ferramentas).toEqual(["analyze", "ghidra"]);
  });
});

function fakeDb() {
  const rows: any[] = [];
  const db: ReaDb = {
    cartolina: {
      findFirst: async ({ where }) => rows.filter((r) => (!where.ownerId || r.ownerId === where.ownerId) && (!where.surface || r.surface === where.surface) && (where.scopeId === undefined || r.scopeId === where.scopeId)).sort((a, b) => a.createdAt - b.createdAt)[0] ?? null,
      findUnique: async ({ where }) => rows.find((r) => r.id === where.id) ?? null,
      findMany: async ({ where }) => rows.filter((r) => r.ownerId === where.ownerId && r.surface === where.surface),
      create: async ({ data }) => { const r = { id: String(rows.length + 1).padStart(24, "a"), rev: 0, createdAt: new Date(Date.now() + rows.length), updatedAt: new Date(), ...data }; rows.push(r); return r; },
      updateMany: async ({ where, data }) => { const r = rows.find((x) => x.id === where.id && x.rev === where.rev); if (!r) return { count: 0 }; Object.assign(r, data, { updatedAt: new Date() }); return { count: 1 }; },
      deleteMany: async ({ where }) => { const i = rows.findIndex((r) => r.id === where.id); if (i >= 0) rows.splice(i, 1); return { count: i >= 0 ? 1 : 0 }; },
    },
    cartolinaMembro: { findUnique: async () => null },
  };
  return { db, rows };
}

describe("rea-blueprint · server (loja Cartolina)", () => {
  it("garantir é idempotente por conversa; o dono lê, grava com rev otimista", async () => {
    const { db } = fakeDb();
    const id1 = await garantirRea("u1", "s1", "Shazam", db);
    const id2 = await garantirRea("u1", "s1", "Shazam", db);
    expect(id1).toBe(id2);
    const view = await reaDoUsuario(id1, "u1", db);
    expect(view?.doc.titulo).toBe("Shazam");
    const r = await gravarDoc(id1, "u1", (d) => ({ ...d, comoFunciona: "faz fingerprint" }), db);
    expect(r.ok).toBe(true);
    expect((await reaDoUsuario(id1, "u1", db))?.doc.comoFunciona).toBe("faz fingerprint");
    // outro usuário sem papel não vê
    expect(await reaDoUsuario(id1, "estranho", db)).toBeNull();
  });
  it("reaBlueprintDoTurno off sem flag; com flag compõe pelo gen injetado", async () => {
    expect(await reaBlueprintDoTurno({ userId: "u1", scopeId: "s1", titulo: "x", prompt: "p", answerTexto: "a", history: [] })).toBe("off");
    vi.stubEnv("REA_BLUEPRINT", "1");
    try {
      const { db } = fakeDb();
      const gen = vi.fn(async () => ({ comoFunciona: "faz hash do áudio", achados: [{ afirmacao: "usa FFT", prov: "derivacao" }], incertezas: ["o índice invertido"] }));
      const r = await reaBlueprintDoTurno({ userId: "u1", scopeId: "s1", titulo: "Shazam", prompt: "como funciona?", answerTexto: "resposta", history: [], db, gen: gen as any, ferramentas: ["analyze"] });
      expect(r).toBe("composto");
      expect(gen).toHaveBeenCalledOnce();
      const view = await reaDoUsuario((await garantirRea("u1", "s1", "x", db)), "u1", db);
      expect(view?.doc.comoFunciona).toContain("hash");
      expect(view?.doc.ferramentas).toContain("analyze");
    } finally { vi.unstubAllEnvs(); }
  });
});
