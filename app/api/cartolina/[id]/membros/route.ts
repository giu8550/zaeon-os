/**
 * GET    /api/cartolina/:id/membros → { membros }          (qualquer papel; sem e-mails)
 * DELETE /api/cartolina/:id/membros { userId } → { ok }     (só o dono)
 */
import { NextResponse } from "next/server";
import { entrar, falha } from "@/lib/cartolina/route-auth";
import { listarMembros, removerMembro } from "@/lib/cartolina/cowork-store";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const a = await entrar(req, "cartolina-membros", "ai-light", { cowork: true });
  if ("response" in a) return a.response;
  const r = await listarMembros(params.id, a.userId);
  return r.ok ? NextResponse.json({ membros: r.membros }) : falha(r.reason);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const a = await entrar(req, "cartolina-membros", "ai-light", { cowork: true });
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => ({}));
  const r = await removerMembro(params.id, a.userId, body?.userId);
  return r.ok ? NextResponse.json({ ok: true }) : falha(r.reason);
}
