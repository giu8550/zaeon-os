/**
 * lib/solana/config.ts — env/config da camada de credenciais Solana.
 *
 * Tudo é lido de forma LAZY (função, não const de módulo) pra o app subir sem as chaves
 * (a camada degrada: sem CROSSMINT_SERVER_KEY o mint vira Credential{status:"error"} e a
 * conquista do aluno segue intacta) e pros testes poderem trocar env.
 *
 * Rede: devnet no hackathon (Crossmint staging + Helius devnet); mainnet depois — troca só de env.
 */

export type SolanaNetwork = "devnet" | "mainnet";
export type CredentialType = "skill" | "work" | "mentor-cert" | "course" | "academic";
export type CredentialStandard = "cnft" | "token2022-nt";

export const CREDENTIAL_TYPES: readonly CredentialType[] = ["skill", "work", "mentor-cert", "course", "academic"];

export function solanaNetwork(): SolanaNetwork {
  const v = (process.env.SOLANA_NETWORK || "devnet").toLowerCase();
  return v === "mainnet" || v === "mainnet-beta" ? "mainnet" : "devnet";
}

/** Crossmint: staging cobre devnet; produção cobre mainnet. */
export function crossmintBaseUrl(network: SolanaNetwork = solanaNetwork()): string {
  return network === "mainnet" ? "https://www.crossmint.com" : "https://staging.crossmint.com";
}

/** Helius RPC (DAS API) por rede. */
export function heliusRpcUrl(network: SolanaNetwork = solanaNetwork(), apiKey = process.env.HELIUS_API_KEY || ""): string {
  const host = network === "mainnet" ? "mainnet.helius-rpc.com" : "devnet.helius-rpc.com";
  return `https://${host}/?api-key=${encodeURIComponent(apiKey)}`;
}

export function crossmintServerKey(): string {
  return process.env.CROSSMINT_SERVER_KEY || "";
}

/**
 * Coleção Crossmint por padrão on-chain:
 *  - cnft         → CROSSMINT_COLLECTION_ID (Bubblegum V2 comprimida, soulbound nativo).
 *  - token2022-nt → CROSSMINT_COLLECTION_ID_NT (coleção token-2022 non-transferable, alto valor);
 *                   se não existir, cai na coleção principal com mint NÃO comprimido.
 */
export function crossmintCollectionId(standard: CredentialStandard): string {
  if (standard === "token2022-nt") return process.env.CROSSMINT_COLLECTION_ID_NT || process.env.CROSSMINT_COLLECTION_ID || "";
  return process.env.CROSSMINT_COLLECTION_ID || "";
}

/** Camada ligada? (mint real) — sem isso, issueCredential grava status:"error" e não chama rede. */
export function credentialsConfigured(): boolean {
  return Boolean(crossmintServerKey() && crossmintCollectionId("cnft"));
}

export function heliusConfigured(): boolean {
  return Boolean(process.env.HELIUS_API_KEY);
}

/** Padrão on-chain por tipo de conquista: mentor-cert = alto valor → token-2022 non-transferable. */
export function defaultStandardFor(type: CredentialType): CredentialStandard {
  return type === "mentor-cert" ? "token2022-nt" : "cnft";
}

/** Locator de destinatário da Crossmint: wallet custodial criada por e-mail, sem seed phrase/gas. */
export function recipientForEmail(email: string): string {
  return `email:${email.trim().toLowerCase()}:solana`;
}

/** URL pública base do app (badge da credencial precisa ser alcançável pela Crossmint). */
export function publicBaseUrl(): string {
  const raw = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/** Link de explorador pro asset (cNFT vive em Merkle tree → explorer mostra via DAS). */
export function explorerUrl(assetId: string, network: SolanaNetwork = solanaNetwork()): string {
  const cluster = network === "mainnet" ? "" : "?cluster=devnet";
  return `https://explorer.solana.com/address/${assetId}${cluster}`;
}

/** Portal da Crossmint onde o aluno vê/exporta a wallet custodial ("reivindicar minha carteira"). */
export function claimWalletUrl(network: SolanaNetwork = solanaNetwork()): string {
  return `${crossmintBaseUrl(network)}/user/collection`;
}
