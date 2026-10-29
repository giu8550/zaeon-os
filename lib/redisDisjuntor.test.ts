import { describe, it, expect, vi, beforeEach } from "vitest";
import { comRedis, redisPausado, _zerarDisjuntorRedis, PAUSA_REDIS_MS } from "./redisDisjuntor";

beforeEach(() => _zerarDisjuntorRedis());

describe("redisDisjuntor (#641)", () => {
  it("Redis respondendo: devolve o valor e não pausa", async () => {
    expect(await comRedis(async () => 42)).toBe(42);
    expect(redisPausado()).toBe(false);
  });
  it("Redis mudo: desiste no prazo (não espera os ~5 s) e pausa", async () => {
    const t0 = Date.now();
    await expect(comRedis(() => new Promise(() => {}), { prazoMs: 30 })).rejects.toThrow("redis_prazo");
    expect(Date.now() - t0).toBeLessThan(500);
    expect(redisPausado()).toBe(true);
  });
  it("em pausa: nem toca no Redis; passada a pausa, tenta de novo", async () => {
    let agora = 1_000_000;
    const relogio = () => agora;
    await expect(comRedis(async () => { throw new Error("fora"); }, { agora: relogio })).rejects.toThrow("fora");
    const op = vi.fn(async () => "ok");
    await expect(comRedis(op, { agora: relogio })).rejects.toThrow("redis_pausado");
    expect(op).not.toHaveBeenCalled();
    agora += PAUSA_REDIS_MS + 1;
    expect(await comRedis(op, { agora: relogio })).toBe("ok");
    expect(op).toHaveBeenCalledTimes(1);
  });
});
