/**
 * /api/admin/agents (founder-only, flag NEXT_PUBLIC_AGENTS_ADMIN) —
 *   GET: roster + AgentProfile + uso agregado (total, usuários, top N com nome/e-mail).
 *   POST { agentKey, tipo, nome, bio?, avatarUrl?, curso?, personaText? }: cria agente editável
 *        (tipo mentor sem MentorTemplate → cria o template também, com personaText).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { agentsAdmin } from "@/lib/canal/flags";
import { rosterComMentores, mergeProfiles, isAgentKey } from "@/lib/agents/roster";
import { agregarUso } from "@/lib/canal/usage";

export const MAX_AVATAR = 1_600_000; // ~1.2MB em base64

async function gate(): Promise<NextResponse | null> {
  if (!agentsAdmin()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const a = await assertAdmin();
  if (!a.ok) return NextResponse.json({ error: a.status === 401 ? "Unauthorized" : "Forbidden" }, { status: a.status });
  return null;
}

export function validarAvatar(v: unknown): string | null | undefined {
  if (v === null || v === "") return null;
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (s.length > MAX_AVATAR) return undefined;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/.test(s) || /^https:\/\//.test(s) || s.startsWith("/")) return s;
  return undefined;
}

export async function GET() {
  const g = await gate(); if (g) return g;
  const [mentores, profiles, uso] = await Promise.all([
    prisma.mentorTemplate.findMany({ select: { slug: true, name: true, course: true, emoji: true, personaText: true, order: true } }),
    prisma.agentProfile.findMany(),
    prisma.agentUsage.findMany({ orderBy: { ultimoUso: "desc" }, take: 5000 }),
  ]);
  const agg = agregarUso(uso, 5);
  const topIds = [...new Set(Object.values(agg).flatMap((a) => a.top.map((t) => t.userId)))];
  const users = topIds.length ? await prisma.user.findMany({ where: { id: { in: topIds } }, select: { id: true, name: true, email: true } }) : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  const agentes = mergeProfiles(rosterComMentores(mentores), profiles).map((a) => {
    const u = agg[a.agentKey];
    return {
      ...a,
      uso: u
        ? { total: u.total, usuarios: u.usuarios, ultimoUso: u.ultimoUso, top: u.top.map((t) => ({ ...t, nome: byId.get(t.userId)?.name ?? null, email: byId.get(t.userId)?.email ?? null })) }
        : { total: 0, usuarios: 0, ultimoUso: null, top: [] },
    };
  });
  return NextResponse.json({ agentes });
}

export async function POST(req: Request) {
  const g = await gate(); if (g) return g;
  const b = await req.json().catch(() => ({}));
  const agentKey = String(b?.agentKey ?? "").trim().toLowerCase();
  if (!isAgentKey(agentKey)) return NextResponse.json({ error: "agentKey inválido (slug minúsculo)." }, { status: 400 });
  const tipo = b?.tipo === "mentor" ? "mentor" : "persona";
  const nome = String(b?.nome ?? "").trim().slice(0, 60);
  if (!nome) return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });
  const avatarUrl = validarAvatar(b?.avatarUrl);
  if (avatarUrl === undefined && b?.avatarUrl !== undefined) return NextResponse.json({ error: "Avatar inválido (data:image/* ou https)." }, { status: 400 });
  const existente = await prisma.agentProfile.findUnique({ where: { agentKey } });
  if (existente) return NextResponse.json({ error: "Já existe um agente com essa chave." }, { status: 409 });

  if (tipo === "mentor") {
    const tpl = await prisma.mentorTemplate.findUnique({ where: { slug: agentKey }, select: { id: true } });
    if (!tpl) {
      const curso = String(b?.curso ?? "").trim().slice(0, 80);
      const personaText = String(b?.personaText ?? "").trim();
      if (!curso || personaText.length < 40) return NextResponse.json({ error: "Mentor novo precisa de curso e personaText (≥ 40 caracteres)." }, { status: 400 });
      await prisma.mentorTemplate.create({
        data: { slug: agentKey, course: curso, name: nome, emoji: "⟁", personaId: agentKey, personaText, enabledSkills: ["memory"], signatureArtifacts: [], sources: [], academicLevel: "graduacao", order: 50 },
      });
    }
  }
  const profile = await prisma.agentProfile.create({
    data: { agentKey, tipo, nome, bio: typeof b?.bio === "string" ? b.bio.trim().slice(0, 240) : null, avatarUrl: avatarUrl ?? null, ativo: b?.ativo !== false, ordem: Number.isFinite(b?.ordem) ? Number(b.ordem) : 0 },
  });
  return NextResponse.json({ profile }, { status: 201 });
}
