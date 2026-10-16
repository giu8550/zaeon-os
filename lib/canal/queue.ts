/**
 * lib/canal/queue.ts — fila dos turnos de agente do canal (BullMQ opcional, inline por padrão).
 *
 * Mesmo padrão de lib/queue/scholar.ts: bullmq carregado sob demanda e NUNCA no topo.
 *   CANAL_QUEUE=1 (+ REDIS_URL) → enfileira no BullMQ `canal-turnos`; o worker (CANAL_WORKER=1
 *     em instrumentation.ts) consome. Sem isso → roda INLINE no processo web (fire-and-forget,
 *     serializado por canal via lib/canal/serial.ts). Os dois caminhos chamam `executarTurno`.
 * jobId = canalId:agentKey:mensagemId → o mesmo @mention nunca vira dois turnos.
 */
import { emSerie } from "@/lib/canal/serial";
import { executarTurno, type TurnoInput, type TurnoDeps } from "@/lib/canal/agent-turn";

export const CANAL_QUEUE = "canal-turnos";
export type CanalTurnoJob = TurnoInput & { mensagemId: string };

export function filaLigada(): boolean {
  return process.env.CANAL_QUEUE === "1" && Boolean(process.env.REDIS_URL);
}

async function loadBullmq(): Promise<any | null> {
  try {
    const spec = "bull" + "mq";
    return await import(/* webpackIgnore: true */ spec as any);
  } catch {
    return null;
  }
}

let _queue: any = null;
async function getQueue(): Promise<any | null> {
  if (!filaLigada()) return null;
  if (_queue) return _queue;
  const bull = await loadBullmq();
  if (!bull) return null;
  const { getRedisConnection } = await import("@/lib/queue/scholar");
  _queue = new bull.Queue(CANAL_QUEUE, {
    connection: getRedisConnection() as any,
    defaultJobOptions: { attempts: 2, backoff: { type: "fixed", delay: 2000 }, removeOnComplete: 100, removeOnFail: 100 },
  });
  return _queue;
}

export const jobIdDe = (j: CanalTurnoJob) => `${j.canalId}:${j.agentKey}:${j.mensagemId}`;

/** Dispara o turno. Devolve por onde foi ("fila" | "inline"). Nunca lança. */
export async function dispararTurno(job: CanalTurnoJob, deps: () => Promise<TurnoDeps>): Promise<"fila" | "inline"> {
  try {
    const q = await getQueue();
    if (q) {
      await q.add("turno", job, { jobId: jobIdDe(job) });
      return "fila";
    }
  } catch (e) {
    console.warn("[canal] fila indisponível, rodando inline:", (e as Error)?.message);
  }
  void emSerie(job.canalId, async () => executarTurno(job, comEncadear(await deps(), deps))).catch(() => undefined);
  return "inline";
}

/** #396 (B): o turno pode passar a bola — o próximo agente entra pelo MESMO caminho (fila ou inline, em série por canal). */
function comEncadear(d: TurnoDeps, deps: () => Promise<TurnoDeps>): TurnoDeps {
  return { ...d, encadear: d.encadear ?? ((j) => dispararTurno(j, deps)) };
}

/** Dispara vários (um por agente mencionado) — em paralelo entre agentes, em série por canal. */
export async function dispararTurnos(jobs: CanalTurnoJob[], deps: () => Promise<TurnoDeps>): Promise<("fila" | "inline")[]> {
  return Promise.all(jobs.map((j) => dispararTurno(j, deps)));
}

/** Deps reais (Prisma singleton). Separado pra rota/worker injetarem outra coisa em teste. */
export async function depsReais(): Promise<TurnoDeps> {
  const { prisma } = await import("@/src/lib/prisma");
  return { prisma: prisma as unknown as TurnoDeps["prisma"] };
}

/** Worker BullMQ (chamado por instrumentation.ts quando CANAL_WORKER=1). */
export async function iniciarWorkerCanal(): Promise<boolean> {
  if (!filaLigada()) return false;
  const bull = await loadBullmq();
  if (!bull) return false;
  // Só o construtor, sem `typeof import("bullmq")`: o pacote é opcional e pode não estar no node_modules do build.
  const { Worker } = bull as { Worker: new (name: string, proc: (job: { data: CanalTurnoJob; id?: string }) => Promise<void>, opts: Record<string, unknown>) => { on(ev: string, fn: (...a: any[]) => void): void } };
  const { getRedisConnection } = await import("@/lib/queue/scholar");
  const concurrency = Number(process.env.CANAL_WORKER_CONCURRENCY || 4);
  const worker = new Worker(
    CANAL_QUEUE,
    async (job) => { await emSerie(job.data.canalId, async () => executarTurno(job.data, comEncadear(await depsReais(), depsReais))); },
    { connection: getRedisConnection()! as any, concurrency },
  );
  worker.on("failed", (job: any, err: Error) => console.error("[canal-worker] job falhou:", job?.id, err?.message));
  console.log(`[canal-worker] ouvindo "${CANAL_QUEUE}" (concurrency=${concurrency})`);
  return true;
}
