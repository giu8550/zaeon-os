/**
 * GET /api/cyber/mercado — o MERCADO AO VIVO dos telões do campus de TI (lib/cyber/mercado): as maiores moedas, a
 * Solana e o ecossistema dela, o mercado global, medo e ganância, a rede do Bitcoin e a da Solana. Público (dados
 * públicos, sem chave) e barato: o servidor guarda a última busca por 1 min (e o CDN também); se uma fonte cair, o
 * bloco dela fica vazio; se tudo cair, serve a última boa.
 */
import { NextResponse } from "next/server";
import { CACHE_MERCADO_MS, FONTES_MERCADO as F, montarPainel, painelTemDados, type PainelMercado } from "@/lib/cyber/mercado";

let cache: PainelMercado | null = null;
let buscando: Promise<void> | null = null;

async function buscar(url: string, corpo?: unknown): Promise<unknown> {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: "no-store", ...(corpo ? { method: "POST", body: JSON.stringify(corpo), headers: { "content-type": "application/json", accept: "application/json" } } : { headers: { accept: "application/json" } }) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
  finally { clearTimeout(t); }
}
const rpc = (method: string, params: unknown[] = []) => buscar(F.rpcSolana, { jsonrpc: "2.0", id: 1, method, params });

async function atualizar() {
  const [moedas, solana, global, medo, taxasBtc, alturaBtc, amostrasSol, epocaSol] = await Promise.all([
    buscar(F.moedas), buscar(F.solana), buscar(F.global), buscar(F.medo), buscar(F.taxasBtc), buscar(F.alturaBtc), rpc("getRecentPerformanceSamples", [4]), rpc("getEpochInfo"),
  ]);
  const p = montarPainel({ moedas, solana, global, medo, taxasBtc, alturaBtc, amostrasSol, epocaSol });
  if (painelTemDados(p) || !cache) cache = p;
}

export async function GET() {
  if (!cache || Date.now() - cache.atualizadoEm > CACHE_MERCADO_MS) { buscando ??= atualizar().finally(() => { buscando = null; }); await buscando; }
  return NextResponse.json(cache, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=120" } });
}
