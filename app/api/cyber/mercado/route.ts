/**
 * GET /api/cyber/mercado — o MERCADO AO VIVO dos telões do campus de TI (lib/cyber/mercado; a busca e o cache de 1 min
 * em lib/cyber/mercadoServidor): as maiores moedas, a Solana e o ecossistema dela, o mercado global, medo e ganância, a
 * rede do Bitcoin e a da Solana. Público (dados públicos, sem chave) e barato (o CDN também guarda 1 min).
 */
import { NextResponse } from "next/server";
import { painelDoMercado } from "@/lib/cyber/mercadoServidor";

export async function GET() {
  return NextResponse.json(await painelDoMercado(), { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=120" } });
}
