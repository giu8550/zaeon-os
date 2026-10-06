/**
 * PUT /api/lounge3d/[id]/nave { x, y, z, yaw } — o DONO estacionou a nave-QG (largou o leme): guarda onde ela ficou
 * no conteúdo da sala, pra todo mundo a ver ali mesmo com ele offline (ao vivo, a presença `naveParada` já leva).
 * Só o fundador (pela SESSÃO); números saneados (mesmos limites da presença).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { guard } from "@/src/lib/ratelimit";
import { eu, exigirFlag, salaDoMembro } from "@/lib/lounge3d/server";
import { lerConteudo, sanitizarPresenca } from "@/lib/lounge3d/sala";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-nave"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!me.fundador) return NextResponse.json({ error: "Só o dono estaciona a nave." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const naveQG = sanitizarPresenca({ userId: me.id, name: "x", color: "#000000", x: 0, z: 0, facing: 0, naveParada: b })?.naveParada;
  if (!naveQG) return NextResponse.json({ error: "pose inválida" }, { status: 400 });
  const conteudo = { ...lerConteudo(s.content), naveQG };
  await prisma.collabDoc.update({ where: { id: s.id }, data: { content: JSON.stringify(conteudo) } });
  return NextResponse.json({ ok: true, naveQG });
}
