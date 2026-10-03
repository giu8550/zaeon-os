/** POST /api/lounge3d/[id]/chat { texto } → sanitiza e difunde "chat" na sala (efêmero: não persiste). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { guard } from "@/src/lib/ratelimit";
import { triggerSafe } from "@/lib/collab/realtime";
import { eu, exigirFlag, salaDoMembro } from "@/lib/lounge3d/server";
import { sanitizarChat, uid } from "@/lib/lounge3d/sala";
import { EV_CHAT, canalSala, type MensagemChat } from "@/lib/lounge3d/tipos";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-chat"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const texto = sanitizarChat(b?.texto);
  if (!texto) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  const msg: MensagemChat = { id: uid(), userId: me.id, name: me.name, color: me.color, texto, ts: Date.now() };
  await triggerSafe(canalSala(s.id), EV_CHAT, msg);
  return NextResponse.json({ ok: true, msg });
}
