/**
 * GET /api/estudos/board → { board, compartilhados } — o MEU board de Meus Estudos (criado na 1ª vez) e os boards em
 * que sou convidado. lib/estudos/board-server.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { boardsCompartilhados, meuBoard } from "@/lib/estudos/board-server";
import { entrarNoBoard } from "@/lib/estudos/rota";

export async function GET(req: Request) {
  const a = await entrarNoBoard(req, "estudos-board-get"); if ("response" in a) return a.response;
  const [board, compartilhados] = await Promise.all([meuBoard(a.userId), boardsCompartilhados(a.userId)]);
  return NextResponse.json({ board, compartilhados });
}
