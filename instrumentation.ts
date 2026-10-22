/**
 * instrumentation.ts — roda UMA vez no boot do servidor Next (register()).
 *
 * Aqui a gente sobe os WORKERS de fundo (BullMQ) — Sala de Pesquisa (fila "scholar") e
 * chat da Aura (fila "chat", Fase 3) — mais o reaper de jobs presos. SÓ quando
 * SCHOLAR_WORKER=1. Assim o mesmo build serve pra:
 *   - web (SCHOLAR_WORKER=0): só atende HTTP e ENFILEIRA jobs;
 *   - worker dedicado (SCHOLAR_WORKER=1): consome a fila e roda o pipeline até o fim,
 *     independente do cliente estar na sala ou não.
 *
 * Nada acontece sem REDIS_URL (isQueueEnabled=false) nem fora do runtime nodejs.
 * O corpo mora em instrumentation-node.ts (ver lá por que).
 */

export async function register() {
  // Tudo DENTRO do if (não `return` antecipado): o webpack troca NEXT_RUNTIME pela constante e corta
  // o bloco no build do runtime edge — senão ele tentaria empacotar Prisma/bullmq pro edge.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Worker dos turnos de agente do canal coworking (CANAL_WORKER=1 + CANAL_QUEUE=1 + REDIS_URL):
    // independente do SCHOLAR_WORKER; sem as envs, os turnos rodam inline no web (lib/canal/queue.ts).
    if (process.env.CANAL_WORKER === "1") {
      const { iniciarWorkerCanalOpcional } = await import("./instrumentation-node");
      await iniciarWorkerCanalOpcional();
    }
    // Worker das chores (Fatia 7): CHORES_WORKER=1 + CHORES_QUEUE=1 + REDIS_URL; sem as envs, nenhuma chore existe.
    if (process.env.CHORES_WORKER === "1") {
      const { iniciarWorkerChoresOpcional } = await import("./instrumentation-node");
      await iniciarWorkerChoresOpcional();
    }
    // Worker da indexação RAG (RAG_WORKER=1 + RAG_QUEUE=1 + REDIS_URL); sem as envs, a indexação roda inline no web.
    if (process.env.RAG_WORKER === "1") {
      const { iniciarWorkerRagOpcional } = await import("./instrumentation-node");
      await iniciarWorkerRagOpcional();
    }
    // Memória L3 dos agentes (MEMORY_L3=1 + DATABASE_URL); sem a env, os consumidores caem no nullMemory.
    if (process.env.MEMORY_L3 === "1") {
      const { ligarMemoriaOpcional } = await import("./instrumentation-node");
      await ligarMemoriaOpcional();
    }
    if (process.env.SCHOLAR_WORKER === "1") {
      const { iniciarWorkers } = await import("./instrumentation-node");
      await iniciarWorkers();
    }
  }
}
