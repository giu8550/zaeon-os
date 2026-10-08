/**
 * POST /api/lounge3d/[id]/rt-token → { token, url, ice } pra entrar na room do COLYSEUS (realtime do cyberespaço).
 * Quem decide é a SESSÃO (NextAuth): membro da sala → token HMAC curto (2 min, só serve pra ENTRAR) com userId,
 * nome, cor e regalias (fundador) decididas aqui; o Colyseus só confere a assinatura (REALTIME_SECRET).
 * `ice` = STUN + TURN com credencial temporária (coturn), se configurado. Sem REALTIME_SECRET → 503.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { guard } from "@/src/lib/ratelimit";
import { eu, exigirFlag, salaDoMembro } from "@/lib/lounge3d/server";
import { servidoresIce } from "@/lib/lounge3d/ice";
import { assinarToken, VALIDADE_TOKEN_MS } from "@/server/colyseus/src/token";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-rt-token", "lounge-pos"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const segredo = process.env.REALTIME_SECRET;
  if (!segredo) return NextResponse.json({ error: "Realtime (Colyseus) não configurado no servidor." }, { status: 503 });
  const token = assinarToken({ u: me.id, n: me.name, c: me.color, f: me.fundador, q: false,   // `q` (o antigo dono do QG) fica false: o Colyseus em produção ainda lê o campo
    s: s.id, exp: Date.now() + VALIDADE_TOKEN_MS }, segredo);
  return NextResponse.json({ token, ice: servidoresIce(me.id) });
}
