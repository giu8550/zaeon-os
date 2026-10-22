import { describe, expect, it, vi } from "vitest";
import { garantirVideo, naFila, podeVerVideo, type VideoDb } from "./server";
import type { Documento } from "@/lib/blueprint/tipos";

function bancoArtefatos() {
  type Art = { id: string; ownerId: string; status: string; kind: string; sourceIds: string[]; meta: unknown; createdAt: Date };
  const arts: Art[] = []; let seq = 0;
  const casa = (a: Art, w: Record<string, unknown>) => Object.entries(w).every(([k, v]) => {
    if (k === "sourceIds") return a.sourceIds.includes((v as { has: string }).has);
    if (k === "createdAt") return a.createdAt >= (v as { gte: Date }).gte;
    return (a as unknown as Record<string, unknown>)[k] === v;
  });
  const db: VideoDb = {
    studioArtifact: {
      async findFirst({ where }) { return arts.filter((a) => casa(a, where)).at(-1) ?? null; },
      async count({ where }) { return arts.filter((a) => casa(a, where)).length; },
      async create({ data }) { const a = { ...(data as object), id: (++seq).toString(16).padStart(24, "0"), createdAt: new Date() } as Art; arts.push(a); return a; },
      async update({ where, data }) { const a = arts.find((x) => x.id === where.id)!; Object.assign(a, data); return a; },
    },
  };
  return { db, arts };
}
const artigo: Documento = { id: "d1", titulo: "Zether", tipo: "artigo", url: "https://doi.org/10.1007/zether", base: true };
const minha: Documento = { id: "d2", titulo: "Apostila", tipo: "base", ref: "rag1", base: true };
const espera = () => new Promise((r) => setTimeout(r, 5));

describe("garantirVideo — um vídeo por documento", () => {
  it("artigo público: o segundo estudo (de outra pessoa) reaproveita o mesmo vídeo", async () => {
    const { db, arts } = bancoArtefatos(); const gerar = vi.fn(async () => null);
    const a = await garantirVideo({ userId: "u1", documento: artigo, blueprintId: "b1", db, texto: async () => "texto", gerar });
    const b = await garantirVideo({ userId: "u2", documento: { ...artigo, id: "x", url: "https://doi.org/10.1007/ZETHER" }, blueprintId: "b2", db, texto: async () => "texto", gerar });
    expect(a).toMatchObject({ novo: true }); expect(b).toEqual({ videoId: (a as { videoId: string }).videoId, novo: false });
    expect(arts).toHaveLength(1); expect((arts[0]!.meta as { blueprints: string[] }).blueprints).toEqual(["b1", "b2"]);
    await espera(); expect(gerar).toHaveBeenCalledTimes(1);
  });
  it("documento da pessoa não é reaproveitado por outra", async () => {
    const { db, arts } = bancoArtefatos();
    await garantirVideo({ userId: "u1", documento: minha, blueprintId: "b1", db, texto: async () => "t", gerar: async () => null });
    await garantirVideo({ userId: "u2", documento: minha, blueprintId: "b2", db, texto: async () => "t", gerar: async () => null });
    expect(arts).toHaveLength(2);
  });
  it("sem texto aberto: o artefato vira erro 'sem_texto' e nada é gerado", async () => {
    const { db, arts } = bancoArtefatos(); const gerar = vi.fn(async () => null);
    await garantirVideo({ userId: "u1", documento: artigo, blueprintId: "b1", db, texto: async () => null, gerar });
    await espera(); expect(arts[0]).toMatchObject({ status: "error", error: "sem_texto" }); expect(gerar).not.toHaveBeenCalled();
  });
  it("teto do dia: o 7º vídeo novo espera amanhã", async () => {
    const { db } = bancoArtefatos();
    for (let k = 0; k < 6; k++) await garantirVideo({ userId: "u1", documento: { ...minha, ref: `r${k}` }, blueprintId: "b", db, texto: async () => "t", gerar: async () => null });
    expect(await garantirVideo({ userId: "u1", documento: { ...minha, ref: "r9" }, blueprintId: "b", db, texto: async () => "t", gerar: async () => null })).toEqual({ motivo: "limite_do_dia" });
  });
});

describe("fila e acesso", () => {
  it("no máximo 2 ao mesmo tempo", async () => {
    let agora = 0, pico = 0;
    await Promise.all(Array.from({ length: 5 }, () => naFila(async () => { agora++; pico = Math.max(pico, agora); await espera(); agora--; })));
    expect(pico).toBe(2);
  });
  it("quem vê: dono, todo mundo se público, ou quem tem papel no blueprint", () => {
    const priv = { ownerId: "u1", meta: { publico: false, blueprints: ["b1"] } };
    expect(podeVerVideo(priv, "u1", [])).toBe(true); expect(podeVerVideo(priv, "u2", [])).toBe(false); expect(podeVerVideo(priv, "u2", ["b1"])).toBe(true);
    expect(podeVerVideo({ ownerId: "u1", meta: { publico: true } }, "u9", [])).toBe(true);
  });
});
