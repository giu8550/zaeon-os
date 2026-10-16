/**
 * GET /api/estudos/board/:id/membros → { membros } — quem tem papel no board (dono, editores, leitores).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { listarMembros } from "@/lib/cartolina/cowork-store";
import { boardDoUsuario } from "@/lib/estudos/board-server";
import { entrarNoBoard, falhaBoard } from "@/lib/estudos/rota";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const a = await entrarNoBoard(req, "estudos-board-membros"); if ("response" in a) return a.response;
  if (!(await boardDoUsuario(params.id, a.userId))) return falhaBoard("not_found");
  const r = await listarMembros(params.id, a.userId);
  return r.ok ? NextResponse.json({ membros: r.membros }) : falhaBoard(r.reason);
}
