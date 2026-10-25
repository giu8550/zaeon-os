/**
 * GET /api/rea/[id] → { view } — o blueprint REA (documento de engenharia reversa) SE a pessoa tem papel nele.
 * O chat usa pra abrir o módulo e pra saber quando parou de `gerando`. Flag REA_BLUEPRINT.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { reaDoUsuario } from "@/lib/rea-blueprint/server";
import { reaBlueprintOn } from "@/lib/rea-blueprint/tipos";
import { entrarNoBoard, falhaBoard } from "@/lib/estudos/rota";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  if (!reaBlueprintOn()) return falhaBoard("not_found");
  const a = await entrarNoBoard(req, "rea-ver"); if ("response" in a) return a.response;
  const id = String((await ctx.params).id ?? "");
  const view = await reaDoUsuario(id, a.userId);
  if (!view) return falhaBoard("not_found");
  return NextResponse.json({ view });
}
