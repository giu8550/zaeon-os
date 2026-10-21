/**
 * lib/rag/embed.ts — embeddings da base RAG: gemini-embedding-001 no Vertex, DIRETO.
 *
 * Nunca usa a chave grátis do AI Studio, o gateway nem o `zaeon-local-embed`: o vetor de um trecho e o da
 * pergunta têm que sair do MESMO modelo/dimensão, e o índice é fixo em 1024. Verificado em produção
 * (2026-10-21): `:predict` no endpoint global, 8 instâncias por chamada em ~1 s.
 */
import { vertexCredentials, geminiTextLocation, vertexHost } from "@/lib/ai/vertex-credentials";
import { vertexAccessToken } from "@/lib/ai/contextCache";

export const RAG_EMBED_MODEL = "gemini-embedding-001";
export const RAG_EMBED_DIM = 1024;
/** Instâncias por chamada `:predict`. */
export const LOTE_EMBED = 16;

/** Prazo de cada chamada `:predict`. */
const PRAZO_HTTP_MS = 30_000;

export type EmbedRag = (textos: string[], tipo: "documento" | "pergunta") => Promise<number[][]>;

export const embedVertex: EmbedRag = async (textos, tipo) => {
  if (textos.length === 0) return [];
  const { project, client_email, private_key } = vertexCredentials();
  const loc = geminiTextLocation();
  const token = await vertexAccessToken(client_email, private_key);
  if (!token) throw new Error("embed_sem_token");
  const url = `https://${vertexHost(loc)}/v1/projects/${project}/locations/${loc}/publishers/google/models/${RAG_EMBED_MODEL}:predict`;
  const task_type = tipo === "pergunta" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT";

  const out: number[][] = [];
  for (let i = 0; i < textos.length; i += LOTE_EMBED) {
    const lote = textos.slice(i, i + LOTE_EMBED);
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      // autoTruncate: uma tabela inteira (que o corte não parte) pode passar do limite de entrada — Vertex trunca em vez de falhar.
      body: JSON.stringify({
        instances: lote.map((content) => ({ content, task_type })),
        parameters: { outputDimensionality: RAG_EMBED_DIM, autoTruncate: true },
      }),
      // Sem prazo, um Vertex pendurado travaria o worker; abort vira erro lançado e a fila repete.
      signal: AbortSignal.timeout(PRAZO_HTTP_MS),
    });
    if (!res.ok) {
      const corpo = await res.text().catch(() => "");
      throw new Error(`embed_http_${res.status}${corpo ? `: ${corpo.slice(0, 200)}` : ""}`);
    }
    const json = (await res.json()) as { predictions?: { embeddings?: { values?: number[] } }[] };
    const vetores = (json.predictions ?? []).map((p) => p.embeddings?.values);
    if (vetores.length !== lote.length || vetores.some((v) => !Array.isArray(v))) throw new Error("embed_resposta_invalida");
    out.push(...(vetores as number[][]));
  }
  return out;
};
