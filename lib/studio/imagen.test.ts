import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const m = vi.hoisted(() => ({ gerar: vi.fn() }));
vi.mock("@/lib/ai/vertex-credentials", () => ({
  vertexCredentials: () => ({ project: "p", client_email: "e", private_key: "k", location: "us-central1" }),
}));
vi.mock("google-auth-library", () => ({
  GoogleAuth: class { getAccessToken = async () => "tok"; },
}));
vi.mock("@/lib/ai/gemini-image", () => ({
  gerarImagemGemini: m.gerar,
  geminiImageDisponivel: () => true,
  geminiImageModelo: () => "gemini-2.5-flash-image",
}));

import { generateImage, generateImageResult, imageRoute } from "@/lib/studio/imagen";

describe("generateImageResult", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    m.gerar.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sem IMAGEN_MODEL → Gemini image (não chama o :predict)", async () => {
    vi.stubEnv("IMAGEN_MODEL", "");
    m.gerar.mockResolvedValue({ data: "AAAA", mimeType: "image/png" });
    expect(imageRoute()).toEqual({ provider: "gemini", model: "gemini-2.5-flash-image" });
    const r = await generateImageResult("  um coração  ", { aspectRatio: "16:9" }, 45_000);
    expect(r).toEqual({ image: { data: "AAAA", mimeType: "image/png" } });
    expect(m.gerar).toHaveBeenCalledWith("um coração", expect.objectContaining({ model: "gemini-2.5-flash-image", aspectRatio: "16:9", timeoutMs: 45_000 }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("IMAGEN_MODEL=gemini-* → Gemini com esse id", async () => {
    vi.stubEnv("IMAGEN_MODEL", "gemini-3-pro-image-preview");
    m.gerar.mockResolvedValue({ data: "B", mimeType: "image/png" });
    await generateImageResult("x");
    expect(m.gerar).toHaveBeenCalledWith("x", expect.objectContaining({ model: "gemini-3-pro-image-preview" }));
  });

  it("IMAGEN_MODEL=imagen-* responde → usa o Imagen", async () => {
    vi.stubEnv("IMAGEN_MODEL", "imagen-4.0-generate-001");
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ predictions: [{ bytesBase64Encoded: "IMG" }] }), { status: 200 }));
    expect(await generateImageResult("x")).toEqual({ image: { data: "IMG", mimeType: "image/png" } });
    expect(fetchMock.mock.calls[0][0]).toContain("/models/imagen-4.0-generate-001:predict");
    expect(m.gerar).not.toHaveBeenCalled();
  });

  it("IMAGEN_MODEL=imagen-* com 404 → cai pro Gemini image padrão", async () => {
    vi.stubEnv("IMAGEN_MODEL", "imagen-4.0-generate-001");
    fetchMock.mockResolvedValue(new Response("not found", { status: 404 }));
    m.gerar.mockResolvedValue({ data: "G", mimeType: "image/png" });
    expect(await generateImageResult("x")).toEqual({ image: { data: "G", mimeType: "image/png" } });
    expect(m.gerar).toHaveBeenCalledWith("x", expect.objectContaining({ model: "gemini-2.5-flash-image" }));
  });

  it("falha do Gemini → { error } com o motivo; generateImage → null", async () => {
    vi.stubEnv("IMAGEN_MODEL", "");
    m.gerar.mockRejectedValue(new Error("Vertex 429: Resource exhausted [global]"));
    expect(await generateImageResult("x")).toEqual({ error: "Vertex 429: Resource exhausted [global]" });
    expect(await generateImage("x")).toBeNull();
  });

  it("prompt vazio não chama nada", async () => {
    expect(await generateImageResult("   ")).toEqual({ error: "prompt vazio" });
    expect(m.gerar).not.toHaveBeenCalled();
  });
});
