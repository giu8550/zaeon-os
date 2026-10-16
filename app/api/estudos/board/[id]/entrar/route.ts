/**
 * POST /api/estudos/board/:id/entrar { token } → { papel } — entrar no board pelo link (idempotente, nunca rebaixa).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { entrarPorConvite } from "@/lib/cartolina/cowork-store";
import { entrarNoBoard, falhaBoard } from "@/lib/estudos/rota";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await entrarNoBoard(req, "estudos-board-entrar"); if ("response" in a) return a.response;
  const b = await req.json().catch(() => ({})) as { token?: unknown };
  const r = await entrarPorConvite(params.id, a.userId, b.token);
  return r.ok ? NextResponse.json({ papel: r.papel }) : falhaBoard(r.reason);
}
