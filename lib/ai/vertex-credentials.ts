/**
 * Credenciais Vertex resilientes (ponto único). GOOGLE_CREDENTIALS pode vir como:
 *   - JSON de uma linha (private_key com \n escapado) → parseia normal;
 *   - JSON com QUEBRAS DE LINHA REAIS dentro da private_key (comum em .env) →
 *     o JSON.parse cru falha; aqui escapamos os \n e tentamos de novo;
 *   - ausente → cai nas vars discretas GOOGLE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY.
 *
 * Antes, /api/ai/chat e helpers usavam JSON.parse cru e QUEBRAVAM quando a chave
 * tinha newlines reais — o que derrubava a conexão com o Gemini.
 */
const stripQuotes = (s?: string) => (s || "").replace(/^["']|["']$/g, "");

export function vertexCredentials(): {
  project: string;
  client_email: string;
  private_key: string;
  location: string;
} {
  const raw = process.env.GOOGLE_CREDENTIALS || "";
  let creds: any = {};
  if (raw) {
    try {
      creds = JSON.parse(raw);
    } catch {
      // private_key com newlines reais é a única fonte de \n cru num JSON compacto.
      try { creds = JSON.parse(raw.replace(/\n/g, "\\n")); } catch { creds = {}; }
    }
  }
  const project = creds.project_id || stripQuotes(process.env.GOOGLE_PROJECT_ID);
  const client_email = creds.client_email || stripQuotes(process.env.GOOGLE_CLIENT_EMAIL);
  let private_key = creds.private_key || stripQuotes(process.env.GOOGLE_PRIVATE_KEY) || "";
  if (private_key.includes("\\n")) private_key = private_key.replace(/\\n/g, "\n");
  const location = stripQuotes(process.env.GOOGLE_LOCATION) || "us-central1";
  return { project, client_email, private_key, location };
}

/**
 * Location dos modelos de TEXTO do Gemini (chat, cache de PDF, agentes, Scholar).
 * Separada de GOOGLE_LOCATION (imagem/TTS/Imagen ficam lá) porque:
 *   - a cota compartilhada de uma região só estoura no pico (us-central1 dava 429 em rajada);
 *     o endpoint "global" espalha a carga;
 *   - gemini-3.5-flash só existe no "global" neste projeto (404 em us-central1, testado 2026-10-20).
 * Sem GEMINI_TEXT_LOCATION = comportamento antigo (GOOGLE_LOCATION). Rollback = tirar a env.
 */
export function geminiTextLocation(): string {
  return stripQuotes(process.env.GEMINI_TEXT_LOCATION) || stripQuotes(process.env.GOOGLE_LOCATION) || "us-central1";
}

/** Host REST do Vertex: o "global" NÃO tem prefixo de região (global-aiplatform… não existe). */
export function vertexHost(location: string): string {
  return location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
}

/**
 * Opções de location pro `new VertexAI({...})` dos modelos de texto. O SDK 1.10 monta
 * `${location}-aiplatform…` sozinho e no "global" devolve uma página HTML (JSON inválido),
 * então o host vai explícito em apiEndpoint.
 */
export function vertexTextClientOpts(): { location: string; apiEndpoint?: string } {
  const location = geminiTextLocation();
  return location === "global" ? { location, apiEndpoint: vertexHost(location) } : { location };
}
