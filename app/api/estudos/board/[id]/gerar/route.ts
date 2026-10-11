/**
 * POST /api/estudos/board/:id/gerar { cardId, acao: "percurso" | "resposta" } → { board, criados }
 * O HARNESS dentro do card (lib/estudos/harness): "percurso" chama o percursor (o Cérebro) e ramifica os passos;
 * "resposta" chama a RESPOSTA CERTEIRA (a literatura, com cada citação conferida no texto do artigo) e ramifica as
 * CONFIRMAÇÕES (com as fontes) e as ESPECULAÇÕES. Só dono/editor; os cards entram pra todo mundo no board.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
import { NextResponse } from "next/server";
import { podeEscrever } from "@/lib/cartolina/access";
import { boardDoUsuario, patchBoardEstudos } from "@/lib/estudos/board-server";
import { cardsDaResposta, cardsDoPercurso, temaDoCard } from "@/lib/estudos/harness";
import { gerarPassos, respostaCerteira } from "@/lib/estudos/harness-server";
import { entrarNoBoard, falhaBoard } from "@/lib/estudos/rota";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await entrarNoBoard(req, "estudos-board-gerar", "ai-heavy"); if ("response" in a) return a.response;
  const b = await req.json().catch(() => ({})) as { cardId?: unknown; acao?: unknown };
  if (typeof b.cardId !== "string" || (b.acao !== "percurso" && b.acao !== "resposta")) return falhaBoard("invalid");
  const board = await boardDoUsuario(params.id, a.userId);
  if (!board) return falhaBoard("not_found");
  if (!podeEscrever(board.papel)) return falhaBoard("forbidden");
  const card = board.cards.find((c) => c.id === b.cardId);
  if (!card || (b.acao === "percurso" && card.tipo !== "estudo")) return falhaBoard("invalid");
  const tema = temaDoCard(card);
  if (tema.length < 3) return NextResponse.json({ error: "Escreva o tema no card antes." }, { status: 400 });
  try {
    const novos = b.acao === "percurso" ? cardsDoPercurso(card, board.cards, await gerarPassos(tema), a.userId) : cardsDaResposta(card, board.cards, await respostaCerteira(tema), a.userId);
    if (!novos.length) return NextResponse.json({ board, criados: 0 });
    const r = await patchBoardEstudos(params.id, a.userId, { upsert: novos });
    return r.ok ? NextResponse.json({ board: r.board, criados: novos.length }) : falhaBoard(r.motivo);
  } catch (e) {
    console.error("[estudos] harness falhou:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "O percursor não respondeu agora — tente de novo." }, { status: 502 });
  }
}
