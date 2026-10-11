/**
 * POST /api/cyber/motos — o tutorial das MOTOS acabou: grava a liberação (User.cyberPerfil `motosLiberadasEm`). Só vale
 * depois de uma ENTREGA aceita (`entregaAceitaEm` — /api/cyber/entrega); o dono já tem as motos. Idempotente.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { guard } from "@/src/lib/ratelimit";
import { eu } from "@/lib/lounge3d/server";

export async function POST(req: Request) {
  const rl = await guard(req, "lounge3d-acesso"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.fundador) return NextResponse.json({ ok: true });
  const u = await prisma.user.findUnique({ where: { id: me.id }, select: { cyberPerfil: true } });
  const antes = (u?.cyberPerfil && typeof u.cyberPerfil === "object" && !Array.isArray(u.cyberPerfil) ? u.cyberPerfil : {}) as Record<string, unknown>;
  if (!antes.entregaAceitaEm) return NextResponse.json({ error: "Entregue uma pesquisa ao Droid antes." }, { status: 409 });
  if (!antes.motosLiberadasEm) await prisma.user.update({ where: { id: me.id }, data: { cyberPerfil: { ...antes, motosLiberadasEm: new Date().toISOString() } } });
  return NextResponse.json({ ok: true });
}
