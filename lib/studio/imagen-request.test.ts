import { describe, it, expect } from "vitest";
import { buildImagenBody, parseImagenResponse, resolveImageRoute } from "@/lib/studio/imagen-request";
import {
  GEMINI_IMAGE_MODEL_PADRAO,
  buildGeminiImageBody,
  geminiImageLocais,
  geminiImageTransitorio,
  geminiImageUrl,
  parseGeminiImageResponse,
} from "@/lib/ai/gemini-image-request";

describe("resolveImageRoute (IMAGEN_MODEL é override opcional)", () => {
  it("sem IMAGEN_MODEL → Gemini image com o modelo padrão", () => {
    expect(resolveImageRoute(undefined, GEMINI_IMAGE_MODEL_PADRAO)).toEqual({ provider: "gemini", model: "gemini-2.5-flash-image" });
    expect(resolveImageRoute("  ", "g")).toEqual({ provider: "gemini", model: "g" });
  });
  it("imagen-* → Imagen :predict", () => {
    expect(resolveImageRoute("imagen-4.0-generate-001", "g")).toEqual({ provider: "imagen", model: "imagen-4.0-generate-001" });
  });
  it("outro id → Gemini image com esse id", () => {
    expect(resolveImageRoute("gemini-3-pro-image-preview", "g")).toEqual({ provider: "gemini", model: "gemini-3-pro-image-preview" });
  });
});

describe("buildGeminiImageBody", () => {
  it("pede só IMAGE, 1:1 por padrão", () => {
    expect(buildGeminiImageBody("um coração")).toEqual({
      contents: [{ role: "user", parts: [{ text: "um coração" }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
    });
  });
  it("respeita aspectRatio e põe a imagem de referência antes do texto", () => {
    const b = buildGeminiImageBody("edita", { aspectRatio: "16:9", imagem: { data: "QQ==", mimeType: "image/png" } });
    expect(b.generationConfig.imageConfig.aspectRatio).toBe("16:9");
    expect(b.contents[0].parts).toEqual([{ inlineData: { mimeType: "image/png", data: "QQ==" } }, { text: "edita" }]);
  });
});

describe("parseGeminiImageResponse", () => {
  it("acha a parte inlineData mesmo depois de texto", () => {
    const json = { candidates: [{ content: { parts: [{ text: "aqui" }, { inlineData: { data: "AAAA", mimeType: "image/jpeg" } }] } }] };
    expect(parseGeminiImageResponse(json)).toEqual({ data: "AAAA", mimeType: "image/jpeg" });
  });
  it("mime default image/png", () => {
    expect(parseGeminiImageResponse({ candidates: [{ content: { parts: [{ inlineData: { data: "B" } }] } }] })).toEqual({ data: "B", mimeType: "image/png" });
  });
  it("sem imagem → motivo (finishReason / blockReason / vazio)", () => {
    expect(parseGeminiImageResponse({ candidates: [{ finishReason: "IMAGE_SAFETY", content: { parts: [{ text: "não" }] } }] })).toEqual({ motivo: "sem imagem na resposta (IMAGE_SAFETY)" });
    expect(parseGeminiImageResponse({ promptFeedback: { blockReason: "PROHIBITED_CONTENT" } })).toEqual({ motivo: "sem imagem na resposta (PROHIBITED_CONTENT)" });
    expect(parseGeminiImageResponse(null)).toEqual({ motivo: "sem imagem na resposta (vazio)" });
  });
});

describe("geminiImageUrl / locais / transitório", () => {
  it("global usa o host sem prefixo de região", () => {
    expect(geminiImageUrl("p", "global", "m")).toBe("https://aiplatform.googleapis.com/v1/projects/p/locations/global/publishers/google/models/m:generateContent");
    expect(geminiImageUrl("p", "us-east4", "m")).toBe("https://us-east4-aiplatform.googleapis.com/v1/projects/p/locations/us-east4/publishers/google/models/m:generateContent");
  });
  it("lista de regiões: env por vírgula, default começa no global", () => {
    expect(geminiImageLocais(" us-central1 , ,europe-west4")).toEqual(["us-central1", "europe-west4"]);
    expect(geminiImageLocais(undefined)[0]).toBe("global");
    expect(geminiImageLocais(" , ")[0]).toBe("global");
  });
  it("429 e 5xx são transitórios; 404/400 não", () => {
    expect([429, 500, 503].map(geminiImageTransitorio)).toEqual([true, true, true]);
    expect([400, 403, 404].map(geminiImageTransitorio)).toEqual([false, false, false]);
  });
});

describe("buildImagenBody", () => {
  it("monta instances + parameters com defaults (1 imagem, 1:1)", () => {
    expect(buildImagenBody("um coração")).toEqual({
      instances: [{ prompt: "um coração" }],
      parameters: { sampleCount: 1, aspectRatio: "1:1" },
    });
  });
  it("respeita count e aspectRatio, com count entre 1 e 4", () => {
    expect(buildImagenBody("x", { count: 9, aspectRatio: "16:9" }).parameters).toEqual({ sampleCount: 4, aspectRatio: "16:9" });
    expect(buildImagenBody("x", { count: 0 }).parameters.sampleCount).toBe(1);
  });
});

describe("parseImagenResponse", () => {
  it("extrai bytesBase64Encoded + mime", () => {
    expect(parseImagenResponse({ predictions: [{ bytesBase64Encoded: "AAAA", mimeType: "image/png" }] })).toEqual({
      data: "AAAA",
      mimeType: "image/png",
    });
  });
  it("aceita snake_case e mime default", () => {
    const out = parseImagenResponse({ predictions: [{ bytes_base64_encoded: "BBBB" }] });
    expect(out?.data).toBe("BBBB");
    expect(out?.mimeType).toBe("image/png");
  });
  it("null sem predições", () => {
    expect(parseImagenResponse({ predictions: [] })).toBeNull();
    expect(parseImagenResponse({})).toBeNull();
    expect(parseImagenResponse(null)).toBeNull();
  });
});
