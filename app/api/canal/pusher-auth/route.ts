/**
 * POST /api/canal/pusher-auth — autoriza os canais do escritório no pusher-js (body form-urlencoded: socket_id,
 * channel_name). Só quem pode LER o canal entra:
 *   - `presence-canal-<id>` → "quem está online". #468: o user_info leva só o NOME — a foto inteira (data:image) de
 *     quem pôs foto própria passava do limite do Pusher e a pessoa não aparecia online; a tela pega a foto da lista
 *     de pessoas que já tem.
 *   - `private-canal-<id>` (#468) → as mensagens, digitando, agenda. Antes o canal era público.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, sessaoUsuario, exigirFlag } from "@/lib/canal/server";
import { podeLer } from "@/lib/canal/gate";
import { canalIdDePresence, canalIdDePrivado } from "@/lib/canal/realtime";
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
  const presenca = canalIdDePresence(channel);
  const canalId = presenca ?? canalIdDePrivado(channel);
  if (!canalId) return NextResponse.json({ error: "canal inválido" }, { status: 400 });
  const canal = await prisma.canal.findUnique({ where: { id: canalId } });
  if (!canal || !podeLer(canal, u.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const pusher = getPusher();
  if (!pusher) return NextResponse.json({ error: "realtime desligado" }, { status: 503 });
  const auth = presenca
    ? pusher.authorizeChannel(socketId, channel, { user_id: u.id, user_info: { nome: (u.name || "Alguém").slice(0, 80) } })
    : pusher.authorizeChannel(socketId, channel);
  return NextResponse.json(auth);
}
