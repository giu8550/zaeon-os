/**
 * POST /api/lounge3d/[id]/pusher-auth — autoriza `presence-lounge3d-<id>` (pusher-js; form-urlencoded
 * socket_id/channel_name). Só membro entra; TETO DE 5 aplicado AQUI (conta os ocupantes atuais no Pusher;
 * quem já está dentro reconecta). user_info = nome + cor (pros avatares).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { guard } from "@/src/lib/ratelimit";
import { getPusher } from "@/lib/collab/realtime";
import { eu, exigirFlag, salaDoMembro } from "@/lib/lounge3d/server";
import { admitir } from "@/lib/lounge3d/sala";
import { salaIdDeCanal } from "@/lib/lounge3d/tipos";

export async function ocupantes(pusher: { get(o: { path: string }): Promise<{ ok: boolean; json(): Promise<any> }> }, channel: string): Promise<string[]> {
  try {
    const r = await pusher.get({ path: `/channels/${channel}/users` });
    if (!r.ok) return [];
    const d = await r.json().catch(() => ({}));
    return Array.isArray(d?.users) ? d.users.map((u: any) => String(u.id)) : [];
  } catch { return []; }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-auth"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let socketId = "", channel = "";
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) { const b = await req.json().catch(() => ({})); socketId = String(b?.socket_id ?? ""); channel = String(b?.channel_name ?? ""); }
  else { const p = new URLSearchParams(await req.text().catch(() => "")); socketId = p.get("socket_id") ?? ""; channel = p.get("channel_name") ?? ""; }
  if (!/^[\d.]+$/.test(socketId)) return NextResponse.json({ error: "socket_id inválido" }, { status: 400 });
  const salaId = salaIdDeCanal(channel);
  if (!salaId || salaId !== params.id) return NextResponse.json({ error: "canal inválido" }, { status: 400 });
  const s = await salaDoMembro(salaId, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pusher = getPusher();
  if (!pusher) {
    // diagnóstico: só os NOMES das variáveis ausentes (nunca valores)
    const faltam = ["PUSHER_APP_ID", "NEXT_PUBLIC_PUSHER_KEY", "PUSHER_SECRET", "NEXT_PUBLIC_PUSHER_CLUSTER"].filter((k) => !process.env[k]);
    console.error(`[lounge3d] pusher-auth 503: getPusher() nulo no servidor — faltam no runtime: ${faltam.join(", ") || "(todas presentes?)"}`);
    return NextResponse.json({ error: "realtime desligado" }, { status: 503 });
  }
  const dentro = await ocupantes(pusher, channel);
  const adm = admitir(dentro, me.id);
  if (!adm.ok) return NextResponse.json({ error: "Sala cheia (máximo 5).", motivo: "cheia" }, { status: 403 });
  return NextResponse.json(pusher.authorizeChannel(socketId, channel, { user_id: me.id, user_info: { name: me.name, color: me.color, image: me.image } }));
}
