import { describe, it, expect, vi } from "vitest";
import {
  createMongoMemory,
  rrfFuse,
  reRank,
  decideCurationHeuristic,
  EMBED_DIM,
  type DrawerCollection,
  type EmbedFn,
  type RecallHit,
  type Drawer,
  type CurateFn,
} from "./memory";

const embed: EmbedFn = async (texts, dim = EMBED_DIM) => texts.map(() => new Array(dim).fill(0.01));

const hit = (over: Partial<RecallHit>): RecallHit => ({
  id: "x",
  userId: "u1",
  wing: { kind: "usuario", label: "estudos" },
  room: "geral",
  kind: "mensagem",
  text: "t",
  score: 1,
  at: new Date().toISOString(), // fresco por padrão → recency ~1 no re-rank
  ...over,
});

function makeColl(agg: (pipeline: any[]) => Promise<RecallHit[]>) {
  const inserted: any[] = [];
  const updates: { filter: any; update: any }[] = [];
  const coll: DrawerCollection & { inserted: any[]; updates: any[] } = {
    inserted,
    updates,
    insertMany: vi.fn(async (docs: any[]) => { inserted.push(...docs); }),
    aggregate: vi.fn(async (pipeline: any[]) => agg(pipeline)),
    updateMany: vi.fn(async (filter: any, update: any) => { updates.push({ filter, update }); }),
  };
  return coll;
}

describe("memory · rrfFuse (puro)", () => {
  it("funde por rank recíproco e deduplica; item em 2 listas sobe", () => {
    const a = [hit({ id: "1" }), hit({ id: "2" })];
    const b = [hit({ id: "2" }), hit({ id: "3" })];
    const fused = rrfFuse([a, b], 60);
    expect(fused[0].id).toBe("2");
    expect(fused.map((h) => h.id).sort()).toEqual(["1", "2", "3"]);
  });
});

describe("memory · reRank (puro)", () => {
  it("recency: o mais recente sobe", () => {
    const now = Date.parse("2026-07-11T12:00:00Z");
    const fresh = hit({ id: "fresh", score: 1, lastAccessedAt: new Date(now - 3_600_000).toISOString() });
    const stale = hit({ id: "stale", score: 1, lastAccessedAt: new Date(now - 5000 * 3_600_000).toISOString() });
    expect(reRank([stale, fresh], { now, halfLifeHours: 72 })[0].id).toBe("fresh");
  });
  it("importância: pesa a favor", () => {
    const now = Date.now();
    const iso = new Date(now).toISOString();
    const imp = hit({ id: "imp", score: 1, importance: 10, lastAccessedAt: iso });
    const plain = hit({ id: "plain", score: 1, importance: 0, lastAccessedAt: iso });
    expect(reRank([plain, imp], { now })[0].id).toBe("imp");
  });
});

describe("memory · decideCurationHeuristic (puro)", () => {
  const cand = hit({ text: "conteúdo novo" }) as Drawer;
  it("quase-idêntico (score alto) → NOOP; novo → ADD", () => {
    expect(decideCurationHeuristic(cand, [hit({ score: 0.99, text: "outro" })]).type).toBe("NOOP");
    expect(decideCurationHeuristic(cand, [hit({ score: 0.5, text: "outro" })]).type).toBe("ADD");
    expect(decideCurationHeuristic(cand, []).type).toBe("ADD");
  });
});

describe("memory · createMongoMemory.search", () => {
  it("sem userId → [] e NÃO toca a coleção (nunca cruza usuários)", async () => {
    const coll = makeColl(async () => []);
    const mem = createMongoMemory({ drawers: coll, embed });
    expect(await mem.search("q", { userId: "" })).toEqual([]);
    expect(coll.aggregate).not.toHaveBeenCalled();
  });

  it("SEMPRE filtra userId + invalidatedAt:null (+ escopo) no pipeline", async () => {
    const coll = makeColl(async () => [hit({ id: "1", score: 0.9 })]);
    const mem = createMongoMemory({ drawers: coll, embed });
    await mem.search("entropia", { userId: "u1", room: "fisica" });
    const pipeline = (coll.aggregate as any).mock.calls[0][0];
    const vs = pipeline.find((s: any) => s.$vectorSearch);
    expect(vs.$vectorSearch.filter.userId).toBe("u1");
    expect(vs.$vectorSearch.filter.invalidatedAt).toBe(null);
    expect(vs.$vectorSearch.filter.room).toBe("fisica");
  });

  it("híbrido app-side: funde vetor + texto (2 aggregates, RRF)", async () => {
    const coll = makeColl(async (pipeline) => {
      if (pipeline.find((s: any) => s.$vectorSearch)) return [hit({ id: "v", score: 0.9 })];
      if (pipeline.find((s: any) => s.$search)) return [hit({ id: "t", score: 0.8 })];
      return [];
    });
    const mem = createMongoMemory({ drawers: coll, embed });
    const r = await mem.search("q", { userId: "u1" });
    expect(coll.aggregate).toHaveBeenCalledTimes(2);
    expect(r.map((h) => h.id).sort()).toEqual(["t", "v"]);
  });

  it("Atlas fora do ar (aggregate estoura) → [] (chat segue limpo, sem poluição)", async () => {
    const coll = makeColl(async () => { throw new Error("atlas down"); });
    const mem = createMongoMemory({ drawers: coll, embed });
    expect(await mem.search("q", { userId: "u1" })).toEqual([]);
  });

  it("ramo vetor quebrado (filtro não indexado no Atlas) → o ramo de texto ainda responde", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const coll = makeColl(async (pipeline) => {
      if (pipeline.find((s: any) => s.$vectorSearch)) throw new Error("Path 'wingLabel' needs to be indexed as filter");
      return [hit({ id: "t", score: 0.8 })];
    });
    const mem = createMongoMemory({ drawers: coll, embed });
    const r = await mem.wakeUp({ userId: "u1", wingLabel: "estudos" }, "nitrogênio");
    aviso.mockRestore();
    expect(r.map((h) => h.id)).toEqual(["t"]);
  });

  it("recall bumpa lastAccessedAt/accessCount dos hits (best-effort)", async () => {
    const coll = makeColl(async () => [hit({ id: "h1", score: 0.9 })]);
    const mem = createMongoMemory({ drawers: coll, embed });
    await mem.search("q", { userId: "u1" });
    await new Promise((r) => setTimeout(r, 0)); // bump é fire-and-forget
    const b = coll.updates.find((u) => u.update?.$inc?.accessCount);
    expect(b).toBeTruthy();
    expect(b!.update.$set.lastAccessedAt).toBeTruthy();
  });
});

describe("memory · createMongoMemory.write (curadoria A7)", () => {
  const cand = (text: string): Drawer => ({
    userId: "u1", wing: { kind: "usuario", label: "estudos" }, room: "geral", kind: "nota", text,
  });

  it("candidato novo → ADD (insere FLAT, verbatim + embedding)", async () => {
    const coll = makeColl(async () => []); // sem similares
    const mem = createMongoMemory({ drawers: coll, embed });
    await mem.write([cand("uma nota com bastante substância pra ser memorável de verdade")]);
    expect(coll.insertMany).toHaveBeenCalledTimes(1);
    const doc = coll.inserted[0];
    expect(doc.wingKind).toBe("usuario"); // FLAT (bate com o model)
    expect(doc.text).toMatch(/substância/); // VERBATIM
    expect(doc.embedding.length).toBe(EMBED_DIM);
    expect(doc.invalidatedAt).toBe(null);
  });

  it("quase-idêntico existente → NOOP (não duplica)", async () => {
    const coll = makeColl(async () => [hit({ id: "old", score: 0.99, text: "igual" })]);
    const mem = createMongoMemory({ drawers: coll, embed });
    await mem.write([cand("uma nota longa o bastante pra passar no isMemorable mesmo")]);
    expect(coll.insertMany).not.toHaveBeenCalled();
  });

  it("curate SUPERSEDE → aposenta o antigo (invalidatedAt) e insere o novo", async () => {
    const coll = makeColl(async () => [hit({ id: "old1", score: 0.8 })]);
    const curate: CurateFn = () => ({ type: "SUPERSEDE", targetId: "old1" });
    const mem = createMongoMemory({ drawers: coll, embed, curate });
    await mem.write([cand("versão atualizada e bem mais completa do conceito de antes aqui")]);
    const inval = coll.updates.find((u) => u.update?.$set?.invalidatedAt);
    expect(inval).toBeTruthy();
    expect(inval!.filter._id).toBe("old1");
    expect(coll.insertMany).toHaveBeenCalledTimes(1);
  });

  it("lixo (curto, sem substância) → não persiste (isMemorable)", async () => {
    const coll = makeColl(async () => []);
    const mem = createMongoMemory({ drawers: coll, embed });
    await mem.write([cand("ok")]);
    expect(coll.insertMany).not.toHaveBeenCalled();
  });
});
