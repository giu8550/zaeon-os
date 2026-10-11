/**
 * GET   /api/estudos/board/:id → { board } (só quem tem papel nele)
 * PATCH /api/estudos/board/:id { upsert?, remove?, titulo? } → { board } — dono/editor; avisa o canal do board.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { boardDoUsuario, patchBoardEstudos } from "@/lib/estudos/board-server";
import { entrarNoBoard, falhaBoard } from "@/lib/estudos/rota";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const a = await entrarNoBoard(req, "estudos-board-get"); if ("response" in a) return a.response;
  const board = await boardDoUsuario(params.id, a.userId);
  return board ? NextResponse.json({ board }) : falhaBoard("not_found");
}
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const a = await entrarNoBoard(req, "estudos-board-patch"); if ("response" in a) return a.response;
  const b = await req.json().catch(() => null) as { upsert?: unknown; remove?: unknown; titulo?: unknown } | null;
  if (!b || typeof b !== "object") return falhaBoard("invalid");
  const r = await patchBoardEstudos(params.id, a.userId, { upsert: Array.isArray(b.upsert) ? b.upsert.slice(0, 120) : [], remove: Array.isArray(b.remove) ? b.remove.slice(0, 120) : [], titulo: b.titulo });
  return r.ok ? NextResponse.json({ board: r.board }) : falhaBoard(r.motivo);
}
