/**
 * GET /api/cyber/carteira[?endereco=…] → a CARTEIRA do inventário (lib/cyber/carteira): a AURA da pessoa (o saldo da
 * moeda da Zaeon, ganha estudando) e as moedas on-chain de cada carteira dela — a que ela CONECTOU agora (Phantom,
 * Solflare: `endereco`, sempre na mainnet) e a da ZAEON (a carteira que a plataforma provisionou no login,
 * `User.solanaWallet`, na rede configurada). Só leitura: saldos públicos + preços (CoinGecko). Os preços ficam 1 min
 * no servidor e os saldos de cada endereço, 30 s.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { entrarNoBoard } from "@/lib/estudos/rota";
import { heliusRpcUrl, solanaNetwork, type SolanaNetwork } from "@/lib/solana/config";
import { IDS_DE_PRECO, TOKEN_PROGRAMS, limitarDesconhecidos, deSimplePrice, enderecoValido, moedaAura, moedasDaCarteira, saldosDosTokens, solDoSaldo, totalEmDolar, type MoedaCarteira, type Precos } from "@/lib/cyber/carteira";

const PRECOS_MS = 60_000, SALDOS_MS = 30_000;
let precos: { em: number; p: Precos } | null = null;
const saldos = new Map<string, { em: number; moedas: MoedaCarteira[] }>();

async function buscar(url: string, corpo?: unknown): Promise<unknown> {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: "no-store", ...(corpo ? { method: "POST", body: JSON.stringify(corpo), headers: { "content-type": "application/json" } } : {}) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
  finally { clearTimeout(t); }
}
const rpcUrl = (rede: SolanaNetwork) => (process.env.HELIUS_API_KEY ? heliusRpcUrl(rede) : rede === "mainnet" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");

async function lerPrecos(): Promise<Precos> {
  if (precos && Date.now() - precos.em < PRECOS_MS) return precos.p;
  const p = deSimplePrice(await buscar(`https://api.coingecko.com/api/v3/simple/price?ids=${IDS_DE_PRECO.join(",")}&vs_currencies=usd&include_24hr_change=true`));
  if (Object.keys(p).length || !precos) precos = { em: Date.now(), p };
  return precos.p;
}
async function lerCarteira(endereco: string, rede: SolanaNetwork): Promise<MoedaCarteira[]> {
  const k = `${rede}:${endereco}`, c = saldos.get(k);
  if (c && Date.now() - c.em < SALDOS_MS) return c.moedas;
  const url = rpcUrl(rede), rpc = (method: string, params: unknown[]) => buscar(url, { jsonrpc: "2.0", id: 1, method, params });
  const [sol, t1, t2, p] = await Promise.all([
    rpc("getBalance", [endereco]),
    ...TOKEN_PROGRAMS.map((programId) => rpc("getTokenAccountsByOwner", [endereco, { programId }, { encoding: "jsonParsed" }])),
    lerPrecos(),
  ]);
  const moedas = moedasDaCarteira(solDoSaldo(sol), saldosDosTokens(t1, t2), p as Precos);
  saldos.set(k, { em: Date.now(), moedas }); if (saldos.size > 500) saldos.delete(saldos.keys().next().value!);
  return moedas;
}

export async function GET(req: Request) {
  const a = await entrarNoBoard(req, "cyber-carteira"); if ("response" in a) return a.response;
  const conectado = new URL(req.url).searchParams.get("endereco");
  if (conectado !== null && !enderecoValido(conectado)) return NextResponse.json({ error: "Endereço inválido" }, { status: 400 });
  const u = await prisma.user.findUnique({ where: { id: a.userId }, select: { aura: true, solanaWallet: true } }).catch(() => null);
  const redeZaeon = solanaNetwork();
  const [doConectado, daZaeon] = await Promise.all([
    conectado ? lerCarteira(conectado, "mainnet") : Promise.resolve(null),
    u?.solanaWallet && enderecoValido(u.solanaWallet) && u.solanaWallet !== conectado ? lerCarteira(u.solanaWallet, redeZaeon) : Promise.resolve(null),
  ]);
  const carteiras = [
    ...(conectado && doConectado ? [{ tipo: "conectada" as const, endereco: conectado, rede: "mainnet" as const, ...limitarDesconhecidos(doConectado), total: totalEmDolar(doConectado) }] : []),
    ...(u?.solanaWallet && daZaeon ? [{ tipo: "zaeon" as const, endereco: u.solanaWallet, rede: redeZaeon, ...limitarDesconhecidos(daZaeon), total: totalEmDolar(daZaeon) }] : []),
  ];
  return NextResponse.json({ aura: moedaAura(u?.aura ?? 0), carteiras, atualizadoEm: Date.now() }, { headers: { "cache-control": "private, no-store" } });
}
