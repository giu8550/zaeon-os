/**
 * POST /api/cyber/entrega { workId } — a ENTREGA ao Droid na Sala do Saber (lib/cyber/entregaAbnt): a pesquisa da pessoa
 * (ResearchWork DELA — IDOR → 404) é avaliada; completa e totalmente estruturada em ABNT → aceita (grava em
 * User.cyberPerfil `entregaAceitaEm`/`entregaWorkId`, preservando as outras chaves). Responde o veredito e o que falta.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { guard } from "@/src/lib/ratelimit";
import { eu } from "@/lib/lounge3d/server";
import { avaliarEntrega } from "@/lib/cyber/entregaAbnt";

const OID = /^[a-f0-9]{24}$/i;

export async function POST(req: Request) {
  const rl = await guard(req, "lounge3d-acesso"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { workId?: unknown } | null;
  const workId = typeof body?.workId === "string" ? body.workId : "";
  if (!OID.test(workId)) return NextResponse.json({ error: "workId inválido" }, { status: 400 });
  const w = await prisma.researchWork.findFirst({ where: { id: workId, userId: me.id }, select: { id: true, title: true, content: true } });
  if (!w) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const a = avaliarEntrega({ titulo: w.title, conteudo: w.content });
  if (a.aceito) {
    const u = await prisma.user.findUnique({ where: { id: me.id }, select: { cyberPerfil: true } });
    const antes = (u?.cyberPerfil && typeof u.cyberPerfil === "object" && !Array.isArray(u.cyberPerfil) ? u.cyberPerfil : {}) as Record<string, unknown>;
    await prisma.user.update({ where: { id: me.id }, data: { cyberPerfil: { ...antes, entregaAceitaEm: new Date().toISOString(), entregaWorkId: w.id } } });
  }
  return NextResponse.json({ aceito: a.aceito, faltando: a.faltando, paginas: a.paginas, titulo: w.title ?? "" });
}
