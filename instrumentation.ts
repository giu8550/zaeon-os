/**
 * instrumentation.ts — roda UMA vez no boot do servidor Next (register()).
 *
 * Aqui a gente sobe o WORKER de fundo da Sala de Pesquisa (BullMQ) — mas SÓ quando
 * SCHOLAR_WORKER=1. Assim o mesmo build serve pra:
 *   - web (SCHOLAR_WORKER=0): só atende HTTP e ENFILEIRA jobs;
 *   - worker dedicado (SCHOLAR_WORKER=1): consome a fila e roda o pipeline até o fim,
 *     independente do cliente estar na sala ou não.
 *
 * Nada acontece sem REDIS_URL (isQueueEnabled=false) nem fora do runtime nodejs.
 */
import type { ScholarJobData } from "@/lib/queue/scholar";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Worker dos turnos de agente do canal coworking (CANAL_QUEUE=1 + CANAL_WORKER=1 + REDIS_URL).
  // Independente do SCHOLAR_WORKER; sem as envs, os turnos rodam inline no web (lib/canal/queue.ts).
  if (process.env.CANAL_WORKER === "1") {
    try {
      const { iniciarWorkerCanal } = await import("@/lib/canal/queue");
      if (!(await iniciarWorkerCanal())) console.warn("[canal-worker] CANAL_WORKER=1 mas fila desligada (CANAL_QUEUE=1 + REDIS_URL) — não iniciado.");
    } catch (e) { console.warn("[canal-worker] não iniciado:", (e as Error)?.message); }
  }
  if (process.env.SCHOLAR_WORKER !== "1") return;

  const { getRedisConnection, isQueueEnabled, SCHOLAR_QUEUE } = await import("@/lib/queue/scholar");
  if (!isQueueEnabled()) {
    console.warn("[worker] SCHOLAR_WORKER=1 mas sem REDIS_URL — worker não iniciado.");
    return;
  }

  // bullmq é opcional: import escondido do bundler (webpackIgnore) + try/catch, pra o boot
  // NÃO quebrar quando o pacote não está instalado. Sem ele, o worker só não sobe.
  let bull: any;
  try {
    const spec = "bull" + "mq";
    bull = await import(/* webpackIgnore: true */ spec as any);
  } catch {
    console.warn("[worker] bullmq não instalado — worker não iniciado (rode `npm install`).");
    return;
  }
  // Só o TIPO vem de `typeof import("bullmq")` (apagado na compilação — o bundler não vê):
  // o import real continua escondido acima. Sem isto `Worker` é `any` e o tsc recusa o
  // `new Worker<ScholarJobData>(…)` (TS2347), que é o que deixava o portão de tipos vermelho.
  const { Worker } = bull as { Worker: typeof import("bullmq").Worker };
  const { prisma } = await import("@/src/lib/prisma");
  const { runScholarPipeline } = await import("@/lib/scholar/pipeline");

  const connection = getRedisConnection()!;
  const concurrency = Number(process.env.SCHOLAR_WORKER_CONCURRENCY || 3);

  // Persiste cada evento de progresso na própria sessão (fonte da verdade pro cliente
  // reconectar). Poucos eventos por job → um write por evento é barato. `done`/`error`
  // são tratados fora (o pipeline já grava o resultado final).
  async function persistEvent(sessionId: string, ev: any) {
    if (ev?.type === "done" || ev?.type === "error") return;
    try {
      const cur = await prisma.scholarSession.findUnique({ where: { id: sessionId }, select: { thread: true } });
      const thread: any = (cur?.thread as any) ?? {};
      const events = Array.isArray(thread.events) ? thread.events : [];
      events.push(ev);
      if (ev?.type === "answer") thread.answer = ev.text;
      thread.events = events;
      await prisma.scholarSession.update({ where: { id: sessionId }, data: { thread } });
    } catch { /* progresso é best-effort; o resultado final é o que importa */ }
  }

  const worker = new Worker<ScholarJobData>(
    SCHOLAR_QUEUE,
    async (job) => {
      const { sessionId, prompt, room, isDeep } = job.data;
      await prisma.scholarSession.update({ where: { id: sessionId }, data: { status: "running" } }).catch(() => {});
      try {
        await runScholarPipeline(sessionId, { prompt, room, isDeep }, (ev) => persistEvent(sessionId, ev));
      } catch (err: any) {
        console.error("[worker] scholar job falhou:", sessionId, err?.message);
        await prisma.scholarSession.update({
          where: { id: sessionId },
          data: { status: "error", thread: { error: err?.message ?? "Erro inesperado" } as any },
        }).catch(() => {});
        throw err; // deixa o BullMQ registrar a falha (e retentar conforme attempts)
      }
    },
    { connection: connection as any, concurrency },
  );

  worker.on("failed", (job, err) => console.error("[worker] job failed", job?.id, err?.message));
  worker.on("completed", (job) => console.log("[worker] job done", job?.id));
  console.log(`[worker] Scholar worker ATIVO (concurrency=${concurrency})`);
}
