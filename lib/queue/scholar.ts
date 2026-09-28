/**
 * Fila de jobs da Sala de Pesquisa (BullMQ sobre Redis).
 *
 * Um lugar só constrói a conexão e a fila. Se não houver REDIS_URL, tudo vira no-op
 * (isQueueEnabled() = false) e a rota cai no modo inline legado — dev sem Redis segue
 * funcionando.
 *
 * O WORKER que consome esta fila é iniciado em instrumentation.ts (quando
 * SCHOLAR_WORKER=1), rodando o pipeline até o fim independente do cliente.
 */
import { Queue, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";

export const SCHOLAR_QUEUE = "scholar";

export type ScholarJobData = {
  sessionId: string;
  prompt: string;
  room?: string | null;
  isDeep: boolean;
  userId: string;
};

const REDIS_URL = process.env.REDIS_URL || "";

let _connection: IORedis | null = null;
let _queue: Queue<ScholarJobData> | null = null;

export function isQueueEnabled(): boolean {
  return Boolean(REDIS_URL);
}

/** Conexão ioredis compartilhada (BullMQ exige maxRetriesPerRequest: null). */
export function getRedisConnection(): IORedis | null {
  if (!REDIS_URL) return null;
  if (!_connection) {
    _connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  }
  return _connection;
}

export function getScholarQueue(): Queue<ScholarJobData> | null {
  if (!REDIS_URL) return null;
  if (!_queue) {
    _queue = new Queue<ScholarJobData>(SCHOLAR_QUEUE, {
      connection: getRedisConnection() as unknown as ConnectionOptions,
      defaultJobOptions: {
        attempts: 2,                 // uma retentativa se o worker morrer no meio
        backoff: { type: "fixed", delay: 3000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    });
  }
  return _queue;
}

export async function enqueueScholarJob(data: ScholarJobData): Promise<boolean> {
  const q = getScholarQueue();
  if (!q) return false;
  await q.add("run", data, { jobId: data.sessionId }); // jobId = sessionId → idempotente
  return true;
}
