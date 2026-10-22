/**
 * Cyberespaço — o MERCADO AO VIVO dos telões do campus de TI (out/2026, o dono: "aqui não vai ser apenas nosso
 * epicentro de TI, mas financeiro — na ponte inicial, os telões são de observação do mercado: 2 na esquerda, um
 * dashboard só pra Solana e outro pras outras moedas, e um na direita com métricas da blockchain, algo como Bloomberg").
 * PURO: as fontes (públicas, sem chave) e a normalização de cada uma; o servidor (app/api/cyber/mercado) busca, junta e
 * guarda; o render (components/cyber/TeloesMercado) desenha.
 *  - CoinGecko: as maiores moedas (com o gráfico de 7 dias), os tokens do ecossistema Solana e o mercado global;
 *  - alternative.me: o índice de medo e ganância;
 *  - mempool.space: a altura do bloco do Bitcoin e as taxas;
 *  - RPC da Solana: as transações por segundo e a época.
 */

/** de quanto em quanto tempo o servidor busca de novo (ms) — o CoinGecko grátis aguenta ~30 chamadas/min */
export const CACHE_MERCADO_MS = 60_000;
/** os tokens NATIVOS da Solana do telão dela (ids do CoinGecko — a categoria do ecossistema vem cheia de stablecoin) */
export const TOKENS_SOLANA = ["jupiter-exchange-solana", "render-token", "pyth-network", "raydium", "bonk", "jito-governance-token", "kamino", "dogwifcoin", "orca", "helium"] as const;
export const FONTES_MERCADO = {
  moedas: "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&sparkline=true&price_change_percentage=24h,7d",
  solana: `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=solana,${TOKENS_SOLANA.join(",")}&sparkline=true&price_change_percentage=24h,7d`,
  global: "https://api.coingecko.com/api/v3/global",
  medo: "https://api.alternative.me/fng/?limit=1",
  taxasBtc: "https://mempool.space/api/v1/fees/recommended",
  alturaBtc: "https://mempool.space/api/blocks/tip/height",
  rpcSolana: "https://api.mainnet-beta.solana.com",
} as const;

export type Moeda = {
  id: string; simbolo: string; nome: string; rank: number | null;
  preco: number; var24h: number | null; var7d: number | null; capitalizacao: number; volume: number;
  /** o preço nos últimos 7 dias (amostrado — no máximo 56 pontos) */
  serie: number[];
};
export type Global = { capitalizacao: number; volume: number; var24h: number; domBtc: number; domEth: number; moedasAtivas: number };
export type RedeSolana = { tps: number; slot: number; epoca: number; progressoEpoca: number; transacoes: number };
export type RedeBitcoin = { altura: number; taxaRapida: number; taxaMeiaHora: number; taxaHora: number };
export type PainelMercado = {
  atualizadoEm: number;
  moedas: Moeda[]; solana: Moeda | null; tokensSolana: Moeda[];
  global: Global | null; medo: { valor: number; rotulo: string } | null;
  redeSolana: RedeSolana | null; redeBitcoin: RedeBitcoin | null;
  fontes: string[];
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
/** reduz uma série a no máximo `n` pontos (pega a cada k) — o telão não precisa de 168 */
export function amostrar(xs: readonly number[], n = 56): number[] {
  const ok = xs.filter((x) => Number.isFinite(x));
  if (ok.length <= n) return ok;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(ok[Math.round((i * (ok.length - 1)) / (n - 1))]!);
  return out;
}

/** /coins/markets → as moedas (as que vieram sem preço ficam de fora) */
export function deMercados(j: unknown): Moeda[] {
  if (!Array.isArray(j)) return [];
  return j.flatMap((x): Moeda[] => {
    const o = x as Record<string, unknown>, preco = num(o.current_price);
    if (preco === null || typeof o.id !== "string") return [];
    const sp = (o.sparkline_in_7d as { price?: unknown } | undefined)?.price;
    return [{
      id: o.id, simbolo: String(o.symbol ?? "").toUpperCase(), nome: String(o.name ?? o.id), rank: num(o.market_cap_rank),
      preco, var24h: num(o.price_change_percentage_24h_in_currency) ?? num(o.price_change_percentage_24h), var7d: num(o.price_change_percentage_7d_in_currency),
      capitalizacao: num(o.market_cap) ?? 0, volume: num(o.total_volume) ?? 0,
      serie: Array.isArray(sp) ? amostrar(sp.map((p) => num(p) ?? NaN)) : [],
    }];
  });
}
/** as moedas do telão "outras moedas": sem as stablecoins e os embrulhados (ninguém olha o USDT a 1,00) */
const NAO_MOSTRA = /^(usdt|usdc|usds|usde|dai|fdusd|tusd|pyusd|usd1|usdg|busd|steth|wsteth|wbtc|weth|cbbtc|weeth|wbeth|jitosol|msol|bnsol|susde|bsc-usd|buidl|usdtb|syrupusdc|figr_heloc)$/i;
export const semEstaveis = (ms: readonly Moeda[]) => ms.filter((m) => !NAO_MOSTRA.test(m.simbolo));

export function deGlobal(j: unknown): Global | null {
  const d = (j as { data?: Record<string, unknown> } | null)?.data; if (!d) return null;
  const cap = num((d.total_market_cap as Record<string, unknown> | undefined)?.usd), vol = num((d.total_volume as Record<string, unknown> | undefined)?.usd);
  const dom = (d.market_cap_percentage ?? {}) as Record<string, unknown>;
  if (cap === null) return null;
  return { capitalizacao: cap, volume: vol ?? 0, var24h: num(d.market_cap_change_percentage_24h_usd) ?? 0, domBtc: num(dom.btc) ?? 0, domEth: num(dom.eth) ?? 0, moedasAtivas: num(d.active_cryptocurrencies) ?? 0 };
}
export function deMedo(j: unknown): { valor: number; rotulo: string } | null {
  const d = (j as { data?: Record<string, unknown>[] } | null)?.data?.[0], v = num(d?.value);
  return d && v !== null ? { valor: v, rotulo: ROTULO_MEDO[String(d.value_classification)] ?? String(d.value_classification) } : null;
}
const ROTULO_MEDO: Record<string, string> = { "Extreme Fear": "MEDO EXTREMO", Fear: "MEDO", Neutral: "NEUTRO", Greed: "GANÂNCIA", "Extreme Greed": "GANÂNCIA EXTREMA" };
export function deBitcoin(taxas: unknown, altura: unknown): RedeBitcoin | null {
  const t = (taxas ?? {}) as Record<string, unknown>, h = num(altura);
  if (h === null) return null;
  return { altura: h, taxaRapida: num(t.fastestFee) ?? 0, taxaMeiaHora: num(t.halfHourFee) ?? 0, taxaHora: num(t.hourFee) ?? 0 };
}
/** getRecentPerformanceSamples + getEpochInfo → a rede da Solana (TPS = as transações de usuário — sem os votos) */
export function deSolana(amostras: unknown, epoca: unknown): RedeSolana | null {
  const a = (amostras as { result?: Record<string, unknown>[] } | null)?.result, e = (epoca as { result?: Record<string, unknown> } | null)?.result;
  if (!Array.isArray(a) || !a.length || !e) return null;
  let tx = 0, s = 0; for (const x of a) { tx += num(x.numNonVoteTransactions) ?? num(x.numTransactions) ?? 0; s += num(x.samplePeriodSecs) ?? 0; }
  const idx = num(e.slotIndex) ?? 0, tam = num(e.slotsInEpoch) ?? 1;
  return { tps: s > 0 ? tx / s : 0, slot: num(e.absoluteSlot) ?? 0, epoca: num(e.epoch) ?? 0, progressoEpoca: Math.max(0, Math.min(1, idx / tam)), transacoes: num(e.transactionCount) ?? 0 };
}

/** junta tudo (o que caiu fica null/vazio — o telão mostra "sem sinal" naquele bloco) */
export function montarPainel(o: { moedas: unknown; solana: unknown; global: unknown; medo: unknown; taxasBtc: unknown; alturaBtc: unknown; amostrasSol: unknown; epocaSol: unknown }, agora = Date.now()): PainelMercado {
  const sol = deMercados(o.solana), solana = sol.find((m) => m.id === "solana") ?? null;
  const ordem = new Map<string, number>(TOKENS_SOLANA.map((id, k) => [id, k]));
  return {
    atualizadoEm: agora,
    moedas: semEstaveis(deMercados(o.moedas)).slice(0, 14),
    solana, tokensSolana: sol.filter((m) => m.id !== "solana").sort((a, b) => (b.capitalizacao - a.capitalizacao) || ((ordem.get(a.id) ?? 99) - (ordem.get(b.id) ?? 99))),
    global: deGlobal(o.global), medo: deMedo(o.medo), redeSolana: deSolana(o.amostrasSol, o.epocaSol), redeBitcoin: deBitcoin(o.taxasBtc, o.alturaBtc),
    fontes: ["CoinGecko", "alternative.me", "mempool.space", "Solana RPC"],
  };
}
/** tem alguma coisa pra mostrar? (senão o servidor serve a última boa) */
export const painelTemDados = (p: PainelMercado) => p.moedas.length > 0 || p.solana !== null || p.global !== null;

// ── a FORMATAÇÃO do telão (estilo terminal: curto e alinhado) ──
/** $ 81.263 · $ 0,000021 · $ 1,23 — preço em dólar com as casas que fazem sentido */
export function fmtPreco(v: number): string {
  const casas = v >= 1000 ? 0 : v >= 1 ? 2 : v >= 0.01 ? 4 : 8;
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
/** 2,74T · 81,1B · 950M */
export function fmtGrande(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return "$" + (v / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return "$" + (v / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return "$" + (v / 1e6).toFixed(0) + "M";
  return "$" + Math.round(v).toLocaleString("en-US");
}
export const fmtVar = (v: number | null) => (v === null ? "—" : (v >= 0 ? "▲ +" : "▼ ") + v.toFixed(2) + "%");
