/**
 * GET /api/tcc/:id → { tcc, sugestoes }  (documento + seções + sugestões da Pesquisa pendentes)
 * Dono ou membro da conversa (cartolina). Sem acesso = 404 (não vaza quais ids existem).
 */
import { NextResponse } from "next/server";
import { entrarTcc } from "@/lib/tcc/route-auth";
import { getTccForUser, listarSugestoes } from "@/lib/tcc/store";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const a = await entrarTcc(req, "tcc-get");
  if ("response" in a) return a.response;
  const tcc = await getTccForUser(params.id, a.userId);
  if (!tcc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ tcc, sugestoes: await listarSugestoes(tcc.id) });
}
