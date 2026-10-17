/**
 * GET /api/canal/[id]/pessoa/[userId] — o perfil de uma pessoa do escritório (#425), pro "Ver perfil" da foto.
 * Só responde pra quem pode ler o canal, e só sobre quem FAZ PARTE dele (dono, membro, o outro lado da conversa).
 * Devolve uma lista fechada de campos públicos (lib/canal/perfil). Os cérebros nunca saem daqui: o select nem
 * busca, e o perfilPublico só copia os campos da lista.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, sessaoUsuario, exigirFlag, isObjectId } from "@/lib/canal/server";
import { podeLer } from "@/lib/canal/gate";
import { CAMPOS_PERFIL, estaNoCanal, perfilPublico } from "@/lib/canal/perfil";

export async function GET(_req: Request, { params }: { params: { id: string; userId: string } }): Promise<NextResponse> {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isObjectId(params.id) || !isObjectId(params.userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canal = await prisma.canal.findUnique({ where: { id: params.id } });
  if (!canal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!podeLer(canal, u.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // só quem é do escritório (não serve pra espiar o perfil de qualquer pessoa pelo id)
  if (!estaNoCanal(canal, params.userId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const alvo = await prisma.user.findUnique({ where: { id: params.userId }, select: CAMPOS_PERFIL });
  if (!alvo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ pessoa: perfilPublico(alvo), papel: canal.ownerId === params.userId ? "dono" : "membro" });
}
