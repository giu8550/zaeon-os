/**
 * /api/cyber/frota — a FROTA DE IAs do cyberespaço (lib/cyber/frota).
 *  GET: a config (lotes + chaves ON/OFF + versão) e o relógio do servidor (`agora`): com isso todo cliente calcula a
 *       mesma frota, no mesmo lugar, fazendo a mesma coisa — sem rede pros 700 "jogadores".
 *  PUT: grava a config (só o dono — o painel "Deploy agents" do Modo CEO).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { ehAdminDoMapa } from "@/lib/cyber/adminMapa";
import { NextResponse } from "next/server";
import { lerConfig, salvarConfig } from "@/lib/cyber/frota/servidor";
import { sanitizarConfig } from "@/lib/cyber/frota/config";

export async function GET() {
  const config = await lerConfig();
  return NextResponse.json({ config, agora: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request) {
  const { assertAdmin } = await import("@/lib/admin/assertAdmin");   // (tardio: o GET público não depende do auth/banco)
  const a = await assertAdmin(); if (!a.ok) return NextResponse.json({ error: "forbidden" }, { status: a.status });
  if (!ehAdminDoMapa(a.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });   // o mapa: só o dono (lib/cyber/adminMapa)
  const corpo = await req.json().catch(() => null);
  if (!corpo || typeof corpo !== "object") return NextResponse.json({ error: "config inválida" }, { status: 400 });
  const config = await salvarConfig(sanitizarConfig(corpo));
  return NextResponse.json({ config });
}
