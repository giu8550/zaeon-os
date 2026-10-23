/**
 * Cyberespaço — a CARTEIRA no inventário (out/2026, o dono: "a carteira da Solana aparece em forma de inventário, e
 * nossas moedas podem ser trocadas ou ganhas e ficam visíveis na carteira"). PURO: o catálogo dos tokens conhecidos da
 * Solana (mint → símbolo, cor, id de preço), a leitura das respostas do RPC (o SOL e as contas de token), o valor em
 * dólar e os links de troca (Jupiter) e de conferência (Solscan). A AURA (a moeda da Zaeon — lib/aura, ganha estudando)
 * entra como uma moeda da carteira, fora da rede (não se troca ainda).
 * O servidor (app/api/cyber/carteira) lê os saldos; o inventário (components/cyber/InventarioPainel) mostra.
 */

export type TokenConhecido = { mint: string; simbolo: string; nome: string; /** id no CoinGecko (preço) */ cg: string | null; cor: string; /** estável = vale US$ 1 */ estavel?: boolean };
/** o SOL nativo não tem mint de token: usa o do SOL embrulhado (é o que a Jupiter entende) */
export const MINT_SOL = "So11111111111111111111111111111111111111112";
export const TOKENS_CONHECIDOS: readonly TokenConhecido[] = [
  { mint: MINT_SOL, simbolo: "SOL", nome: "Solana", cg: "solana", cor: "#9945ff" },
  { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", simbolo: "USDC", nome: "USD Coin", cg: null, cor: "#2775ca", estavel: true },
  { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", simbolo: "USDT", nome: "Tether", cg: null, cor: "#26a17b", estavel: true },
  { mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", simbolo: "JUP", nome: "Jupiter", cg: "jupiter-exchange-solana", cor: "#c7f284" },
  { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", simbolo: "BONK", nome: "Bonk", cg: "bonk", cor: "#f7a531" },
  { mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", simbolo: "JTO", nome: "Jito", cg: "jito-governance-token", cor: "#5fd3a7" },
  { mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", simbolo: "PYTH", nome: "Pyth", cg: "pyth-network", cor: "#b38cff" },
  { mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", simbolo: "RAY", nome: "Raydium", cg: "raydium", cor: "#5ac4f6" },
  { mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", simbolo: "WIF", nome: "dogwifhat", cg: "dogwifcoin", cor: "#d9a26b" },
  { mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", simbolo: "ORCA", nome: "Orca", cg: "orca", cor: "#ffd15c" },
  { mint: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof", simbolo: "RENDER", nome: "Render", cg: "render-token", cor: "#ff5a3c" },
  { mint: "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux", simbolo: "HNT", nome: "Helium", cg: "helium", cor: "#474dff" },
  { mint: "KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS", simbolo: "KMNO", nome: "Kamino", cg: "kamino", cor: "#4f8dff" },
  { mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", simbolo: "mSOL", nome: "Marinade SOL", cg: "msol", cor: "#3ee6b8" },
  { mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", simbolo: "JitoSOL", nome: "Jito Staked SOL", cg: "jito-staked-sol", cor: "#7cf0c2" },
];
const POR_MINT = new Map(TOKENS_CONHECIDOS.map((t) => [t.mint, t]));
export const tokenDoMint = (mint: string) => POR_MINT.get(mint) ?? null;
/** os ids de preço de todos os conhecidos (pra uma busca só) */
export const IDS_DE_PRECO = TOKENS_CONHECIDOS.flatMap((t) => (t.cg ? [t.cg] : []));
export const TOKEN_PROGRAMS = ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"] as const;

/** um endereço da Solana (base58, 32–44 caracteres) */
export const enderecoValido = (s: unknown): s is string => typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
export const encurtar = (s: string) => (s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s);

export type Saldo = { mint: string; quantidade: number };
/** getBalance (lamports) → o SOL */
export function solDoSaldo(j: unknown): number | null {
  const v = (j as { result?: { value?: unknown } } | null)?.result?.value;
  return typeof v === "number" && Number.isFinite(v) ? v / 1e9 : null;
}
/** getTokenAccountsByOwner (jsonParsed) → os saldos por mint (somando contas do mesmo mint; os zerados ficam de fora) */
export function saldosDosTokens(...js: unknown[]): Saldo[] {
  const soma = new Map<string, number>();
  for (const j of js) {
    const contas = (j as { result?: { value?: unknown[] } } | null)?.result?.value;
    if (!Array.isArray(contas)) continue;
    for (const c of contas) {
      const info = (c as { account?: { data?: { parsed?: { info?: { mint?: unknown; tokenAmount?: { uiAmount?: unknown; uiAmountString?: unknown } } } } } }).account?.data?.parsed?.info;
      const mint = info?.mint, q = typeof info?.tokenAmount?.uiAmount === "number" ? info.tokenAmount.uiAmount : Number(info?.tokenAmount?.uiAmountString);
      if (typeof mint !== "string" || !Number.isFinite(q) || q <= 0) continue;
      soma.set(mint, (soma.get(mint) ?? 0) + q);
    }
  }
  return [...soma].map(([mint, quantidade]) => ({ mint, quantidade }));
}

export type Precos = Record<string, { usd: number; var24h: number | null }>;
/** /simple/price do CoinGecko → os preços por id */
export function deSimplePrice(j: unknown): Precos {
  const out: Precos = {};
  if (!j || typeof j !== "object") return out;
  for (const [id, v] of Object.entries(j as Record<string, Record<string, unknown>>)) {
    const usd = v?.usd; if (typeof usd !== "number" || !Number.isFinite(usd)) continue;
    const c = v.usd_24h_change; out[id] = { usd, var24h: typeof c === "number" && Number.isFinite(c) ? c : null };
  }
  return out;
}

/** uma MOEDA da carteira, como item do inventário */
export type MoedaCarteira = {
  id: string; simbolo: string; nome: string; cor: string; quantidade: number;
  /** null = sem preço (token desconhecido, ou a AURA) */
  usd: number | null; valor: number | null; var24h: number | null;
  /** "solana" = on-chain (dá pra trocar na Jupiter); "zaeon" = a AURA, fora da rede */
  rede: "solana" | "zaeon"; mint: string | null; conhecido: boolean;
};
/** os saldos (com o SOL) + os preços → as moedas, as de mais valor primeiro (as desconhecidas no fim) */
export function moedasDaCarteira(sol: number | null, saldos: readonly Saldo[], precos: Precos): MoedaCarteira[] {
  const todos: Saldo[] = [...(sol !== null && sol > 0 ? [{ mint: MINT_SOL, quantidade: sol }] : []), ...saldos.filter((s) => s.mint !== MINT_SOL)];
  const out = todos.map((s): MoedaCarteira => {
    const t = tokenDoMint(s.mint), p = t?.estavel ? { usd: 1, var24h: 0 } : t?.cg ? precos[t.cg] ?? null : null;
    return {
      id: `sol:${s.mint}`, simbolo: t?.simbolo ?? encurtar(s.mint), nome: t?.nome ?? "Token", cor: t?.cor ?? "#8aa0b8", quantidade: s.quantidade,
      usd: p?.usd ?? null, valor: p ? p.usd * s.quantidade : null, var24h: p?.var24h ?? null, rede: "solana", mint: s.mint, conhecido: !!t,
    };
  });
  return out.sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1) || Number(b.conhecido) - Number(a.conhecido));
}
/** a AURA como moeda da carteira */
export const moedaAura = (saldo: number): MoedaCarteira => ({ id: "zaeon:aura", simbolo: "AURA", nome: "Aura · a moeda da Zaeon", cor: "#7fe8ff", quantidade: saldo, usd: null, valor: null, var24h: null, rede: "zaeon", mint: null, conhecido: true });
/** os tokens DESCONHECIDOS (quase sempre spam de airdrop — uma carteira antiga tem centenas): mostra só os primeiros
 *  `max` e conta o resto */
export function limitarDesconhecidos(ms: readonly MoedaCarteira[], max = 6): { moedas: MoedaCarteira[]; ocultos: number } {
  let vistos = 0; const moedas = ms.filter((m) => m.conhecido || vistos++ < max);
  return { moedas, ocultos: ms.length - moedas.length };
}
export const totalEmDolar = (ms: readonly MoedaCarteira[]) => ms.reduce((s, m) => s + (m.valor ?? 0), 0);

/** TROCAR na Jupiter (abre com o par já escolhido: desta moeda pra USDC; do USDC, pra SOL) */
export const linkDeTroca = (mint: string) => `https://jup.ag/swap/${mint}-${mint === TOKENS_CONHECIDOS[1]!.mint ? MINT_SOL : TOKENS_CONHECIDOS[1]!.mint}`;
/** o explorer oficial (uma transação ou um endereço; na devnet, com o cluster) */
export const linkExplorer = (assinaturaOuEndereco: string, tipo: "tx" | "address" = "tx", rede: "devnet" | "mainnet" = "devnet") => `https://explorer.solana.com/${tipo}/${assinaturaOuEndereco}${rede === "devnet" ? "?cluster=devnet" : ""}`;
export const linkDoSolscan = (endereco: string, rede: "mainnet" | "devnet" = "mainnet") => `https://solscan.io/account/${endereco}${rede === "devnet" ? "?cluster=devnet" : ""}`;

/** quantidade no estilo do inventário: 1.234,5 · 0,0213 · 12,3 mi */
export function fmtQuantidade(q: number): string {
  if (q >= 1e9) return (q / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " bi";
  if (q >= 1e6) return (q / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " mi";
  return q.toLocaleString("pt-BR", { maximumFractionDigits: q >= 100 ? 1 : q >= 1 ? 3 : 6 });
}
export const fmtDolar = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: v >= 100 ? 0 : 2 });
