/**
 * GET   /api/lounge3d/[id] → a sala (membro) com conteúdo + membros (nome/cor)
 * PATCH /api/lounge3d/[id] { upsertNotes?, removeNotes?, upsertArtifacts?, removeArtifacts?, title? }
 *       → aplica por item (sanitizado, tetos) sobre o estado ATUAL e avisa a sala (evento "conteudo").
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { corpoDoUsuario, pilotaANave } from "@/lib/lounge3d/corposDeUsuario";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { guard } from "@/src/lib/ratelimit";
import { triggerSafe } from "@/lib/collab/realtime";
import { eu, exigirFlag, salaDoMembro, viewSala } from "@/lib/lounge3d/server";
import { aplicarOps, lerConteudo, sanitizarTexto } from "@/lib/lounge3d/sala";
import { EV_CONTEUDO, canalSala, corDoUsuario } from "@/lib/lounge3d/tipos";
import { isSuperAdmin } from "@/lib/auth/roles";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-get"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const users = await prisma.user.findMany({ where: { id: { in: s.members } }, select: { id: true, name: true, image: true, email: true, role: true } });
  // `fundador` (dono da Zaeon) é decidido no servidor; e-mail/role NÃO saem daqui
  return NextResponse.json({ sala: viewSala(s, me.id), membros: users.map((u) => ({ id: u.id, name: (u.name || "Alguém").slice(0, 40), image: u.image ?? null, color: corDoUsuario(u.id), fundador: isSuperAdmin({ email: u.email, role: u.role }), corpo: corpoDoUsuario(u.id), nave: pilotaANave(u.id, isSuperAdmin({ email: u.email, role: u.role })) })), eu: me });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const rl = await guard(req, "lounge3d-patch"); if (!rl.ok) return rl.response;
  const me = await eu(); if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = await salaDoMembro(params.id, me.id); if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  // Autoria: tudo que o cliente faz upsert leva o autorId da SESSÃO (nunca o que ele mandou).
  const marca = (xs: unknown) => (Array.isArray(xs) ? xs.map((x) => (x && typeof x === "object" ? { ...(x as object), autorId: me.id } : x)) : []);
  const ops = { upsertNotes: marca(b?.upsertNotes), removeNotes: Array.isArray(b?.removeNotes) ? b.removeNotes : [], upsertArtifacts: marca(b?.upsertArtifacts), removeArtifacts: Array.isArray(b?.removeArtifacts) ? b.removeArtifacts : [] };
  const conteudo = aplicarOps(lerConteudo(s.content), ops);
  const title = sanitizarTexto(b?.title, 120) || s.title;
  const upd = await prisma.collabDoc.update({ where: { id: s.id }, data: { content: JSON.stringify(conteudo), title } });
  await triggerSafe(canalSala(s.id), EV_CONTEUDO, { fromUserId: me.id, conteudo, title: upd.title, ts: Date.now() });
  return NextResponse.json({ ok: true, conteudo, title: upd.title });
}
