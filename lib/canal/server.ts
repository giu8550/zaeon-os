/**
 * lib/canal/server.ts — helpers SERVER das rotas /api/canal (sessão, roster do canal, wire).
 * Prisma singleton; nada de UI. Flag: todas as rotas chamam `exigirFlag()` primeiro.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { escritorioCowork } from "@/lib/canal/flags";
import { rosterComMentores, mergeProfiles, publicView, type AgentView } from "@/lib/agents/roster";
import type { MensagemWire } from "@/lib/canal/realtime";
import { agentesDasSalas } from "@/lib/canal/agentesSalas";
import { tipoDoAutor } from "@/lib/canal/presenca";

export const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
export const isObjectId = (v: unknown): v is string => typeof v === "string" && OBJECT_ID_RE.test(v);

export type Usuario = { id: string; name: string | null; image: string | null; email: string; role: string | null; sessionRole?: string | null };

/** Usuário logado (id do banco). null = anônimo. */
export async function sessaoUsuario(): Promise<Usuario | null> {
  const session = await getServerSession(authOptions).catch(() => null);
  const email = session?.user?.email;
  if (!email) return null;
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, image: true, role: true } });
  return u ? { ...u, email, sessionRole: (session?.user as { role?: string } | undefined)?.role ?? null } : null;
}

/** 404 quando a flag está desligada (merge não muda nada até ligar). */
export function exigirFlag(): NextResponse | null {
  return escritorioCowork() ? null : NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** Roster completo (seed + banco + profiles), com `ativo` aplicado. */
export async function rosterCompleto(): Promise<AgentView[]> {
  const [mentores, profiles] = await Promise.all([
    prisma.mentorTemplate.findMany({ select: { slug: true, name: true, course: true, emoji: true, personaText: true, order: true } }).catch(() => []),
    prisma.agentProfile.findMany().catch(() => []),
  ]);
  return mergeProfiles(rosterComMentores(mentores), profiles).filter((a) => a.ativo && a.conversacional);
}

/** Agentes que ESTE usuário pode convocar no canal — os MESMOS de todas as outras salas (o escritório é só outra forma de
 *  chamar um ou mais deles, pedido do dono): TODAS as personas da plataforma (Zaeon, Aura, Nina, Caio, Téo, Zenita, Davi,
 *  Scholar, Examiner — as que conversam) + os mentores que ele contratou (os mesmos do seletor do chat) + os já presentes
 *  no canal. `AGENTES_BASE` = a Aura, que vem primeiro. */
export const AGENTES_BASE: readonly string[] = ["aura"];
export async function agentesDoCanal(userId: string, canalAgentes: string[] = []): Promise<AgentView[]> {
  const [roster, plugs] = await Promise.all([
    rosterCompleto(),
    prisma.pluggedMentor.findMany({ where: { userId, enabled: true }, select: { templateId: true } }).catch(() => []),
  ]);
  const slugs = new Set<string>([...AGENTES_BASE, ...agentesDasSalas(roster)]);
  for (const k of canalAgentes) slugs.add(k);
  if (plugs.length) {
    const tpls = await prisma.mentorTemplate.findMany({ where: { id: { in: plugs.map((p) => p.templateId) } }, select: { slug: true } }).catch(() => []);
    for (const t of tpls) slugs.add(t.slug);
  }
  return roster.filter((a) => slugs.has(a.agentKey));
}

export type Pessoa = { id: string; nome: string; avatar: string | null };
export async function pessoas(ids: string[]): Promise<Map<string, Pessoa>> {
  const uniq = [...new Set(ids.filter(isObjectId))];
  if (!uniq.length) return new Map();
  const rows = await prisma.user.findMany({ where: { id: { in: uniq } }, select: { id: true, name: true, image: true } }).catch(() => []);
  return new Map(rows.map((r) => [r.id, { id: r.id, nome: r.name || "Alguém", avatar: r.image ?? null }]));
}

type MsgRow = { id: string; canalId: string; autorTipo: string; autorId: string; texto: string; mencoes: string[]; createdAt: Date };
export function paraWire(m: MsgRow, gente: Map<string, Pessoa>, agentes: AgentView[]): MensagemWire {
  const ag = m.autorTipo === "agente" ? agentes.find((a) => a.agentKey === m.autorId) : null;
  // humano e "sistema" (#423: o aviso "fulano entrou") apontam pra uma pessoa
  const p = m.autorTipo !== "agente" ? gente.get(m.autorId) : null;
  return {
    id: m.id, canalId: m.canalId, autorTipo: tipoDoAutor(m.autorTipo), autorId: m.autorId,
    texto: m.texto, mencoes: m.mencoes ?? [], createdAt: new Date(m.createdAt).toISOString(),
    autorNome: ag?.nome ?? p?.nome ?? (m.autorTipo === "agente" ? m.autorId : "Alguém"),
    autorAvatar: ag?.avatarUrl ?? p?.avatar ?? null,
  };
}

export const agentesPublicos = (list: AgentView[]) => list.map(publicView);
export { prisma };
