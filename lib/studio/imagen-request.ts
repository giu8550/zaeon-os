/**
 * Montadores/parsers PUROS da imagem do Studio. Sem rede — o wrapper com auth+fetch
 * fica em lib/studio/imagen.ts.
 *
 * Caminho padrão: Gemini image (lib/ai/gemini-image.ts) — no projeto atual todos os ids
 * do Imagen respondem 404 (out/2026). O Imagen (Vertex `:predict`, saída
 * predictions[0].bytesBase64Encoded) só entra se IMAGEN_MODEL apontar pra um `imagen-*`.
 */

export type ImageRoute = { provider: "gemini" | "imagen"; model: string };

/**
 * IMAGEN_MODEL é override OPCIONAL:
 *   vazio      → Gemini image com o modelo padrão;
 *   `imagen-*` → Imagen `:predict` (se o projeto tiver acesso);
 *   outro id   → Gemini image com esse id (ex.: gemini-3-pro-image-preview).
 */
export function resolveImageRoute(imagenModelEnv: string | undefined, geminiDefault: string): ImageRoute {
  const id = (imagenModelEnv || "").trim();
  if (!id) return { provider: "gemini", model: geminiDefault };
  if (/^imagen-/i.test(id)) return { provider: "imagen", model: id };
  return { provider: "gemini", model: id };
}

export interface ImagenOptions {
  count?: number; // nº de imagens (default 1)
  aspectRatio?: string; // "1:1" | "16:9" | "9:16" | "4:3" | "3:4"
}

export interface ImagenBody {
  instances: { prompt: string }[];
  parameters: { sampleCount: number; aspectRatio: string };
}

export function buildImagenBody(prompt: string, opts?: ImagenOptions): ImagenBody {
  return {
    instances: [{ prompt }],
    parameters: {
      sampleCount: Math.max(1, Math.min(4, opts?.count ?? 1)),
      aspectRatio: opts?.aspectRatio || "1:1",
    },
  };
}

/** Extrai a 1ª imagem (base64 + mime). Aceita camelCase e snake_case. */
export function parseImagenResponse(json: any): { data: string; mimeType: string } | null {
  const p = json?.predictions?.[0];
  if (!p) return null;
  const data = p.bytesBase64Encoded ?? p.bytes_base64_encoded;
  if (!data) return null;
  return { data, mimeType: p.mimeType || p.mime_type || "image/png" };
}
