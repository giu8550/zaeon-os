/**
 * lib/solana/wallet.ts — carteira custodial INVISÍVEL (Crossmint Wallets API).
 *
 * Por quê: a promessa do produto é web3 sem o aluno saber. No 1º login criamos a wallet
 * custodial dele a partir do e-mail (sem seed phrase, sem extensão, sem gas) e guardamos o
 * endereço em User.solanaWallet — assim a 1ª conquista já cunha direto, sem espera.
 *
 * Degrada em silêncio, SEMPRE: sem CROSSMINT_SERVER_KEY, ou se a API falhar, devolve null e
 * o login segue normal (mesma filosofia de lib/solana/credentials.ts). Nunca lança pra fora.
 */
import { crossmintBaseUrl, crossmintServerKey, type SolanaNetwork, solanaNetwork } from "./config";

export type EnsureWalletResult = { address: string | null; reason?: string };

/** `email:<aluno>:solana` é o mesmo locator usado no mint (lib/solana/crossmint.ts). */
export function walletLocator(email: string): string {
  return `email:${email.toLowerCase()}:solana`;
}

/**
 * Cria (ou recupera, se já existir) a wallet custodial do aluno.
 * Idempotente do lado da Crossmint: o mesmo locator devolve a mesma wallet.
 */
export async function ensureCustodialWallet(
  email: string,
  opts: { apiKey?: string; network?: SolanaNetwork; fetchImpl?: typeof fetch } = {},
): Promise<EnsureWalletResult> {
  const apiKey = opts.apiKey ?? crossmintServerKey();
  if (!apiKey) return { address: null, reason: "sem CROSSMINT_SERVER_KEY" };
  if (!email) return { address: null, reason: "sem e-mail" };

  const network = opts.network ?? solanaNetwork();
  const f = opts.fetchImpl ?? fetch;
  const url = `${crossmintBaseUrl(network)}/api/v1-alpha2/wallets`;

  try {
    const res = await f(url, {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ type: "solana-custodial-wallet", linkedUser: `email:${email.toLowerCase()}` }),
    });
    const body: any = await res.json().catch(() => ({}));
    // 200/201 = criada agora; 409 = já existia (idempotente) — ambos trazem/permitem o address.
    const address: string | undefined = body?.address || body?.publicKey || body?.wallet?.address;
    if (!res.ok && res.status !== 409) return { address: null, reason: `crossmint ${res.status}` };
    return { address: address ?? null, reason: address ? undefined : "resposta sem address" };
  } catch (e: any) {
    return { address: null, reason: String(e?.message ?? e) };
  }
}
