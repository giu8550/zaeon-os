/**
 * POST /api/lounge3d/[id]/topo — "subir ao topo da Zaeon" (base do dono). AÇÃO PRIVILEGIADA: só o fundador
 * (isSuperAdmin pela sessão, nunca por flag do cliente) recebe 200; o resto 403. O cliente só faz a transição
 * depois deste OK, e os outros só desenham alguém no topo se o servidor marcou essa pessoa como fundador.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { guard } from "@/src/lib/ratelimit";
import { eu, exigirFlag, salaDoMembro } from "@/lib/lounge3d/server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-topo"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!me.fundador) return NextResponse.json({ error: "Só o dono da Zaeon sobe ao topo." }, { status: 403 });
  return NextResponse.json({ ok: true });
}
