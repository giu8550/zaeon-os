/**
 * POST /api/lounge3d/[id]/pos { x, z, facing, moving } → difunde "pos" (FALLBACK quando o app Pusher
 * não tem "client events" ligado; o caminho normal é `client-pos` direto entre clientes, sem servidor).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { guard } from "@/src/lib/ratelimit";
import { triggerSafe } from "@/lib/collab/realtime";
import { eu, exigirFlag, salaDoMembro } from "@/lib/lounge3d/server";
import { sanitizarPresenca } from "@/lib/lounge3d/sala";
import { EV_POS, canalSala } from "@/lib/lounge3d/tipos";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-pos", "lounge-pos"); // NÃO o default ai-heavy (20/min): a 4 Hz congelava em ~5 s
  if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  // identidade e regalias (topo/céu/nave) da SESSÃO: quem não é fundador nunca aparece no topo, no céu ou voando
  const p = sanitizarPresenca({ ...b, userId: me.id, name: me.name, color: me.color, topo: me.fundador && b?.topo === true, ceu: me.fundador && b?.ceu === true, voo: me.fundador ? b?.voo : undefined, naveParada: me.fundador ? b?.naveParada : undefined });
  if (!p) return NextResponse.json({ error: "posição inválida" }, { status: 400 });
  await triggerSafe(canalSala(s.id), EV_POS, p);
  return NextResponse.json({ ok: true });
}
