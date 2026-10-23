/**
 * O MERCADO AO VIVO no servidor (só servidor): busca as fontes (lib/cyber/mercado), junta e guarda 1 min — o mesmo
 * painel pros telões (app/api/cyber/mercado) e pros agentes de trading (app/api/cyber/agente-trading). Se uma fonte
 * cai, o bloco dela fica vazio; se tudo cai, fica a última boa.
 */
import { CACHE_MERCADO_MS, FONTES_MERCADO as F, montarPainel, painelTemDados, type PainelMercado } from "./mercado";

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

/** o painel de agora (busca de novo se passou de 1 min; quem chega junto espera a mesma busca) */
export async function painelDoMercado(): Promise<PainelMercado> {
  if (!cache || Date.now() - cache.atualizadoEm > CACHE_MERCADO_MS) { buscando ??= atualizar().finally(() => { buscando = null; }); await buscando; }
  return cache!;
}
