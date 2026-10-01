/**
 * POST /api/canal/pusher-auth — autoriza o canal de PRESENÇA `presence-canal-<id>` do pusher-js
 * (body form-urlencoded: socket_id, channel_name). Só quem passa no author gate entra; o
 * user_info carrega nome+avatar pra lista "quem está online" não precisar de outra chamada.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, sessaoUsuario, exigirFlag } from "@/lib/canal/server";
import { podeLer } from "@/lib/canal/gate";
import { canalIdDePresence } from "@/lib/canal/realtime";
import { getPusher } from "@/lib/collab/realtime";

export async function POST(req: Request) {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let socketId = "", channel = "";
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const b = await req.json().catch(() => ({}));
    socketId = String(b?.socket_id ?? ""); channel = String(b?.channel_name ?? "");
  } else {
    const txt = await req.text().catch(() => "");
    const p = new URLSearchParams(txt);
    socketId = p.get("socket_id") ?? ""; channel = p.get("channel_name") ?? "";
  }
  if (!/^[\d.]+$/.test(socketId)) return NextResponse.json({ error: "socket_id inválido" }, { status: 400 });
  const canalId = canalIdDePresence(channel);
  if (!canalId) return NextResponse.json({ error: "canal inválido" }, { status: 400 });
  const canal = await prisma.canal.findUnique({ where: { id: canalId } });
  if (!canal || !podeLer(canal, u.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const pusher = getPusher();
  if (!pusher) return NextResponse.json({ error: "realtime desligado" }, { status: 503 });
  const auth = pusher.authorizeChannel(socketId, channel, { user_id: u.id, user_info: { nome: u.name || "Alguém", avatar: u.image ?? null } });
  return NextResponse.json(auth);
}
