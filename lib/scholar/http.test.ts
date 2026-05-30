import { describe, it, expect, vi } from "vitest";
import { fetchWithRetry, mapLimit } from "./http";

const resp = (status: number, headers: Record<string,string> = {}) =>
  new Response("ok", { status, headers });

describe("fetchWithRetry", () => {
  it("returns immediately on 200 (one call)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp(200));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const r = await fetchWithRetry("http://x", {}, { fetchImpl: fetchImpl as any, sleep });
    expect(r.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries on 429 then succeeds", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(resp(429))
      .mockResolvedValueOnce(resp(200));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const r = await fetchWithRetry("http://x", {}, { fetchImpl: fetchImpl as any, sleep, retries: 3 });
    expect(r.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("honors Retry-After header (seconds → ms)", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(resp(429, { "retry-after": "2" }))
      .mockResolvedValueOnce(resp(200));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await fetchWithRetry("http://x", {}, { fetchImpl: fetchImpl as any, sleep });
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("gives up after `retries` and returns the last 429", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp(429));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const r = await fetchWithRetry("http://x", {}, { fetchImpl: fetchImpl as any, sleep, retries: 2 });
    expect(r.status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });

  it("sets a default User-Agent when none provided", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp(200));
    await fetchWithRetry("http://x", {}, { fetchImpl: fetchImpl as any, sleep: async () => {} });
    const passedInit = fetchImpl.mock.calls[0][1];
    expect(new Headers(passedInit.headers).get("User-Agent")).toContain("ZaeonScholar");
  });

  it("retries on a network throw then succeeds", async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(resp(200));
    const r = await fetchWithRetry("http://x", {}, { fetchImpl: fetchImpl as any, sleep: async () => {}, retries: 2 });
    expect(r.status).toBe(200);
  });
});

describe("mapLimit", () => {
  it("processes all items and preserves order", async () => {
    const out = await mapLimit([1,2,3,4,5], 2, async (n) => n * 10);
    expect(out).toEqual([10,20,30,40,50]);
  });
  it("never exceeds the concurrency limit", async () => {
    let active = 0, max = 0;
    await mapLimit([1,2,3,4,5,6], 2, async () => {
      active++; max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    expect(max).toBeLessThanOrEqual(2);
  });
});
