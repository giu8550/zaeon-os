/**
 * POST /api/estudos/board/:id/pusher-auth — autoriza `presence-estudos-<id>` (pusher-js; socket_id/channel_name em
 * form-urlencoded ou JSON). Só quem tem papel no board entra; user_info = nome, foto e cor (os avatares e os cursores).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getPusher } from "@/lib/collab/realtime";
import { prisma } from "@/src/lib/prisma";
import { corDoUsuario } from "@/lib/lounge3d/tipos";
import { boardDoCanal, boardDoUsuario } from "@/lib/estudos/board-server";
import { entrarNoBoard, falhaBoard } from "@/lib/estudos/rota";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await entrarNoBoard(req, "estudos-board-auth"); if ("response" in a) return a.response;
  let socketId = "", canal = "";
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) { const b = await req.json().catch(() => ({})); socketId = String(b?.socket_id ?? ""); canal = String(b?.channel_name ?? ""); }
  else { const p = new URLSearchParams(await req.text().catch(() => "")); socketId = p.get("socket_id") ?? ""; canal = p.get("channel_name") ?? ""; }
  if (!/^[\d.]+$/.test(socketId)) return falhaBoard("invalid");
  if (boardDoCanal(canal) !== params.id) return falhaBoard("invalid");
  if (!(await boardDoUsuario(params.id, a.userId))) return falhaBoard("not_found");
  const pusher = getPusher(); if (!pusher) return NextResponse.json({ error: "realtime desligado" }, { status: 503 });
  const u = await prisma.user.findUnique({ where: { id: a.userId }, select: { name: true, image: true } });
  return NextResponse.json(pusher.authorizeChannel(socketId, canal, { user_id: a.userId, user_info: { nome: (u?.name || "Alguém").slice(0, 40), imagem: u?.image ?? null, cor: corDoUsuario(a.userId) } }));
}
