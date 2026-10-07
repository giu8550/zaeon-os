/**
 * lib/ai/gemini-image.ts — gerar/editar imagem com o Gemini image no Vertex (server-only).
 * Compartilhado: Studio (lib/studio/imagen.ts) e avatares (PR #271, lib/avatars/gemini-image.ts).
 *
 * Por que não o Imagen: no projeto atual todos os ids do Imagen respondem 404 (out/2026);
 * o `gemini-2.5-flash-image` responde e ainda EDITA uma imagem mantendo o personagem.
 *   GEMINI_IMAGE_MODEL     (default gemini-2.5-flash-image)
 *   GEMINI_IMAGE_LOCATIONS (lista por vírgula; default global + 6 regiões que servem o modelo)
 * A cota compartilhada (DSQ) estoura fácil em rajada: 429 numa região → tenta a próxima na
 * hora; só depois de uma volta inteira de 429 é que espera (backoff exponencial + jitter).
 */
import { GoogleAuth } from "google-auth-library";
import { vertexCredentials } from "@/lib/ai/vertex-credentials";
import {
  GEMINI_IMAGE_MODEL_PADRAO,
  buildGeminiImageBody,
  geminiImageLocais,
  geminiImageTransitorio,
  geminiImageUrl,
  parseGeminiImageResponse,
} from "@/lib/ai/gemini-image-request";

export const geminiImageModelo = () => process.env.GEMINI_IMAGE_MODEL || GEMINI_IMAGE_MODEL_PADRAO;

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

export interface GeminiImageOpts {
  model?: string;
  locais?: string[];
  aspectRatio?: string;
  /** Imagem de referência pra edição. */
  imagem?: { data: Buffer; mimeType: string };
  /** Timeout de CADA chamada. */
  timeoutMs?: number;
  /** Teto da soma das esperas de backoff (depois de voltas inteiras de 429/5xx). */
  esperaMaxMs?: number;
}

/**
 * Texto (+ imagem opcional) → 1 imagem (base64 + mime). Lança Error com motivo legível —
 * inclusive quando o modelo recusa e devolve só texto.
 * 429/5xx → próxima região; volta inteira sem sucesso → espera e recomeça, até `esperaMaxMs`.
 */
export async function gerarImagemGemini(prompt: string, opts: GeminiImageOpts = {}): Promise<{ data: string; mimeType: string }> {
  const lista = opts.locais?.length ? opts.locais : geminiImageLocais(process.env.GEMINI_IMAGE_LOCATIONS);
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const esperaMaxMs = opts.esperaMaxMs ?? 120_000;
  let esperado = 0;
  for (let volta = 0; ; volta++) {
    let ultimo = "";
    for (let i = 0; i < lista.length; i++) {
      const loc = lista[vez % lista.length];
      try {
        return await chamar(prompt, opts, timeoutMs, loc);
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

async function chamar(prompt: string, opts: GeminiImageOpts, timeoutMs: number, loc: string): Promise<{ data: string; mimeType: string }> {
  const { project } = vertexCredentials();
  if (!project) throw new Error("sem projeto do Vertex (GOOGLE_CREDENTIALS)");
  const url = geminiImageUrl(project, loc, opts.model || geminiImageModelo());
  const body = buildGeminiImageBody(prompt, {
    aspectRatio: opts.aspectRatio,
    imagem: opts.imagem ? { mimeType: opts.imagem.mimeType, data: opts.imagem.data.toString("base64") } : undefined,
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const txt = await res.text();
    if (!res.ok) {
      let msg = txt.slice(0, 200);
      try { msg = JSON.parse(txt)?.error?.message?.slice(0, 200) || msg; } catch { /* corpo não-JSON */ }
      const Erro = geminiImageTransitorio(res.status) ? ErroTransitorio : Error;
      throw new Erro(`Vertex ${res.status}: ${msg}`);
    }
    const out = parseGeminiImageResponse(JSON.parse(txt));
    if ("motivo" in out) throw new Error(out.motivo);
    return out;
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw new Error("tempo esgotado gerando a imagem");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
