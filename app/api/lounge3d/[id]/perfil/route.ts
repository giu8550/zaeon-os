/**
 * POST /api/lounge3d/[id]/perfil { perfil } — o que a pessoa contou pra Zaeon (o holograma da capela, no tutorial):
 * como quer ser chamada, se estuda/trabalha, a área, o objetivo e como aprende melhor. Fica em User.cyberPerfil — a
 * memória que os agentes vão usar. Só as chaves conhecidas, cada valor limpo (lib/cyber/conversaZaeon `limparPerfil`);
 * mescla com o que já havia. Membro da sala (IDOR → 404).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { guard } from "@/src/lib/ratelimit";
import { eu, exigirFlag, salaDoMembro } from "@/lib/lounge3d/server";
import { limparPerfil } from "@/lib/cyber/conversaZaeon";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-acesso"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const perfil = limparPerfil((b as { perfil?: unknown })?.perfil);
  if (!Object.keys(perfil).length) return NextResponse.json({ error: "perfil vazio" }, { status: 400 });
  const atual = await prisma.user.findUnique({ where: { id: me.id }, select: { cyberPerfil: true } });
  // o que já estava guardado fica como está (quem passou pelo tutorial antigo tem chaves que o novo não pergunta mais)
  const antes = atual?.cyberPerfil && typeof atual.cyberPerfil === "object" && !Array.isArray(atual.cyberPerfil) ? (atual.cyberPerfil as Record<string, unknown>) : {};
  const novo = { ...antes, ...perfil };
  await prisma.user.update({ where: { id: me.id }, data: { cyberPerfil: novo } });
  return NextResponse.json({ ok: true, perfil: novo });
}
