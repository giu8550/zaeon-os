/**
 * lib/queue/rag.ts — fila `rag-index` (RAG F1), no molde de lib/queue/chores.ts.
 *
 *   RAG_QUEUE=1 (+ REDIS_URL) → BullMQ; o worker (RAG_WORKER=1, instrumentation) consome.
 *   Sem fila → a indexação roda INLINE em segundo plano (não bloqueia o upload; erro só loga).
 * Retry: attempts 5 com backoff exponencial (30 s…). `indexarDocumento` é idempotente e retomável:
 * cada lote já gravado fica; a nova tentativa só manda os trechos que ainda não têm vetor.
 * Ritmo: o embedding do Vertex é a MESMA cota da pergunta do chat e da memória L3. O worker limita a
 * RAG_INDEX_POR_MIN documentos/min (padrão 20) e, num 429, pausa a fila inteira 60 s SEM gastar tentativa
 * (carga grande, como as bases por área, virava 1.149 429 em 30 min e documento marcado como erro).
 */
import type { EmbedRag } from "@/lib/rag/embed";
import type { RagDb } from "@/lib/rag/pg";
import { buscarPorId, marcarErro, registrarVetores, trechosSemVetor } from "@/lib/rag/store";

export const RAG_QUEUE = "rag-index";
type Env = Record<string, string | undefined>;

/** Trechos por chamada de `embed` (o embedder fatia por conta própria em LOTE_EMBED). */
const LOTE_INDEXACAO = 64;

export const filaRagLigada = (env: Env = process.env): boolean => env.RAG_QUEUE === "1" && Boolean(env.REDIS_URL);

async function loadBullmq(): Promise<any | null> {
  try { const spec = "bull" + "mq"; return await import(/* webpackIgnore: true */ spec as any); } catch { return null; }
}

let _queue: any = null;
async function getQueue(): Promise<any | null> {
  if (!filaRagLigada()) return null;
  if (_queue) return _queue;
  const bull = await loadBullmq();
  if (!bull) return null;
  const { getRedisConnection } = await import("@/lib/queue/scholar");
  _queue = new bull.Queue(RAG_QUEUE, {
    connection: getRedisConnection() as any,
    defaultJobOptions: { removeOnComplete: 200, removeOnFail: 200 },
  });
  return _queue;
}

/**
 * Vetoriza os trechos que ainda não têm vetor, em lotes, até acabar. Grava a cada lote (falha no meio
 * preserva o que já foi feito e REJEITA — o BullMQ repete). `pronto` = documento virou "pronto".
 */
export async function indexarDocumento(
  deps: { db: RagDb; embed: EmbedRag },
  documentoId: string,
): Promise<{ vetorizados: number; pronto: boolean }> {
  let vetorizados = 0;
  for (;;) {
    const lote = await trechosSemVetor(deps.db, documentoId, LOTE_INDEXACAO);
    if (lote.length === 0) break;
    const vetores = await deps.embed(lote.map((t) => t.texto), "documento");
    // Sem esta checagem, um embed que devolve menos vetores deixaria os mesmos trechos "sem vetor" para sempre.
    if (vetores.length !== lote.length || vetores.some((v) => !Array.isArray(v) || v.length === 0)) {
      throw new Error(`embed devolveu ${vetores.length} vetores para ${lote.length} trechos`);
    }
    await registrarVetores(deps.db, documentoId, lote.map((t, i) => ({ trechoId: t.id, embedding: vetores[i] })));
    vetorizados += lote.length;
  }
  const doc = await buscarPorId(deps.db, documentoId);
  return { vetorizados, pronto: doc?.status === "pronto" };
}

/** Deps reais (Postgres do RAG + Vertex), importadas sob demanda para o teste unitário não abrir conexão. */
async function depsReais(): Promise<{ db: RagDb; embed: EmbedRag }> {
  const { ragPg } = await import("@/lib/rag/pg");
  const { embedVertex } = await import("@/lib/rag/embed");
  return { db: ragPg(), embed: embedVertex };
}

/** Pedaço da Queue do BullMQ que usamos (injetável em teste). */
export type FilaRag = {
  getJob(id: string): Promise<{ getState(): Promise<string>; remove(): Promise<unknown> } | null | undefined>;
  add(nome: string, data: { documentoId: string }, opts: Record<string, unknown>): Promise<unknown>;
};

/**
 * Põe o documento na fila. jobId fixo e sem ":" (BullMQ recusa) => o BullMQ IGNORA em silêncio um `add` cujo id ainda
 * existe (inclusive job concluído/falho retido por removeOnComplete/Fail). Por isso: concluído/falho é removido antes
 * de re-adicionar; esperando/ativo/atrasado já está na fila — não adiciona de novo.
 */
export async function enfileirarNaFila(q: FilaRag, documentoId: string): Promise<"fila"> {
  const jobId = "rag_" + documentoId;
  const existente = await q.getJob(jobId);
  if (existente) {
    const estado = await existente.getState();
    if (estado !== "failed" && estado !== "completed") return "fila"; // já pendente
    await existente.remove();
  }
  await q.add("indexar", { documentoId }, { jobId, attempts: 5, backoff: { type: "exponential", delay: 30_000 } });
  return "fila";
}

/** Marca o documento "erro/indexacao_falhou" sem nunca lançar (best-effort; só loga). */
export async function marcarFalhaIndexacao(db: RagDb, documentoId: string): Promise<boolean> {
  try {
    await marcarErro(db, documentoId, "indexacao_falhou");
    return true;
  } catch (e) {
    console.warn("[rag] não consegui marcar indexacao_falhou:", documentoId, (e as Error)?.message);
    return false;
  }
}

/** Indexação inline (sem fila): falhou ⇒ o documento vira "erro" (senão ficaria "indexando" para sempre). */
export async function indexarInline(deps: { db: RagDb; embed: EmbedRag }, documentoId: string): Promise<void> {
  try {
    await indexarDocumento(deps, documentoId);
  } catch (e) {
    console.warn("[rag] indexação inline falhou:", documentoId, (e as Error)?.message);
    await marcarFalhaIndexacao(deps.db, documentoId);
  }
}

/** 429 do Vertex (cota de embedding) — espera a fila, não é falha do documento. */
export const ehCotaEmbed = (e: unknown): boolean => /embed_http_429\b/.test((e as Error)?.message ?? String(e));

/** Documentos por minuto do worker (RAG_INDEX_POR_MIN, padrão 20; inválido ⇒ padrão). */
export function ritmoIndexacao(env: Env = process.env): number {
  const n = Number(env.RAG_INDEX_POR_MIN);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 20;
}

/** Pausa da fila inteira depois de um 429. */
export const PAUSA_COTA_MS = 60_000;

/** O job esgotou as tentativas (a próxima falha não será repetida pelo BullMQ)? */
export function deveMarcarFalhaFinal(job: { attemptsMade?: number; opts?: { attempts?: number } } | null | undefined): boolean {
  if (!job) return false;
  return (job.attemptsMade ?? 0) >= (job.opts?.attempts ?? 1);
}

/** Agenda a indexação. "fila" (BullMQ) ou "inline" (segundo plano, sem aguardar). Nunca lança por falha de indexação. */
export async function enfileirarIndexacao(documentoId: string): Promise<"fila" | "inline"> {
  try {
    const q = await getQueue();
    if (q) return await enfileirarNaFila(q as FilaRag, documentoId);
  } catch (e) {
    console.warn("[rag] fila indisponível, indexando inline:", (e as Error)?.message);
  }
  void depsReais()
    .then((d) => indexarInline(d, documentoId))
    .catch((e) => console.warn("[rag] indexação inline: deps indisponíveis:", documentoId, (e as Error)?.message));
  return "inline";
}

/** Worker BullMQ (instrumentation, RAG_WORKER=1). */
export async function iniciarWorkerRag(env: Env = process.env): Promise<boolean> {
  if (env.RAG_WORKER !== "1" || !filaRagLigada(env)) return false;
  const bull = await loadBullmq();
  if (!bull) return false;
  type W = { on(ev: string, fn: (...a: any[]) => void): void; rateLimit(ms: number): Promise<void> };
  const { Worker } = bull as { Worker: (new (n: string, p: (job: any) => Promise<unknown>, o: Record<string, unknown>) => W) & { RateLimitError: () => Error } };
  const { getRedisConnection } = await import("@/lib/queue/scholar");
  const deps = await depsReais();
  const porMin = ritmoIndexacao(env);
  const worker: W = new Worker(RAG_QUEUE, async (job) => {
    const documentoId = String(job.data?.documentoId ?? "");
    if (!documentoId) return null;
    try {
      return await indexarDocumento(deps, documentoId); // lança => BullMQ aplica attempts/backoff
    } catch (e) {
      if (!ehCotaEmbed(e)) throw e;
      // Cota: a fila toda espera e o job volta sem contar tentativa (RateLimitError do BullMQ).
      await worker.rateLimit(PAUSA_COTA_MS);
      throw Worker.RateLimitError();
    }
  }, { connection: getRedisConnection()! as any, concurrency: 2, limiter: { max: porMin, duration: 60_000 } });
  worker.on("failed", (job: any, e: Error) => {
    console.error("[rag-worker] job falhou:", job?.id, e?.message);
    // Tentativas esgotadas: sem isto o documento ficaria "indexando" para sempre (re-upload reenfileira, mas o admin não sabe).
    if (deveMarcarFalhaFinal(job)) {
      const documentoId = String(job?.data?.documentoId ?? "");
      if (documentoId) void marcarFalhaIndexacao(deps.db, documentoId);
    }
  });
  // Sem listener, um "error" do ioredis/BullMQ vira exceção não tratada dentro do processo web.
  worker.on("error", (e: Error) => console.error("[rag-worker] erro", e?.message));
  console.log(`[rag-worker] ouvindo "${RAG_QUEUE}" (concurrency=2, ${porMin} docs/min)`);
  return true;
}
