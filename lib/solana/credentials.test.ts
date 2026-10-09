import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { issueCredential, refreshCredential, listCredentials, buildNftMetadata, type CredentialDb } from "./credentials";
import { crossmintBaseUrl, defaultStandardFor, heliusRpcUrl, recipientForEmail, explorerUrl } from "./config";
import { createCrossmintClient, normalizeOnChain } from "./crossmint";
import { createHeliusClient, parseDasAsset } from "./helius";

/** Mongo fake em memória com a semântica que a camada usa (unique userId+type+refId). */
function fakeDb(users: Record<string, any> = {}) {
  const creds: any[] = [];
  let seq = 0;
  const db: CredentialDb = {
    credential: {
      async findUnique({ where }: any) {
        if (where.id) return creds.find((c) => c.id === where.id) ?? null;
        const k = where.userId_type_refId;
        return creds.find((c) => c.userId === k.userId && c.type === k.type && c.refId === k.refId) ?? null;
      },
      async findMany({ where }: any) {
        return creds.filter((c) => Object.entries(where).every(([k, v]) => c[k] === v));
      },
      async create({ data }: any) {
        if (creds.some((c) => c.userId === data.userId && c.type === data.type && c.refId === data.refId)) {
          const e: any = new Error("Unique constraint"); e.code = "P2002"; throw e;
        }
        const rec = { id: `c${++seq}`, assetId: null, mintTx: null, crossmintId: null, crossmintActionId: null, error: null, issuedAt: null, createdAt: new Date(), ...data };
        creds.push(rec);
        return rec;
      },
      async update({ where, data }: any) {
        const rec = creds.find((c) => c.id === where.id);
        if (!rec) throw new Error("not found");
        Object.assign(rec, data);
        return rec;
      },
    },
    user: {
      async findUnique({ where }: any) { return users[where.id] ?? null; },
      async update({ where, data }: any) { Object.assign(users[where.id], data); return users[where.id]; },
    },
  };
  return { db, creds, users };
}

const ENV = { CROSSMINT_SERVER_KEY: "sk_test", CROSSMINT_COLLECTION_ID: "col_main", CROSSMINT_COLLECTION_ID_NT: "col_nt", SOLANA_NETWORK: "devnet", NEXTAUTH_URL: "https://beta.zaeon.space" };
const silent = () => {};

beforeEach(() => { for (const [k, v] of Object.entries(ENV)) process.env[k] = v; });
afterEach(() => { for (const k of Object.keys(ENV)) delete process.env[k]; delete process.env.HELIUS_API_KEY; });

describe("config", () => {
  it("recipient por e-mail (wallet custodial, sem seed phrase)", () => {
    expect(recipientForEmail(" Aluno@Zaeon.Space ")).toBe("email:aluno@zaeon.space:solana");
  });
  it("devnet → Crossmint staging + Helius devnet; mainnet → prod", () => {
    expect(crossmintBaseUrl("devnet")).toContain("staging.crossmint.com");
    expect(crossmintBaseUrl("mainnet")).toBe("https://www.crossmint.com");
    expect(heliusRpcUrl("devnet", "k")).toBe("https://devnet.helius-rpc.com/?api-key=k");
    expect(explorerUrl("abc", "devnet")).toContain("cluster=devnet");
    expect(explorerUrl("abc", "mainnet")).not.toContain("cluster");
  });
  it("mentor-cert usa token2022-nt; o resto cNFT", () => {
    expect(defaultStandardFor("mentor-cert")).toBe("token2022-nt");
    expect(defaultStandardFor("skill")).toBe("cnft");
    expect(defaultStandardFor("work")).toBe("cnft");
    expect(defaultStandardFor("course")).toBe("cnft");
  });
});

describe("buildNftMetadata", () => {
  it("monta nome/imagem/atributos sem jargão cripto no título", () => {
    const m = buildNftMetadata({ type: "skill", title: "Revisão sistemática", refId: "n1", standard: "cnft", network: "devnet", issuedAt: new Date("2026-09-09T00:00:00Z") });
    expect(m.name).toBe("Habilidade dominada: Revisão sistemática");
    expect(m.image).toBe("https://beta.zaeon.space/api/credentials/badge?type=skill&title=Revis%C3%A3o+sistem%C3%A1tica");
    expect(m.attributes).toEqual(expect.arrayContaining([{ trait_type: "Soulbound", value: "sim" }, { trait_type: "Emitida em", value: "2026-09-09" }]));
  });
  it("não leva dado pessoal pra cadeia: só o quê (título), o ponteiro (refId) e quando", () => {
    const m = buildNftMetadata({ type: "academic", title: "Mestrado em Agronomia", refId: "cred-1", standard: "cnft", network: "devnet", issuedAt: new Date("2026-09-09T00:00:00Z") });
    const tudo = JSON.stringify(m);
    expect(tudo).not.toMatch(/ por /);
    expect(tudo).not.toMatch(/@/);
    expect(m.attributes).toEqual(expect.arrayContaining([{ trait_type: "Origem", value: "cred-1" }]));
    expect(Object.keys(m).sort()).toEqual(["attributes", "description", "image", "name"]);
  });
});

describe("issueCredential", () => {
  const user = { u1: { id: "u1", email: "ana@zaeon.space", name: "Ana", solanaWallet: null } };

  it("cunha cNFT pra email:<aluno>:solana e grava minting (sem wallet do aluno)", async () => {
    const { db, creds } = fakeDb(structuredClone(user));
    const mint = vi.fn(async (_req: any) => ({ id: "nft_1", actionId: "act_1" }));
    const crossmint = { mint, getNft: vi.fn(), getAction: vi.fn() } as any;
    const rec = await issueCredential("u1", { type: "skill", refId: "node-1", title: "Revisão sistemática", metadata: { evidence: ["harness:run-1"] } }, { db, crossmint, log: silent });
    expect(rec?.status).toBe("minting");
    expect(rec?.crossmintId).toBe("nft_1");
    expect(rec?.crossmintActionId).toBe("act_1");
    expect(rec?.standard).toBe("cnft");
    expect(mint).toHaveBeenCalledTimes(1);
    const arg = mint.mock.calls[0][0] as any;
    expect(arg.recipient).toBe("email:ana@zaeon.space:solana");
    expect(arg.collectionId).toBe("col_main");
    expect(arg.compressed).toBe(true);
    expect(creds).toHaveLength(1);
    expect(creds[0].metadata).toEqual({ evidence: ["harness:run-1"] });
  });

  it("é idempotente por (userId,type,refId): não cunha 2×", async () => {
    const { db, creds } = fakeDb(structuredClone(user));
    const mint = vi.fn(async () => ({ id: "nft_1" }));
    const crossmint = { mint, getNft: vi.fn(), getAction: vi.fn() } as any;
    const a = await issueCredential("u1", { type: "work", refId: "w1", title: "TCC" }, { db, crossmint, log: silent });
    const b = await issueCredential("u1", { type: "work", refId: "w1", title: "TCC (de novo)" }, { db, crossmint, log: silent });
    expect(b?.id).toBe(a?.id);
    expect(mint).toHaveBeenCalledTimes(1);
    expect(creds).toHaveLength(1);
  });

  it("mentor-cert → token2022-nt, coleção NT, não comprimido", async () => {
    const { db } = fakeDb(structuredClone(user));
    const mint = vi.fn(async (_req: any) => ({ id: "nft_nt" }));
    const crossmint = { mint, getNft: vi.fn(), getAction: vi.fn() } as any;
    const rec = await issueCredential("u1", { type: "mentor-cert", refId: "cert-1", title: "Mentor de Metodologia" }, { db, crossmint, log: silent });
    expect(rec?.standard).toBe("token2022-nt");
    const arg = mint.mock.calls[0][0] as any;
    expect(arg.collectionId).toBe("col_nt");
    expect(arg.compressed).toBe(false);
  });

  it("falha de mint → status error, nunca lança (conquista intacta)", async () => {
    const { db } = fakeDb(structuredClone(user));
    const crossmint = { mint: vi.fn(async () => { throw new Error("Crossmint 500"); }), getNft: vi.fn(), getAction: vi.fn() } as any;
    const rec = await issueCredential("u1", { type: "course", refId: "aula-1", title: "Aula 1" }, { db, crossmint, log: silent });
    expect(rec?.status).toBe("error");
    expect(rec?.error).toContain("Crossmint 500");
  });

  it("retenta quando a anterior ficou em error (mesma linha, sem duplicar)", async () => {
    const { db, creds } = fakeDb(structuredClone(user));
    const mint = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ id: "nft_2" });
    const crossmint = { mint, getNft: vi.fn(), getAction: vi.fn() } as any;
    const a = await issueCredential("u1", { type: "course", refId: "aula-1", title: "Aula 1" }, { db, crossmint, log: silent });
    const statusA = a?.status; // o fake devolve a MESMA referência → captura antes da retentativa
    const b = await issueCredential("u1", { type: "course", refId: "aula-1", title: "Aula 1" }, { db, crossmint, log: silent });
    expect(statusA).toBe("error");
    expect(b?.status).toBe("minting");
    expect(b?.id).toBe(a?.id);
    expect(creds).toHaveLength(1);
  });

  it("sem chaves configuradas → error sem chamar a rede", async () => {
    delete process.env.CROSSMINT_SERVER_KEY;
    const { db } = fakeDb(structuredClone(user));
    const mint = vi.fn();
    const rec = await issueCredential("u1", { type: "skill", refId: "n", title: "X" }, { db, crossmint: { mint } as any, log: silent });
    expect(rec?.status).toBe("error");
    expect(rec?.error).toContain("não configurada");
    expect(mint).not.toHaveBeenCalled();
  });

  it("input inválido → null, sem gravar", async () => {
    const { db, creds } = fakeDb(structuredClone(user));
    expect(await issueCredential("u1", { type: "nope" as any, refId: "x", title: "y" }, { db, log: silent })).toBeNull();
    expect(await issueCredential("u1", { type: "skill", refId: "", title: "y" }, { db, log: silent })).toBeNull();
    expect(creds).toHaveLength(0);
  });

  it("usuário sem e-mail → error (não dá pra criar wallet custodial)", async () => {
    const { db } = fakeDb({ u1: { id: "u1", email: null } });
    const rec = await issueCredential("u1", { type: "skill", refId: "n", title: "X" }, { db, crossmint: { mint: vi.fn() } as any, log: silent });
    expect(rec?.status).toBe("error");
    expect(rec?.error).toContain("e-mail");
  });
});

describe("refreshCredential", () => {
  const user = { u1: { id: "u1", email: "ana@zaeon.space", name: "Ana", solanaWallet: null } };

  it("minting → issued com assetId/wallet/tx e cacheia User.solanaWallet", async () => {
    const { db, users } = fakeDb(structuredClone(user));
    const crossmint = {
      mint: vi.fn(async () => ({ id: "nft_1", actionId: "act_1" })),
      getNft: vi.fn(async () => ({ status: "success", mintHash: "AsSeT111", owner: "WaLLet111" })),
      getAction: vi.fn(async () => ({ status: "success", txId: "TX111" })),
    } as any;
    const rec = await issueCredential("u1", { type: "skill", refId: "n1", title: "X" }, { db, crossmint, log: silent });
    const done = await refreshCredential(rec!.id, { db, crossmint, log: silent, now: () => new Date("2026-09-09T12:00:00Z") });
    expect(done?.status).toBe("issued");
    expect(done?.assetId).toBe("AsSeT111");
    expect(done?.walletAddress).toBe("WaLLet111");
    expect(done?.mintTx).toBe("TX111");
    expect(done?.issuedAt?.toISOString()).toBe("2026-09-09T12:00:00.000Z");
    expect(users.u1.solanaWallet).toBe("WaLLet111");
  });

  it("pending continua minting; failed vira error; getNft explodindo não lança", async () => {
    const { db } = fakeDb(structuredClone(user));
    const getNft = vi.fn().mockResolvedValueOnce({ status: "pending" }).mockResolvedValueOnce({ status: "failed", error: "tree full" }).mockRejectedValueOnce(new Error("net"));
    const crossmint = { mint: vi.fn(async () => ({ id: "nft_1" })), getNft, getAction: vi.fn() } as any;
    const rec = await issueCredential("u1", { type: "skill", refId: "n1", title: "X" }, { db, crossmint, log: silent });
    expect((await refreshCredential(rec!.id, { db, crossmint, log: silent }))?.status).toBe("minting");
    expect((await refreshCredential(rec!.id, { db, crossmint, log: silent }))?.status).toBe("error");
    await db.credential.update({ where: { id: rec!.id }, data: { status: "minting" } });
    expect(await refreshCredential(rec!.id, { db, crossmint, log: silent })).toBeNull();
  });
});

describe("listCredentials (mural + Helius DAS)", () => {
  it("marca verified pela posse on-chain; sem Helius → verified null", async () => {
    const { db } = fakeDb({ u1: { id: "u1", email: "a@b.c", name: "A", solanaWallet: null } });
    await db.credential.create({ data: { userId: "u1", type: "skill", refId: "n1", title: "A", chain: "solana", standard: "cnft", network: "devnet", status: "issued", assetId: "AS1", walletAddress: "W1" } });
    await db.credential.create({ data: { userId: "u1", type: "skill", refId: "n2", title: "B", chain: "solana", standard: "cnft", network: "devnet", status: "issued", assetId: "AS2", walletAddress: "W1" } });
    await db.credential.create({ data: { userId: "u1", type: "skill", refId: "n3", title: "C", chain: "solana", standard: "cnft", network: "devnet", status: "error" } });
    const helius = { configured: true, getAssetBatch: vi.fn(async () => new Map([["AS1", { id: "AS1", owner: "W1", burnt: false, compressed: true }], ["AS2", { id: "AS2", owner: "OUTRA", burnt: false, compressed: true }]])) } as any;
    const { credentials, verification } = await listCredentials("u1", { db, helius, log: silent });
    expect(verification).toBe("helius");
    const by = Object.fromEntries(credentials.map((c) => [c.refId, c]));
    expect(by.n1.verified).toBe(true);
    expect(by.n1.explorerUrl).toContain("AS1");
    expect(by.n2.verified).toBe(false);
    expect(by.n3.verified).toBeNull();
    expect(by.n3.explorerUrl).toBeNull();

    const off = await listCredentials("u1", { db, helius: { configured: false, getAssetBatch: vi.fn() } as any, log: silent });
    expect(off.verification).toBe("unavailable");
    expect(off.credentials.every((c) => c.verified === null)).toBe(true);
  });
});

describe("crossmint client", () => {
  it("POST /collections/{id}/nfts com X-API-KEY e compressed", async () => {
    const fetchImpl = vi.fn(async (url: any, init: any) => new Response(JSON.stringify({ id: "nft_9", actionId: "act_9", onChain: { status: "pending" } }), { status: 200 })) as any;
    const c = createCrossmintClient({ apiKey: "k", network: "devnet", fetchImpl });
    const r = await c.mint({ collectionId: "col", recipient: "email:a@b.c:solana", metadata: { name: "n", image: "i" }, compressed: true });
    expect(r).toEqual({ id: "nft_9", actionId: "act_9", onChain: { status: "pending" } });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://staging.crossmint.com/api/2022-06-09/collections/col/nfts");
    expect(init.headers["X-API-KEY"]).toBe("k");
    expect(JSON.parse(init.body)).toMatchObject({ recipient: "email:a@b.c:solana", compressed: true, sendNotification: true });
  });
  it("erro HTTP vira CrossmintError com mensagem da API", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ message: "Invalid collection" }), { status: 400 })) as any;
    const c = createCrossmintClient({ apiKey: "k", fetchImpl });
    await expect(c.mint({ collectionId: "x", recipient: "r", metadata: { name: "n", image: "i" }, compressed: true })).rejects.toThrow("Invalid collection");
  });
  it("normalizeOnChain cobre os nomes que a Crossmint usa", () => {
    expect(normalizeOnChain({ status: "success", mintHash: "M", owner: "O" })).toMatchObject({ status: "success", mintHash: "M", owner: "O" });
    expect(normalizeOnChain({ status: "failed", error: "x" }).status).toBe("failed");
    expect(normalizeOnChain(undefined).status).toBe("unknown");
  });
});

describe("helius client", () => {
  it("getAssetBatch → mapa por id (ownership/burnt/compressed)", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ result: [{ id: "A", ownership: { owner: "W" }, burnt: false, compression: { compressed: true }, content: { metadata: { name: "N" } } }, null] }))) as any;
    const h = createHeliusClient({ apiKey: "k", network: "devnet", fetchImpl });
    const m = await h.getAssetBatch(["A", "A", "B"]);
    expect(m.get("A")).toMatchObject({ owner: "W", burnt: false, compressed: true, name: "N" });
    expect(m.has("B")).toBe(false);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).params.ids).toEqual(["A", "B"]);
  });
  it("sem api key → vazio sem rede", async () => {
    const fetchImpl = vi.fn();
    const h = createHeliusClient({ apiKey: "", fetchImpl });
    expect((await h.getAssetBatch(["A"])).size).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(parseDasAsset(null)).toBeNull();
  });
});
