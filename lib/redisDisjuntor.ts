/**
 * lib/redisDisjuntor.ts — o Upstash Redis nunca mais segura o site (#641).
 *
 * O caso: o banco do Upstash ficou desativado. O cliente tentava 5 vezes, com espera crescente (~4–5 s), antes de
 * desistir — e o limitador de uso (src/lib/ratelimit `guard`) roda em TODA mensagem do chat e do blueprint: cada
 * uma esperava esses 5 s à toa (medido em produção: 5,3 s contra 0,9 s das rotas sem limitador).
 *
 * Agora toda conversa com o Redis passa por aqui:
 *   - PRAZO: sem resposta em PRAZO_REDIS_MS, desiste (quem chamou segue sem o Redis, como já fazia no erro);
 *   - DISJUNTOR: falhou (erro ou prazo) → nem tenta pelos próximos PAUSA_REDIS_MS. Sem isso, cada pedido ainda
 *     pagaria o prazo inteiro enquanto o Redis estiver fora. Passada a pausa, a próxima chamada testa de novo.
 */
export const PRAZO_REDIS_MS = 500;
export const PAUSA_REDIS_MS = 60_000;

let pausadoAte = 0;

/** O Redis está em pausa (falhou há menos de PAUSA_REDIS_MS)? Aí nem vale tentar. */
export function redisPausado(agora = Date.now()): boolean {
  return agora < pausadoAte;
}

/**
 * Roda `op` no Redis com prazo. Falhou ou estourou o prazo → abre o disjuntor e LANÇA (quem chama já trata o erro
 * como "Redis fora" e segue). Em pausa → lança na hora, sem tocar no Redis.
 */
export async function comRedis<T>(op: () => Promise<T>, opts: { prazoMs?: number; agora?: () => number } = {}): Promise<T> {
  const agora = opts.agora ?? Date.now;
  if (redisPausado(agora())) throw new Error("redis_pausado");
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      op(),
      new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error("redis_prazo")), opts.prazoMs ?? PRAZO_REDIS_MS); }),
    ]);
  } catch (e) {
    if (!redisPausado(agora())) console.warn(`[redis] fora (${(e as Error)?.message ?? e}) — pausa de ${PAUSA_REDIS_MS / 1000} s`);
    pausadoAte = agora() + PAUSA_REDIS_MS;
    throw e;
  } finally {
    if (t) clearTimeout(t);
  }
}

/** Só pra teste. */
export const _zerarDisjuntorRedis = () => { pausadoAte = 0; };
