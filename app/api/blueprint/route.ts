/**
 * GET /api/blueprint → { blueprints } — os BLUEPRINTS da pessoa (um por conversa que virou estudo), pro seletor no topo
 * da Sala de Estudos. lib/blueprint/server. Flag BLUEPRINT_PRATICO (off = 404).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { listarBlueprints } from "@/lib/blueprint/server";
import { blueprintOn } from "@/lib/blueprint/tipos";
import { entrarNoBoard, falhaBoard } from "@/lib/estudos/rota";

export async function GET(req: Request) {
  if (!blueprintOn()) return falhaBoard("not_found");
  const a = await entrarNoBoard(req, "blueprint-lista"); if ("response" in a) return a.response;
  return NextResponse.json({ blueprints: await listarBlueprints(a.userId) });
}
