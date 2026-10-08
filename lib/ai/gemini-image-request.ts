/**
 * Montadores/parsers PUROS do Gemini image no Vertex (`:generateContent` com
 * responseModalities IMAGE). Sem rede — o cliente com auth+rotação fica em
 * lib/ai/gemini-image.ts.
 */

export const GEMINI_IMAGE_MODEL_PADRAO = "gemini-2.5-flash-image";
/** global + regiões que servem o modelo; a cota compartilhada (DSQ) estoura por região. */
export const GEMINI_IMAGE_LOCAIS_PADRAO = "global,us-central1,us-east4,us-east1,us-west1,europe-west4,europe-west1";

export function geminiImageLocais(env: string | undefined): string[] {
  const lista = (env || GEMINI_IMAGE_LOCAIS_PADRAO).split(",").map((s) => s.trim()).filter(Boolean);
  return lista.length ? lista : GEMINI_IMAGE_LOCAIS_PADRAO.split(",");
}

export function geminiImageUrl(project: string, loc: string, model: string): string {
  const host = loc === "global" ? "aiplatform.googleapis.com" : `${loc}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${project}/locations/${loc}/publishers/google/models/${model}:generateContent`;
}

export interface GeminiImageBodyOpts {
  aspectRatio?: string; // "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | …
  /** Imagem de referência (edição mantendo o personagem). base64. */
  imagem?: { data: string; mimeType: string };
}

export function buildGeminiImageBody(prompt: string, opts?: GeminiImageBodyOpts) {
  const parts: unknown[] = [];
  if (opts?.imagem) parts.push({ inlineData: { mimeType: opts.imagem.mimeType, data: opts.imagem.data } });
  parts.push({ text: prompt });
  return {
    contents: [{ role: "user", parts }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: opts?.aspectRatio || "1:1" } },
  };
}

/**
 * 1ª imagem da resposta, ou o motivo de não ter vindo (o modelo às vezes recusa e
 * devolve só texto / finishReason / blockReason).
 */
export function parseGeminiImageResponse(json: any): { data: string; mimeType: string } | { motivo: string } {
  const cand = json?.candidates?.[0];
  const part = cand?.content?.parts?.find((p: any) => p?.inlineData?.data);
  if (part) return { data: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/png" };
  return { motivo: `sem imagem na resposta (${cand?.finishReason || json?.promptFeedback?.blockReason || "vazio"})` };
}

/** 429 (cota) e 5xx valem tentar outra região; o resto é erro de verdade. */
export function geminiImageTransitorio(status: number): boolean {
  return status === 429 || status >= 500;
}
