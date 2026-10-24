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

export const embedVertex: EmbedRag = (textos, tipo) =>
  embedGemini(textos, { dim: RAG_EMBED_DIM, taskType: tipo === "pergunta" ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT" });

/**
 * O vetor da PERGUNTA do turno, COMPARTILHADO (out/2026): o RAG da turma (lib/rag/turno) e o cache de respostas
 * (lib/rag/cacheRespostas) precisam do mesmo vetor — uma chamada ao Vertex só. Memo por texto por 60 s (a mesma
 * promessa serve os dois, mesmo pedidos ao mesmo tempo); falhou → sai do memo (a próxima tenta de novo).
 */
const memoPergunta = new Map<string, { em: number; p: Promise<number[]> }>();
export function embedPerguntaCompartilhado(texto: string, embed: EmbedRag = embedVertex, agora: () => number = Date.now): Promise<number[]> {
  const t = agora();
  for (const [k, v] of memoPergunta) if (t - v.em > 60_000) memoPergunta.delete(k);
  const achado = memoPergunta.get(texto);
  if (achado) return achado.p;
  const p = embed([texto], "pergunta").then((vs) => { if (!vs[0]) throw new Error("embed_vazio"); return vs[0]; });
  p.catch(() => memoPergunta.delete(texto));
  memoPergunta.set(texto, { em: t, p });
  if (memoPergunta.size > 300) memoPergunta.delete(memoPergunta.keys().next().value as string);
  return p;
}
/** o embedVertex com a PERGUNTA vindo do memo compartilhado (o que o RAG do turno usa) */
export const embedVertexCompartilhado: EmbedRag = (textos, tipo) =>
  tipo === "pergunta" && textos.length === 1 ? embedPerguntaCompartilhado(textos[0]!).then((v) => [v]) : embedVertex(textos, tipo);

/**
 * gemini-embedding-001 no Vertex com a dimensão pedida. Também serve a memória L3 (1536, sem task_type:
 * o mesmo vetor serve pra gravar e pra buscar). Lotes de LOTE_EMBED; erro HTTP/timeout lança.
 */
export async function embedGemini(textos: string[], o: { dim: number; taskType?: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT" }): Promise<number[][]> {
  if (textos.length === 0) return [];
  const { project, client_email, private_key } = vertexCredentials();
  const loc = geminiTextLocation();
  const token = await vertexAccessToken(client_email, private_key);
  if (!token) throw new Error("embed_sem_token");
  const url = `https://${vertexHost(loc)}/v1/projects/${project}/locations/${loc}/publishers/google/models/${RAG_EMBED_MODEL}:predict`;

  const out: number[][] = [];
  for (let i = 0; i < textos.length; i += LOTE_EMBED) {
    const lote = textos.slice(i, i + LOTE_EMBED);
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      // autoTruncate: uma tabela inteira (que o corte não parte) pode passar do limite de entrada — Vertex trunca em vez de falhar.
      body: JSON.stringify({
        instances: lote.map((content) => (o.taskType ? { content, task_type: o.taskType } : { content })),
        parameters: { outputDimensionality: o.dim, autoTruncate: true },
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
}
