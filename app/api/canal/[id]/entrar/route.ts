/**
 * POST /api/canal/[id]/entrar — entra num canal "aberto" (vira membro; passa a receber e falar).
 * #443: a entrada é UM comando no banco ("põe, se ainda não estiver" — lib/canal/atomico): duas pessoas entrando
 * juntas não se apagam, e o clique duplo não anuncia "entrou" duas vezes.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, sessaoUsuario, exigirFlag, isObjectId } from "@/lib/canal/server";
import { normalizarAcesso } from "@/lib/canal/gate";
import { anunciarEntrada } from "@/lib/canal/presenca";
import { EV_MENSAGEM, publicarPusher } from "@/lib/canal/realtime";
import { entrarComoMembro, type DbAtomico } from "@/lib/canal/atomico";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isObjectId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canal = await prisma.canal.findUnique({ where: { id: params.id } });
  if (!canal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (canal.ownerId === u.id || canal.membros.includes(u.id)) return NextResponse.json({ ok: true, canal });
  if (normalizarAcesso(canal.acesso) !== "aberto") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const r = await entrarComoMembro(prisma as unknown as DbAtomico, canal.id, u.id);
  // #423: entrou num canal aberto (virou membro) → "fulano entrou no escritório" no chat (#443: só quem entrou agora)
  if (r === "entrou") {
    await anunciarEntrada({ criar: (d) => prisma.canalMensagem.create({ data: d }), publicar: publicarPusher, evento: EV_MENSAGEM },
      canal.id, { id: u.id, nome: u.name, avatar: u.image ?? null });
  }
  const upd = await prisma.canal.findUnique({ where: { id: canal.id } });
  return NextResponse.json({ ok: true, canal: upd ?? canal });
}
