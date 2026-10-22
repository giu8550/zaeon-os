/**
 * GET /api/estudos/itens → { itens, pesquisas } — o que a pessoa CRIOU, como ITENS do game:
 *  - `itens`: os ESTUDOS (lib/estudos/itens) de todos os boards de Meus Estudos em que ela tem papel (o dela e os de que
 *    é membro) — evoluem com o blueprint; e os BLUEPRINTS PRÁTICOS dela (lib/blueprint/itens, `cardId: "blueprint"`);
 *  - `pesquisas`: as PESQUISAS dela (ResearchWork) — no inventário, livros-holograma com as páginas que ela escreveu
 *    (≈ 300 palavras por página). Sem base de estudos ainda não têm valor (não dá pra vender nem publicar).
 * O inventário e a biblioteca do cyberespaço leem daqui.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { SURFACE_ESTUDOS, lerCards } from "@/lib/estudos/board";
import { itensDosBoards, pesquisaComoItem } from "@/lib/estudos/itens";
import { itemDoBlueprint } from "@/lib/blueprint/itens";
import { SURFACE_BLUEPRINT, blueprintOn, docVazio, sanitizarDoc } from "@/lib/blueprint/tipos";
import { entrarNoBoard } from "@/lib/estudos/rota";

export async function GET(req: Request) {
  const a = await entrarNoBoard(req, "estudos-itens"); if ("response" in a) return a.response;
  const membro = await prisma.cartolinaMembro.findMany({ where: { userId: a.userId }, select: { cartolinaId: true }, take: 50 });
  const [rows, works] = await Promise.all([
    prisma.cartolina.findMany({
      where: { surface: SURFACE_ESTUDOS, OR: [{ ownerId: a.userId }, { id: { in: membro.map((m) => m.cartolinaId) } }] },
      select: { id: true, cards: true }, take: 60,
    }),
    prisma.researchWork.findMany({ where: { userId: a.userId }, select: { id: true, title: true, content: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 24 }),
  ]);
  // os BLUEPRINTS PRÁTICOS (lib/blueprint) também são itens — raros, pelo que foi entregue (flag BLUEPRINT_PRATICO)
  const blueprints = blueprintOn()
    ? (await prisma.cartolina.findMany({ where: { ownerId: a.userId, surface: SURFACE_BLUEPRINT }, select: { id: true, titulo: true, cards: true }, orderBy: { updatedAt: "desc" }, take: 40 }))
      .map((r) => itemDoBlueprint(r.id, sanitizarDoc(r.cards) ?? docVazio(r.titulo, 0)))
    : [];
  return NextResponse.json({
    itens: [...itensDosBoards(rows.map((r) => ({ id: r.id, cards: lerCards(r.cards) }))), ...blueprints].sort((x, y) => y.nivel - x.nivel).slice(0, 48),
    pesquisas: works.map((w) => pesquisaComoItem(w)),
  });
}
