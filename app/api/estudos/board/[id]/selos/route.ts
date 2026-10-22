/**
 * POST /api/estudos/board/:id/selos { cardId } → { board, links } — a CAMADA DE VALIDAÇÃO do blueprint
 * (lib/estudos/blueprint): confere se os links do estudo (as fontes e o repositório) respondem e grava o selo no card
 * (só o servidor grava selo). Só URL pública (sem rede interna — lib/scholar/ssrf), sem seguir redirecionamento (um
 * 3xx conta como vivo), 6 s por link, 4 de cada vez. Só dono/editor.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { podeEscrever } from "@/lib/cartolina/access";
import { vivo } from "@/lib/estudos/linkVivo";
import { boardDoUsuario, patchBoardEstudos } from "@/lib/estudos/board-server";
import { linksDoBlueprint, montarBlueprint } from "@/lib/estudos/blueprint";
import { entrarNoBoard, falhaBoard } from "@/lib/estudos/rota";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await entrarNoBoard(req, "estudos-board-selos", "ai-heavy"); if ("response" in a) return a.response;
  const b = await req.json().catch(() => ({})) as { cardId?: unknown };
  if (typeof b.cardId !== "string") return falhaBoard("invalid");
  const board = await boardDoUsuario(params.id, a.userId);
  if (!board) return falhaBoard("not_found");
  if (!podeEscrever(board.papel)) return falhaBoard("forbidden");
  const bp = montarBlueprint(board.cards, b.cardId); if (!bp) return falhaBoard("invalid");
  const urls = linksDoBlueprint(bp), res: boolean[] = [];
  for (let i = 0; i < urls.length; i += 4) res.push(...(await Promise.all(urls.slice(i, i + 4).map(vivo))));
  const links = { ok: res.filter(Boolean).length, total: urls.length, em: Date.now() };
  const r = await patchBoardEstudos(params.id, a.userId, { upsert: [{ ...bp.estudo, selos: { ...bp.estudo.selos, links } }] }, { servidor: true });
  return r.ok ? NextResponse.json({ board: r.board, links, quebrados: urls.filter((_, i) => !res[i]) }) : falhaBoard(r.motivo);
}
