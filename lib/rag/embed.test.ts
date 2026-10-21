import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/ai/vertex-credentials", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/vertex-credentials")>()),
  vertexCredentials: () => ({ project: "proj-x", client_email: "sa@x", private_key: "k", location: "us-central1" }),
  geminiTextLocation: () => "global",
}));
vi.mock("@/lib/ai/contextCache", () => ({ vertexAccessToken: vi.fn(async () => "tok-123") }));

import { embedGemini, embedVertex, LOTE_EMBED, RAG_EMBED_DIM, RAG_EMBED_MODEL } from "./embed";

const vetor = () => Array.from({ length: RAG_EMBED_DIM }, () => 0.5);
const resposta = (n: number) => new Response(JSON.stringify({ predictions: Array.from({ length: n }, () => ({ embeddings: { values: vetor() } })) }), { status: 200 });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("embedVertex", () => {
  it("constantes", () => {
    expect(RAG_EMBED_MODEL).toBe("gemini-embedding-001");
    expect(RAG_EMBED_DIM).toBe(1024);
    expect(LOTE_EMBED).toBe(16);
  });

  it("20 textos => 2 chamadas (16 + 4), corpo e URL do Vertex direto", async () => {
    fetchMock.mockImplementation(async (_u: string, init: any) => resposta(JSON.parse(init.body).instances.length));
    const textos = Array.from({ length: 20 }, (_, i) => `texto ${i}`);
    const out = await embedVertex(textos, "documento");
    expect(out).toHaveLength(20);
    expect(out[0]).toHaveLength(1024);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://aiplatform.googleapis.com/v1/projects/proj-x/locations/global/publishers/google/models/gemini-embedding-001:predict");
    expect(url).toContain("gemini-embedding-001:predict");
    expect(url).not.toContain("zaeon-local");
    expect(url).not.toContain("generativelanguage");
    expect(init.headers.Authorization).toBe("Bearer tok-123");
    const corpo = JSON.parse(init.body);
    expect(corpo.instances).toHaveLength(16);
    expect(corpo.instances[0]).toEqual({ content: "texto 0", task_type: "RETRIEVAL_DOCUMENT" });
    expect(corpo.parameters).toEqual({ outputDimensionality: 1024, autoTruncate: true });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).instances).toHaveLength(4);
  });

  it("devolve os vetores na ordem da entrada (entre lotes)", async () => {
    fetchMock.mockImplementation(async (_u: string, init: any) => {
      const inst = JSON.parse(init.body).instances as { content: string }[];
      return new Response(JSON.stringify({ predictions: inst.map((i) => ({ embeddings: { values: [Number(i.content)] } })) }), { status: 200 });
    });
    const textos = Array.from({ length: 20 }, (_, i) => String(i));
    const out = await embedVertex(textos, "documento");
    expect(out.map((v) => v[0])).toEqual(textos.map(Number));
  });

  it('tipo "pergunta" => RETRIEVAL_QUERY', async () => {
    fetchMock.mockResolvedValue(resposta(1));
    await embedVertex(["o que é X?"], "pergunta");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).instances[0].task_type).toBe("RETRIEVAL_QUERY");
  });

  it("HTTP 429 => rejeita com embed_http_429 e o início do corpo (máx. 200 chars)", async () => {
    fetchMock.mockResolvedValue(new Response("quota excedida " + "x".repeat(500), { status: 429 }));
    const erro = (await embedVertex(["a"], "documento").catch((e) => e)) as Error;
    expect(erro.message.startsWith("embed_http_429")).toBe(true);
    expect(erro.message).toContain("quota excedida");
    expect(erro.message.length).toBeLessThanOrEqual("embed_http_429: ".length + 200);
  });

  it("cada chamada leva AbortSignal com prazo", async () => {
    fetchMock.mockResolvedValue(resposta(1));
    await embedVertex(["a"], "documento");
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("contagem de vetores diferente do lote => lança", async () => {
    fetchMock.mockResolvedValue(resposta(1));
    await expect(embedVertex(["a", "b"], "documento")).rejects.toThrow();
  });

  it("lista vazia => [] sem chamar a rede", async () => {
    expect(await embedVertex([], "documento")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("embedGemini (memória L3)", () => {
  it("dimensão pedida e SEM task_type quando não vem", async () => {
    fetchMock.mockImplementation(async (_u: string, init: any) =>
      new Response(JSON.stringify({ predictions: JSON.parse(init.body).instances.map(() => ({ embeddings: { values: Array(1536).fill(0.1) } })) }), { status: 200 }));
    const out = await embedGemini(["a", "b"], { dim: 1536 });
    expect(out).toHaveLength(2);
    expect(out[0]).toHaveLength(1536);
    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(corpo.instances).toEqual([{ content: "a" }, { content: "b" }]);
    expect(corpo.parameters).toEqual({ outputDimensionality: 1536, autoTruncate: true });
  });
});
