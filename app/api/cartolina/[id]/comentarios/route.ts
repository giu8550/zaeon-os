/**
 * GET  /api/cartolina/:id/comentarios[?desde=ISO] → { comentarios }   (qualquer papel)
 * POST /api/cartolina/:id/comentarios { cardId, texto, parentId? } → { id }   (dono/editor)
 */
import { NextResponse } from "next/server";
import { entrar, falha } from "@/lib/cartolina/route-auth";
import { comentar, listarComentarios } from "@/lib/cartolina/cowork-store";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const a = await entrar(req, "cartolina-coment-get", "ai-light", { cowork: true });
  if ("response" in a) return a.response;
  const d = new URL(req.url).searchParams.get("desde");
  const desde = d && !Number.isNaN(Date.parse(d)) ? new Date(d) : undefined;
  const r = await listarComentarios(params.id, a.userId, desde);
  return r.ok ? NextResponse.json({ comentarios: r.comentarios }) : falha(r.reason);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await entrar(req, "cartolina-coment-post", "ai-light", { cowork: true });
  if ("response" in a) return a.response;
  const body = await req.json().catch(() => ({}));
  const r = await comentar(params.id, a.userId, { cardId: body?.cardId, texto: body?.texto, parentId: body?.parentId });
  return r.ok ? NextResponse.json({ id: r.id }, { status: 201 }) : falha(r.reason);
}
