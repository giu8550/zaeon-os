/**
 * POST   /api/lounge3d/[id]/recado { texto } → o DONO (fundador, pela SESSÃO) manda um recado pro QG do Andrei:
 *        guarda no conteúdo da sala (o Andrei vê mesmo se entrar depois) e difunde "recado-qg" na hora.
 * DELETE /api/lounge3d/[id]/recado            → o dono apaga o recado (o holograma do QG some).
 * Quem não é o dono recebe 403. Autor, nome e cor saem da sessão — nunca do corpo.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { guard } from "@/src/lib/ratelimit";
import { triggerSafe } from "@/lib/collab/realtime";
import { eu, exigirFlag, salaDoMembro } from "@/lib/lounge3d/server";
import { lerConteudo, sanitizarTextoRecado, uid } from "@/lib/lounge3d/sala";
import { EV_RECADO, canalSala, type RecadoQG } from "@/lib/lounge3d/tipos";

const NEGADO = "Só o dono da Zaeon manda recados pro QG.";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-recado"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!me.fundador) return NextResponse.json({ error: NEGADO }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const texto = sanitizarTextoRecado((b as { texto?: unknown })?.texto);
  if (!texto) return NextResponse.json({ error: "Recado vazio" }, { status: 400 });
  const recado: RecadoQG = { id: uid(), texto, deId: me.id, deNome: me.name, deCor: me.color, ts: Date.now() };
  const conteudo = { ...lerConteudo(s.content), recadoQG: recado };
  await prisma.collabDoc.update({ where: { id: s.id }, data: { content: JSON.stringify(conteudo) } });
  await triggerSafe(canalSala(s.id), EV_RECADO, { recado });
  return NextResponse.json({ ok: true, recado });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-recado"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!me.fundador) return NextResponse.json({ error: NEGADO }, { status: 403 });
  const { notes, artifacts } = lerConteudo(s.content);
  await prisma.collabDoc.update({ where: { id: s.id }, data: { content: JSON.stringify({ notes, artifacts }) } });
  await triggerSafe(canalSala(s.id), EV_RECADO, { recado: null });
  return NextResponse.json({ ok: true });
}
