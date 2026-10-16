/**
 * GET /api/cyber/terra — a Terra AO VIVO dos telões dos Mirantes (lib/cyber/terraAoVivo): terremotos (USGS) +
 * incêndios, tempestades, vulcões e gelo (NASA EONET), normalizados e juntados. Público (são dados públicos, sem
 * chave) e barato: o servidor guarda a última busca por 10 min (e o CDN também); se uma fonte cair, vai a outra; se
 * as duas caírem, serve a última boa.
 */
import { NextResponse } from "next/server";
import { CACHE_MS, FONTES, deEONET, deUSGS, juntarEventos, type EventoTerra } from "@/lib/cyber/terraAoVivo";

let cache: { em: number; eventos: EventoTerra[] } | null = null;

async function buscar(url: string): Promise<unknown> {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
  try { const r = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json" }, cache: "no-store" }); return r.ok ? await r.json() : null; }
  catch { return null; }
  finally { clearTimeout(t); }
}

export async function GET() {
  if (!cache || Date.now() - cache.em > CACHE_MS) {
    const [u, e] = await Promise.all([buscar(FONTES.usgs), buscar(FONTES.eonet)]);
    const eventos = juntarEventos(deUSGS(u), deEONET(e));
    if (eventos.length || !cache) cache = { em: Date.now(), eventos };
  }
  return NextResponse.json({ atualizadoEm: cache.em, eventos: cache.eventos, fontes: ["USGS", "NASA EONET"] }, { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=1200" } });
}
