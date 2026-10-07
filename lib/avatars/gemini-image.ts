/**
 * lib/avatars/gemini-image.ts — gerar/editar imagem com o Gemini image no Vertex (server-only).
 *
 * Por que não o Imagen (lib/studio/imagen.ts): no projeto atual os ids do Imagen respondem 404
 * (out/2026); o `gemini-2.5-flash-image` responde e, de quebra, EDITA uma imagem mantendo o
 * personagem — exatamente o que os quadros de expressão precisam. Mesma credencial do resto da IA.
 *   AVATAR_IMAGE_MODEL     (default gemini-2.5-flash-image)
 *   AVATAR_IMAGE_LOCATIONS (lista por vírgula; default global + 6 regiões que servem o modelo)
 * A cota compartilhada (DSQ) estoura fácil em rajada: 429 numa região → tenta a próxima na
 * hora; só depois de uma volta inteira de 429 é que espera (backoff exponencial + jitter).
 */
import { GoogleAuth } from "google-auth-library";
import { vertexCredentials } from "@/lib/ai/vertex-credentials";

const MODELO = () => process.env.AVATAR_IMAGE_MODEL || "gemini-2.5-flash-image";
const LOCAIS_PADRAO = "global,us-central1,us-east4,us-east1,us-west1,europe-west4,europe-west1";
const locais = () => (process.env.AVATAR_IMAGE_LOCATIONS || LOCAIS_PADRAO).split(",").map((s) => s.trim()).filter(Boolean);
/** Região "da vez" (compartilhada entre chamadas: quem acertou fica, quem tomou 429 passa a vez). */
let vez = 0;

export function geminiImageDisponivel(): boolean {
  const c = vertexCredentials();
  return !!(c.project && c.client_email && c.private_key);
}

let authCache: { auth: GoogleAuth; email: string } | null = null;
async function token(): Promise<string> {
  const { client_email, private_key } = vertexCredentials();
  if (!client_email || !private_key) throw new Error("sem credencial do Vertex (GOOGLE_CREDENTIALS)");
  if (!authCache || authCache.email !== client_email) {
    authCache = { email: client_email, auth: new GoogleAuth({ credentials: { client_email, private_key }, scopes: ["https://www.googleapis.com/auth/cloud-platform"] }) };
  }
  const t = await authCache.auth.getAccessToken();
  if (!t) throw new Error("token do Vertex vazio");
  return t;
}

/** Erro HTTP do Vertex que vale repetir (cota 429 / instabilidade 5xx). */
class ErroTransitorio extends Error {}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Texto (+ imagem opcional, pra edição) → 1 imagem (Buffer). Lança Error com motivo legível
 * (o admin mostra; o CLI loga) — inclusive quando o modelo recusa e devolve só texto.
 * 429/5xx → próxima região; volta inteira sem sucesso → espera e recomeça, até `esperaMaxMs`.
 */
export async function gerarImagemGemini(
  prompt: string,
  imagem?: { data: Buffer; mimeType: string },
  timeoutMs = 90_000,
  esperaMaxMs = 120_000,
): Promise<Buffer> {
  const lista = locais();
  let esperado = 0;
  for (let volta = 0; ; volta++) {
    let ultimo = "";
    for (let i = 0; i < lista.length; i++) {
      const loc = lista[vez % lista.length];
      try {
        return await chamar(prompt, imagem, timeoutMs, loc);
      } catch (e) {
        if (!(e instanceof ErroTransitorio)) throw e;
        ultimo = `${e.message} [${loc}]`;
        vez = (vez + 1) % lista.length;
      }
    }
    const espera = Math.min(30_000, 4_000 * 2 ** volta) * (0.75 + Math.random() * 0.5);
    if (esperado + espera > esperaMaxMs) throw new Error(ultimo);
    esperado += espera;
    await dormir(espera);
  }
}

async function chamar(prompt: string, imagem: { data: Buffer; mimeType: string } | undefined, timeoutMs: number, loc: string): Promise<Buffer> {
  const { project } = vertexCredentials();
  if (!project) throw new Error("sem projeto do Vertex (GOOGLE_CREDENTIALS)");
  const host = loc === "global" ? "aiplatform.googleapis.com" : `${loc}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1/projects/${project}/locations/${loc}/publishers/google/models/${MODELO()}:generateContent`;
  const parts: unknown[] = [];
  if (imagem) parts.push({ inlineData: { mimeType: imagem.mimeType, data: imagem.data.toString("base64") } });
  parts.push({ text: prompt });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } },
      }),
      signal: ctrl.signal,
    });
    const txt = await res.text();
    if (!res.ok) {
      let msg = txt.slice(0, 200);
      try { msg = JSON.parse(txt)?.error?.message?.slice(0, 200) || msg; } catch { /* corpo não-JSON */ }
      const Erro = res.status === 429 || res.status >= 500 ? ErroTransitorio : Error;
      throw new Erro(`Vertex ${res.status}: ${msg}`);
    }
    const json = JSON.parse(txt);
    const cand = json?.candidates?.[0];
    const part = cand?.content?.parts?.find((p: { inlineData?: { data?: string } }) => p?.inlineData?.data);
    if (!part) throw new Error(`sem imagem na resposta (${cand?.finishReason || json?.promptFeedback?.blockReason || "vazio"})`);
    return Buffer.from(part.inlineData.data, "base64");
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw new Error("tempo esgotado gerando a imagem");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
