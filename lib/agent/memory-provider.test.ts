import { describe, it, expect, afterEach } from "vitest";
import {
  deriveTurnDrawers,
  writeTurnMemory,
  wakeUpContext,
  mongoDrawerCollection,
  __setMemoryForTest,
  isMemoryConfigured,
} from "./memory-provider";
import { runToolByName } from "./runtime";
import type { MemoryAPI, RecallHit } from "./memory";

const recall = (over: Partial<RecallHit>): RecallHit => ({
  id: "1", userId: "u1", wing: { kind: "usuario", label: "estudos" }, room: "geral",
  kind: "mensagem", text: "lembrança", score: 0.9, ...over,
});

const mockMemory = (searchRes: RecallHit[] = [], wakeRes: RecallHit[] = []): MemoryAPI & { written: any[] } => {
  const written: any[] = [];
  return {
    written,
    search: async () => searchRes,
    wakeUp: async () => wakeRes,
    write: async (d: any[]) => { written.push(...d); },
  } as any;
};

afterEach(() => __setMemoryForTest(null));

describe("memory-provider · deriveTurnDrawers (L1 → verbatim)", () => {
  it("deriva user+núcleo+citação+artefato, verbatim, wing da surface", () => {
    const drawers = deriveTurnDrawers({
      userId: "u1",
      surface: "pesquisa",
      scopeId: "r1",
      prompt: "uma pergunta longa o suficiente pra ser memorável de verdade aqui",
      answer: {
        nucleo: "uma resposta com bastante substância pra virar memória também sim",
        evidencia: [{ claim: "afirmação sólida com fonte", source: { title: "Fonte X" } }],
        artifacts: [{ studioKind: "mindmap", title: "mapa: X" }],
      },
    });
    expect(drawers).toHaveLength(4);
    expect(drawers.every((d) => d.userId === "u1")).toBe(true);
    expect(drawers.every((d) => d.wing.label === "pesquisa")).toBe(true);
    expect(drawers.find((d) => d.kind === "citacao")).toBeTruthy();
    expect(drawers.find((d) => d.kind === "artefato")?.text).toBe("mapa: X");
    expect(drawers.find((d) => d.text.includes("resposta"))).toBeTruthy(); // VERBATIM
  });

  it("descarta lixo curto (isMemorable)", () => {
    const drawers = deriveTurnDrawers({ userId: "u1", surface: "estudos", prompt: "ok", answer: { nucleo: "valeu" } });
    expect(drawers).toHaveLength(0);
  });
});

describe("memory-provider · writeTurnMemory (best-effort)", () => {
  it("escreve os drawers derivados na memória configurada", async () => {
    const m = mockMemory();
    __setMemoryForTest(m);
    await writeTurnMemory({ userId: "u1", surface: "estudos", prompt: "uma pergunta bem substancial pra ser memorável aqui", answer: { nucleo: "" } });
    expect(m.written.length).toBe(1);
  });
  it("sem userId → não escreve (nunca lança)", async () => {
    const m = mockMemory();
    __setMemoryForTest(m);
    await writeTurnMemory({ userId: "", surface: "estudos", prompt: "x", answer: { nucleo: "y" } });
    expect(m.written.length).toBe(0);
  });
});

describe("memory-provider · tool memory_search (wiring)", () => {
  it("L3 configurado → findings do recall", async () => {
    __setMemoryForTest(mockMemory([recall({ text: "lembrança útil", meta: { source: { title: "S" } } })]));
    const r = await runToolByName("memory_search", { query: "x" }, { userId: "u1" } as any);
    expect(r.ok).toBe(true);
    expect(r.findings?.[0].claim).toBe("lembrança útil");
  });
  it("L3 não configurado → memory_unavailable (degrada limpo)", async () => {
    __setMemoryForTest(null);
    const r = await runToolByName("memory_search", { query: "x" }, { userId: "u1" } as any);
    expect(r.code).toBe("memory_unavailable");
  });
  it("sem userId → memory_unavailable (nunca cruza usuários)", async () => {
    __setMemoryForTest(mockMemory([recall({})]));
    const r = await runToolByName("memory_search", { query: "x" }, {} as any);
    expect(r.code).toBe("memory_unavailable");
  });
});

describe("memory-provider · wakeUpContext (A8)", () => {
  it("configurado → bloco com memórias; não configurado → vazio", async () => {
    __setMemoryForTest(null);
    expect(isMemoryConfigured()).toBe(false);
    expect(await wakeUpContext({ userId: "u1", surface: "estudos" })).toBe("");
    __setMemoryForTest(mockMemory([], [recall({ text: "memória relevante A" })]));
    const block = await wakeUpContext({ userId: "u1", surface: "estudos", hint: "x" });
    expect(block).toMatch(/memória relevante A/);
  });
});

describe("memory-provider · mongoDrawerCollection", () => {
  it("mapeia _id → id (string) no aggregate", async () => {
    const fakeColl = {
      aggregate: () => ({ toArray: async () => [{ _id: "abc123", text: "t", wing: { kind: "usuario", label: "x" }, score: 0.5 }] }),
      insertMany: async () => {},
      updateMany: async () => {},
    };
    const coll = mongoDrawerCollection(fakeColl);
    const hits = await coll.aggregate([]);
    expect(hits[0].id).toBe("abc123");
  });
});
