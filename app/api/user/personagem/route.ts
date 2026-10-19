/**
 * /api/user/personagem — o PERSONAGEM do jogo (lib/cyber/personagem): gênero (o modelo de astronauta) + cor.
 *   GET  → { personagem }   (null = ainda não escolheu: o jogo mostra o seletor)
 *   POST { genero, cor } → valida (a cor tem que ser da lista do gênero) e grava em User.cyberPerfil.personagem,
 *        sem mexer no resto do cyberPerfil (as motos, a capela…)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { lerPersonagem, validarPersonagem } from "@/lib/cyber/personagem";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = await prisma.user.findUnique({ where: { email: session.user.email }, select: { cyberPerfil: true } });
  return NextResponse.json({ personagem: lerPersonagem(u?.cyberPerfil) });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = validarPersonagem(await req.json().catch(() => null));
  if (!p) return NextResponse.json({ error: "Escolha um gênero e uma das cores." }, { status: 400 });
  try {
    const u = await prisma.user.findUnique({ where: { email: session.user.email }, select: { cyberPerfil: true } });
    const atual = u?.cyberPerfil && typeof u.cyberPerfil === "object" && !Array.isArray(u.cyberPerfil) ? (u.cyberPerfil as Record<string, unknown>) : {};
    await prisma.user.update({ where: { email: session.user.email }, data: { cyberPerfil: { ...atual, personagem: p } as Prisma.InputJsonValue } });
    return NextResponse.json({ ok: true, personagem: p });
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar agora." }, { status: 500 });
  }
}
