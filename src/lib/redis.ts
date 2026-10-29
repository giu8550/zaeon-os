import { Redis } from '@upstash/redis';

// #641: 1 nova tentativa curta (antes: 5, com espera crescente ~4–5 s — o site inteiro esperava quando o Upstash caía).
// O prazo e a pausa depois de uma falha ficam em lib/redisDisjuntor.
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  retry: { retries: 1, backoff: () => 100 },
});
