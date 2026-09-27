import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ensureCustodialWallet, walletLocator } from "./wallet";

const ENV = { CROSSMINT_SERVER_KEY: "sk_test", SOLANA_NETWORK: "devnet" };
beforeEach(() => { for (const [k, v] of Object.entries(ENV)) process.env[k] = v; });
afterEach(() => { for (const k of Object.keys(ENV)) delete process.env[k]; });

/** fetch falso: devolve o par (status, body) combinado e guarda a chamada pra inspeção. */
function fakeFetch(status: number, body: any) {
  const calls: any[] = [];
  const f = (async (url: any, init: any) => {
    calls.push({ url: String(url), init });
    return { ok: status < 400, status, json: async () => body } as any;
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe("wallet custodial (invisível)", () => {
  it("locator é o mesmo do mint: email:<aluno>:solana", () => {
    expect(walletLocator(" Aluno@Zaeon.Space ".trim())).toBe("email:aluno@zaeon.space:solana");
  });

  it("cria a wallet no 1º login e devolve o endereço", async () => {
    const { f, calls } = fakeFetch(201, { address: "So1aNaAddr111" });
    const r = await ensureCustodialWallet("Aluno@Zaeon.Space", { fetchImpl: f });
    expect(r.address).toBe("So1aNaAddr111");
    expect(calls[0].url).toContain("/api/v1-alpha2/wallets");
    // e-mail sempre normalizado — senão a Crossmint cria DUAS wallets pro mesmo aluno
    expect(JSON.parse(calls[0].init.body).linkedUser).toBe("email:aluno@zaeon.space");
  });

  it("409 (já existia) não é erro — a mesma wallet volta", async () => {
    const { f } = fakeFetch(409, { address: "So1aNaAddr111" });
    expect((await ensureCustodialWallet("aluno@zaeon.space", { fetchImpl: f })).address).toBe("So1aNaAddr111");
  });

  it("sem chave da Crossmint, degrada em silêncio (login NÃO quebra)", async () => {
    delete process.env.CROSSMINT_SERVER_KEY;
    const r = await ensureCustodialWallet("aluno@zaeon.space");
    expect(r.address).toBeNull();
    expect(r.reason).toMatch(/CROSSMINT_SERVER_KEY/);
  });

  it("API fora do ar vira null com motivo, nunca exceção", async () => {
    const f = (async () => { throw new Error("ECONNRESET"); }) as unknown as typeof fetch;
    const r = await ensureCustodialWallet("aluno@zaeon.space", { fetchImpl: f });
    expect(r.address).toBeNull();
    expect(r.reason).toContain("ECONNRESET");
  });

  it("500 da Crossmint não inventa endereço", async () => {
    const { f } = fakeFetch(500, { message: "boom" });
    const r = await ensureCustodialWallet("aluno@zaeon.space", { fetchImpl: f });
    expect(r.address).toBeNull();
    expect(r.reason).toBe("crossmint 500");
  });
});
