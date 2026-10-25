/**
 * GET /api/rea → { blueprints } — os BLUEPRINTS REA da pessoa (um por conversa de engenharia reversa), pro seletor
 * na Sala de Estudos / a aba REA. lib/rea-blueprint/server. Flag REA_BLUEPRINT (off = 404).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { listarRea } from "@/lib/rea-blueprint/server";
import { reaBlueprintOn } from "@/lib/rea-blueprint/tipos";
import { entrarNoBoard, falhaBoard } from "@/lib/estudos/rota";

export async function GET(req: Request) {
  if (!reaBlueprintOn()) return falhaBoard("not_found");
  const a = await entrarNoBoard(req, "rea-lista"); if ("response" in a) return a.response;
  return NextResponse.json({ blueprints: await listarRea(a.userId) });
}
