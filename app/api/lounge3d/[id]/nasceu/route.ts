/**
 * POST /api/lounge3d/[id]/nasceu — marca a 1ª entrada no cyberespaço (User.cyberNasceuEm): quem nunca tinha entrado
 * acabou de nascer num tubo de ensaio (lib/cyber/onboarding) e, da próxima vez, nasce na própria base. Idempotente:
 * só grava se ainda estiver vazio. Membro da sala (IDOR → 404).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { guard } from "@/src/lib/ratelimit";
import { eu, exigirFlag, salaDoMembro } from "@/lib/lounge3d/server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-acesso"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (me.novo) await prisma.user.update({ where: { id: me.id }, data: { cyberNasceuEm: new Date() } });
  return NextResponse.json({ ok: true, jaTinha: !me.novo });
}
