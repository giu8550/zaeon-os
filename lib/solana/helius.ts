/**
 * lib/solana/helius.ts — leitura on-chain via Helius DAS API (getAssetBatch).
 *
 * cNFT vive em Merkle tree → NÃO dá pra "ler a conta" direto: verificar posse exige um
 * indexer DAS. Usado pelo mural (GET /api/credentials) pra confirmar que a credencial existe
 * e está na wallet do aluno. Sem HELIUS_API_KEY a verificação degrada (retorna vazio).
 */
import { heliusConfigured, heliusRpcUrl, type SolanaNetwork, solanaNetwork } from "./config";
import type { FetchLike } from "./crossmint";

export type DasAsset = {
  id: string;
  owner?: string;
  name?: string;
  burnt: boolean;
  compressed: boolean;
  /** cNFT Bubblegum V2 soulbound / token-2022 non-transferable → true quando o DAS expõe. */
  nonTransferable?: boolean;
};

export function createHeliusClient(opts: { apiKey?: string; network?: SolanaNetwork; fetchImpl?: FetchLike } = {}) {
  const apiKey = opts.apiKey ?? process.env.HELIUS_API_KEY ?? "";
  const network = opts.network ?? solanaNetwork();
  const f: FetchLike = opts.fetchImpl ?? fetch;
  const url = heliusRpcUrl(network, apiKey);

  return {
    configured: Boolean(apiKey),
    /** Busca até 1000 assets por id. Ids desconhecidos ficam de fora do mapa. */
    async getAssetBatch(ids: string[]): Promise<Map<string, DasAsset>> {
      const out = new Map<string, DasAsset>();
      const clean = Array.from(new Set(ids.filter(Boolean)));
      if (!clean.length || !apiKey) return out;
      const res = await f(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "zaeon-credentials", method: "getAssetBatch", params: { ids: clean } }),
      });
      if (!res.ok) throw new Error(`Helius DAS HTTP ${res.status}`);
      const body: any = await res.json().catch(() => ({}));
      if (body?.error) throw new Error(`Helius DAS: ${body.error?.message || JSON.stringify(body.error)}`);
      const list: any[] = Array.isArray(body?.result) ? body.result : [];
      for (const a of list) {
        const parsed = parseDasAsset(a);
        if (parsed) out.set(parsed.id, parsed);
      }
      return out;
    },
  };
}

export function parseDasAsset(a: any): DasAsset | null {
  if (!a || typeof a !== "object" || !a.id) return null;
  return {
    id: String(a.id),
    owner: a.ownership?.owner ? String(a.ownership.owner) : undefined,
    name: a.content?.metadata?.name ? String(a.content.metadata.name) : undefined,
    burnt: Boolean(a.burnt),
    compressed: Boolean(a.compression?.compressed),
    nonTransferable: a.ownership?.non_transferable ?? a.ownership?.nonTransferable ?? (a.token_info?.extensions?.some?.((e: any) => e?.extension === "nonTransferable") || undefined),
  };
}

export const heliusReady = heliusConfigured;
