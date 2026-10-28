/** #641: o guard() do limitador com o Upstash fora — libera rápido em vez de segurar a mensagem ~5 s. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const estado = { limit: (async () => ({ success: true, limit: 20, remaining: 19, reset: Date.now() + 60_000 })) as (k: string) => Promise<any>, chamadas: 0 };
vi.mock("@/src/lib/redis", () => ({ redis: {} }));
vi.mock("@/src/lib/cache", () => ({ redisEnabled: true }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: async () => ({ user: { email: "a@b.c" } }) }));
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit { static slidingWindow() { return {}; } limit(k: string) { estado.chamadas++; return estado.limit(k); } }
  return { Ratelimit };
});

import { guard } from "@/src/lib/ratelimit";
import { _zerarDisjuntorRedis, redisPausado } from "./redisDisjuntor";

const req = () => new Request("http://x/api/ai/chat", { headers: { "x-forwarded-for": "1.2.3.4" } });
beforeEach(() => { _zerarDisjuntorRedis(); estado.chamadas = 0; });

describe("guard com o Upstash fora (#641)", () => {
  it("Upstash mudo: libera em até ~meio segundo (não 5 s) e a próxima nem tenta", async () => {
    estado.limit = () => new Promise(() => {});
    const t0 = Date.now();
    expect(await guard(req(), "ai-chat")).toEqual({ ok: true });
    expect(Date.now() - t0).toBeLessThan(1500);
    expect(redisPausado()).toBe(true);
    const t1 = Date.now();
    expect(await guard(req(), "ai-chat")).toEqual({ ok: true });
    expect(Date.now() - t1).toBeLessThan(100);
    expect(estado.chamadas).toBe(1);
  });
  it("Upstash bom: continua limitando (429 quando estoura)", async () => {
    estado.limit = async () => ({ success: false, limit: 20, remaining: 0, reset: Date.now() + 30_000 });
    const r = await guard(req(), "ai-chat");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(429);
  });
});
