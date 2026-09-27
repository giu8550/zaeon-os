/**
 * lib/solana/crossmint.ts — cliente mínimo da Minting API da Crossmint (2022-06-09).
 *
 * Por que Crossmint: `recipient: "email:<aluno>:solana"` cria a wallet custodial na hora
 * (sem seed phrase), o mint é gasless (fee-payer deles) e cNFT (Bubblegum) é barato em escala.
 * É o que torna o web3 INVISÍVEL pro aluno. Só `fetch` — sem SDK (menos superfície no build).
 */
import { crossmintBaseUrl, crossmintServerKey, type SolanaNetwork, solanaNetwork } from "./config";

export type NftMetadata = {
  name: string;
  image: string;
  description?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
};

export type MintRequest = {
  collectionId: string;
  recipient: string;      // "email:<email>:solana" | "solana:<address>"
  metadata: NftMetadata;
  compressed: boolean;    // true = cNFT (Bubblegum); false = NFT regular/token-2022 (coleção decide)
  sendNotification?: boolean;
};

export type MintResponse = { id: string; actionId?: string; onChain?: { status?: string; chain?: string } };

export type OnChainStatus = {
  status: "pending" | "success" | "failed" | "unknown";
  mintHash?: string;   // Solana: mint/asset id
  owner?: string;      // wallet custodial do aluno
  txId?: string;
  error?: string;
};

export type FetchLike = typeof fetch;

export class CrossmintError extends Error {
  constructor(message: string, public readonly status?: number, public readonly body?: unknown) {
    super(message);
    this.name = "CrossmintError";
  }
}

function headers(apiKey: string) {
  return { "X-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" };
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text().catch(() => "");
  try { return text ? JSON.parse(text) : {}; } catch { return { raw: text }; }
}

export function createCrossmintClient(opts: { apiKey?: string; network?: SolanaNetwork; fetchImpl?: FetchLike } = {}) {
  const apiKey = opts.apiKey ?? crossmintServerKey();
  const network = opts.network ?? solanaNetwork();
  const base = `${crossmintBaseUrl(network)}/api/2022-06-09`;
  const f: FetchLike = opts.fetchImpl ?? fetch;

  return {
    network,
    /** POST /collections/{id}/nfts — cunha (ou enfileira) o NFT pro destinatário. */
    async mint(req: MintRequest): Promise<MintResponse> {
      if (!apiKey) throw new CrossmintError("CROSSMINT_SERVER_KEY ausente");
      const res = await f(`${base}/collections/${encodeURIComponent(req.collectionId)}/nfts`, {
        method: "POST",
        headers: headers(apiKey),
        body: JSON.stringify({
          recipient: req.recipient,
          metadata: req.metadata,
          compressed: req.compressed,
          reuploadLinkedFiles: true,
          sendNotification: req.sendNotification ?? true,
          locale: "pt-BR",
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new CrossmintError(body?.message || body?.error || `Crossmint mint HTTP ${res.status}`, res.status, body);
      if (!body?.id) throw new CrossmintError("Crossmint mint sem id na resposta", res.status, body);
      return { id: String(body.id), actionId: body.actionId ? String(body.actionId) : undefined, onChain: body.onChain };
    },

    /** GET /collections/{id}/nfts/{nftId} — status on-chain (mintHash = assetId; owner = wallet). */
    async getNft(collectionId: string, nftId: string): Promise<OnChainStatus> {
      if (!apiKey) throw new CrossmintError("CROSSMINT_SERVER_KEY ausente");
      const res = await f(`${base}/collections/${encodeURIComponent(collectionId)}/nfts/${encodeURIComponent(nftId)}`, {
        headers: headers(apiKey),
      });
      const body = await readJson(res);
      if (!res.ok) throw new CrossmintError(body?.message || `Crossmint getNft HTTP ${res.status}`, res.status, body);
      return normalizeOnChain(body?.onChain, body);
    },

    /** GET /actions/{actionId} — polling alternativo (traz txId quando existe). */
    async getAction(actionId: string): Promise<OnChainStatus> {
      if (!apiKey) throw new CrossmintError("CROSSMINT_SERVER_KEY ausente");
      const res = await f(`${base}/actions/${encodeURIComponent(actionId)}`, { headers: headers(apiKey) });
      const body = await readJson(res);
      if (!res.ok) throw new CrossmintError(body?.message || `Crossmint getAction HTTP ${res.status}`, res.status, body);
      const st = String(body?.status || "").toLowerCase();
      const data = body?.data || {};
      return {
        status: st === "succeeded" || st === "success" ? "success" : st === "failed" ? "failed" : st === "pending" ? "pending" : "unknown",
        mintHash: data.mintHash || data.token?.mintHash || undefined,
        owner: data.owner || data.recipient?.walletAddress || undefined,
        txId: data.txId || data.transactionId || undefined,
        error: body?.error || data?.error || undefined,
      };
    },
  };
}

export type CrossmintClient = ReturnType<typeof createCrossmintClient>;

/** Normaliza o `onChain` da Crossmint (nomes variam levemente entre chains/versões). */
export function normalizeOnChain(onChain: any, whole?: any): OnChainStatus {
  const st = String(onChain?.status || "").toLowerCase();
  return {
    status: st === "success" || st === "succeeded" ? "success" : st === "failed" || st === "error" ? "failed" : st === "pending" ? "pending" : "unknown",
    mintHash: onChain?.mintHash || onChain?.tokenId || onChain?.assetId || undefined,
    owner: onChain?.owner || undefined,
    txId: onChain?.txId || onChain?.transactionId || whole?.txId || undefined,
    error: onChain?.error || whole?.error || undefined,
  };
}
