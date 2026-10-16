/**
 * POST /api/canal/[id]/digitando — "Giulia está digitando…" (#423). Não grava nada: só repassa pelo
 * canal em tempo real (evento "humano-digitando", payload { userId, nome }). O cliente avisa no máximo a
 * cada poucos segundos; aqui ainda há um limite por pessoa+canal (protege o Pusher). Regras em lib/canal/presenca.
 * Author gate: só quem pode escrever no canal avisa que está digitando.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, sessaoUsuario, exigirFlag, isObjectId } from "@/lib/canal/server";
import { podeEscrever } from "@/lib/canal/gate";
import { permitirDigitando } from "@/lib/canal/presenca";
import { EV_HUMANO_DIGITANDO, publicarPusher } from "@/lib/canal/realtime";

/** Último aviso por pessoa+canal (por processo — é só um freio, não precisa ser global). */
const ultimos = new Map<string, number>();
/** Só pra teste. */
export const _limparLimite = () => ultimos.clear();

export async function POST(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isObjectId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canal = await prisma.canal.findUnique({ where: { id: params.id } });
  if (!canal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!podeEscrever(canal, u.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // rápido demais: responde ok sem publicar (o aviso anterior ainda está na tela dos outros)
  if (!permitirDigitando(ultimos, `${u.id}:${canal.id}`, Date.now())) return NextResponse.json({ ok: true, enviado: false });
  await publicarPusher(canal.id, EV_HUMANO_DIGITANDO, { userId: u.id, nome: u.name || "Alguém" });
  return NextResponse.json({ ok: true, enviado: true });
}
