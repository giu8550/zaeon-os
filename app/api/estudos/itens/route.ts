/**
 * GET /api/estudos/itens → { itens } — os ESTUDOS da pessoa como ITENS do game (lib/estudos/itens): de todos os boards
 * de Meus Estudos em que ela tem papel (o dela e os de que é membro). O inventário e a biblioteca do cyberespaço leem daqui.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { SURFACE_ESTUDOS, lerCards } from "@/lib/estudos/board";
import { itensDosBoards } from "@/lib/estudos/itens";
import { entrarNoBoard } from "@/lib/estudos/rota";

export async function GET(req: Request) {
  const a = await entrarNoBoard(req, "estudos-itens"); if ("response" in a) return a.response;
  const membro = await prisma.cartolinaMembro.findMany({ where: { userId: a.userId }, select: { cartolinaId: true }, take: 50 });
  const rows = await prisma.cartolina.findMany({
    where: { surface: SURFACE_ESTUDOS, OR: [{ ownerId: a.userId }, { id: { in: membro.map((m) => m.cartolinaId) } }] },
    select: { id: true, cards: true }, take: 60,
  });
  return NextResponse.json({ itens: itensDosBoards(rows.map((r) => ({ id: r.id, cards: lerCards(r.cards) }))).slice(0, 48) });
}
