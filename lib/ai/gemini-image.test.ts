import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/ai/vertex-credentials", () => ({
  vertexCredentials: () => ({ project: "p", client_email: "e", private_key: "k", location: "us-central1" }),
}));
vi.mock("google-auth-library", () => ({
  GoogleAuth: class { getAccessToken = async () => "tok"; },
}));

import { gerarImagemGemini } from "@/lib/ai/gemini-image";

const ok = (data: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data, mimeType: "image/png" } }] } }] }), { status: 200 });
const erro = (status: number, message: string) => new Response(JSON.stringify({ error: { message } }), { status });

describe("gerarImagemGemini", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("429 numa região → tenta a próxima na hora", async () => {
    fetchMock.mockResolvedValueOnce(erro(429, "Resource exhausted")).mockResolvedValueOnce(ok("AAAA"));
    const out = await gerarImagemGemini("x", { locais: ["global", "us-east4"], model: "m", aspectRatio: "16:9" });
    expect(out).toEqual({ data: "AAAA", mimeType: "image/png" });
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toContain("https://aiplatform.googleapis.com/");
    expect(urls[1]).toContain("https://us-east4-aiplatform.googleapis.com/");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).generationConfig.imageConfig.aspectRatio).toBe("16:9");
  });

  it("404 não roda região: lança direto com a mensagem do Vertex", async () => {
    fetchMock.mockResolvedValue(erro(404, "Publisher model not found"));
    await expect(gerarImagemGemini("x", { locais: ["a", "b"], model: "m" })).rejects.toThrow("Vertex 404: Publisher model not found");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("volta inteira de 429 sem orçamento de espera → lança o último erro", async () => {
    fetchMock.mockImplementation(async () => erro(429, "Resource exhausted"));
    await expect(gerarImagemGemini("x", { locais: ["a", "b"], model: "m", esperaMaxMs: 0 })).rejects.toThrow(/Vertex 429: Resource exhausted \[(a|b)\]/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("200 sem imagem (recusa) → lança o motivo", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: "IMAGE_SAFETY", content: { parts: [] } }] }), { status: 200 }));
    await expect(gerarImagemGemini("x", { locais: ["a"], model: "m" })).rejects.toThrow("sem imagem na resposta (IMAGE_SAFETY)");
  });
});
