/**
 * Os PREÇOS das moedas da Solana no servidor (só servidor): o CoinGecko /simple/price dos tokens conhecidos
 * (lib/cyber/carteira `IDS_DE_PRECO`), guardados 1 min — pra carteira do inventário e pro cofre. Se cair, fica o último.
 */
import { IDS_DE_PRECO, deSimplePrice, type Precos } from "./carteira";

const PRECOS_MS = 60_000;
let cache: { em: number; p: Precos } | null = null;

export async function precosDaSolana(): Promise<Precos> {
  if (cache && Date.now() - cache.em < PRECOS_MS) return cache.p;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
  let p: Precos = {};
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${IDS_DE_PRECO.join(",")}&vs_currencies=usd&include_24hr_change=true`, { signal: ctl.signal, cache: "no-store" });
    if (r.ok) p = deSimplePrice(await r.json());
  } catch { /* fica o último */ }
  finally { clearTimeout(t); }
  if (Object.keys(p).length || !cache) cache = { em: Date.now(), p };
  return cache.p;
}
