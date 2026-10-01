/**
 * /api/canal/[id] — GET: canal + últimas mensagens + agentes convocáveis + pessoas (author gate).
 * PATCH (só dono): titulo | acesso | agentes | cartolinaId | adicionarEmail | removerMembro.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, sessaoUsuario, exigirFlag, isObjectId, agentesDoCanal, pessoas, paraWire, agentesPublicos } from "@/lib/canal/server";
import { podeLer, podeGerir, normalizarAcesso } from "@/lib/canal/gate";
import { isAgentKey } from "@/lib/agents/roster";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isObjectId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canal = await prisma.canal.findUnique({ where: { id: params.id } });
  if (!canal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!podeLer(canal, u.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [desc, agentes] = await Promise.all([
    prisma.canalMensagem.findMany({ where: { canalId: canal.id }, orderBy: { createdAt: "desc" }, take: 60 }),
    agentesDoCanal(u.id, canal.agentes),
  ]);
  const msgs = [...desc].reverse();
  const gente = await pessoas([canal.ownerId, ...canal.membros, ...msgs.filter((m) => m.autorTipo === "humano").map((m) => m.autorId)]);
  return NextResponse.json({
    canal: { ...canal, souDono: canal.ownerId === u.id },
    eu: { id: u.id, nome: u.name || "Você", avatar: u.image ?? null },
    mensagens: msgs.map((m) => paraWire(m, gente, agentes)),
    agentes: agentesPublicos(agentes),
    pessoas: [...gente.values()],
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isObjectId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canal = await prisma.canal.findUnique({ where: { id: params.id } });
  if (!canal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!podeGerir(canal, u.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body?.titulo === "string" && body.titulo.trim()) data.titulo = body.titulo.trim().slice(0, 80);
  if (body?.acesso !== undefined) data.acesso = normalizarAcesso(body.acesso);
  if (Array.isArray(body?.agentes)) data.agentes = ([...new Set(body.agentes.filter(isAgentKey))] as string[]).slice(0, 12);
  if (body?.cartolinaId === null) data.cartolinaId = null;
  else if (isObjectId(body?.cartolinaId)) data.cartolinaId = body.cartolinaId;
  let membros = [...canal.membros];
  if (typeof body?.adicionarEmail === "string") {
    const alvo = await prisma.user.findUnique({ where: { email: body.adicionarEmail.trim().toLowerCase() }, select: { id: true } });
    if (!alvo) return NextResponse.json({ error: "Ninguém com esse e-mail na Zaeon." }, { status: 404 });
    if (alvo.id !== canal.ownerId && !membros.includes(alvo.id)) membros.push(alvo.id);
    data.membros = membros;
  }
  if (isObjectId(body?.removerMembro)) { membros = membros.filter((m) => m !== body.removerMembro); data.membros = membros; }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nada pra alterar." }, { status: 400 });
  const upd = await prisma.canal.update({ where: { id: canal.id }, data });
  return NextResponse.json({ canal: { ...upd, souDono: true } });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isObjectId(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canal = await prisma.canal.findUnique({ where: { id: params.id } });
  if (!canal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!podeGerir(canal, u.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.canalMensagem.deleteMany({ where: { canalId: canal.id } });
  await prisma.canal.delete({ where: { id: canal.id } });
  return NextResponse.json({ ok: true });
}
