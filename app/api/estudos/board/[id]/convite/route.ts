/**
 * POST /api/estudos/board/:id/convite { papel: "editor" | "leitor" } → { token } — só o dono gera o link do board
 * (lib/cartolina/cowork-store: o mesmo convite assinado da cartolina, 7 dias).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { gerarLink } from "@/lib/cartolina/cowork-store";
import { isPapelConvidavel } from "@/lib/cartolina/access";
import { boardDoUsuario } from "@/lib/estudos/board-server";
import { entrarNoBoard, falhaBoard } from "@/lib/estudos/rota";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await entrarNoBoard(req, "estudos-board-convite"); if ("response" in a) return a.response;
  if (!(await boardDoUsuario(params.id, a.userId))) return falhaBoard("not_found");
  const b = await req.json().catch(() => ({})) as { papel?: unknown };
  const papel = isPapelConvidavel(b.papel) ? b.papel : "editor";
  const r = await gerarLink(params.id, a.userId, papel);
  return r.ok ? NextResponse.json({ token: r.token, papel }) : falhaBoard(r.reason);
}
