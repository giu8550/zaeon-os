/**
 * /api/canal — GET: meus canais (dono ou membro). POST { titulo, acesso?, agentes? }: cria.
 * Flag NEXT_PUBLIC_ESCRITORIO_COWORK (404 desligada). Sessão obrigatória.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, sessaoUsuario, exigirFlag } from "@/lib/canal/server";
import { normalizarAcesso } from "@/lib/canal/gate";
import { isAgentKey } from "@/lib/agents/roster";

export async function GET() {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canais = await prisma.canal.findMany({
    where: { OR: [{ ownerId: u.id }, { membros: { has: u.id } }] },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ canais: canais.map((c) => ({ ...c, souDono: c.ownerId === u.id })) });
}

export async function POST(req: Request) {
  const off = exigirFlag(); if (off) return off;
  const u = await sessaoUsuario();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const titulo = String(body?.titulo ?? "").trim().slice(0, 80);
  if (!titulo) return NextResponse.json({ error: "Dê um nome ao canal." }, { status: 400 });
  // `primeiro: true` = auto-criação do cliente quando a lista veio vazia. Idempotente: se um
  // canal meu já existe (efeito duplo do React/StrictMode, duas abas), devolve ele (200).
  if (body?.primeiro === true) {
    const meu = await prisma.canal.findFirst({ where: { ownerId: u.id }, orderBy: { createdAt: "asc" } });
    if (meu) return NextResponse.json({ canal: { ...meu, souDono: true } });
  }
  const agentes: string[] = Array.isArray(body?.agentes) ? ([...new Set(body.agentes.filter(isAgentKey))] as string[]).slice(0, 12) : ["aura"];
  const canal = await prisma.canal.create({
    data: { ownerId: u.id, titulo, acesso: normalizarAcesso(body?.acesso), membros: [], agentes },
  });
  return NextResponse.json({ canal: { ...canal, souDono: true } }, { status: 201 });
}
