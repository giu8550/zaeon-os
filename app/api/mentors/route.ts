/**
 * /api/mentors — os MENTORES (termo do produto; não "tutor de IA").
 *   GET  → lista pública (banco; se vazio, o seed em código) — pro seletor de mentor.
 *   POST → SEMEIA/atualiza os 13 a partir de `lib/agent/mentors.ts` (upsert por slug).
 *          Só super-admin. Idempotente: pode rodar de novo após editar o seed.
 *          `?reset=1` sobrescreve também `personaText` editado no banco (default: preserva edições).
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/src/lib/auth";
import { isSuperAdmin } from "@/lib/auth/roles";
import { MENTOR_SEED, degradedSkills } from "@/lib/agent/mentors";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const rows = await prisma.mentorTemplate.findMany({ where: { active: true }, orderBy: { order: "asc" } });
    if (rows.length) return NextResponse.json(rows);
  } catch (e) {
    console.error("MENTORS GET (db):", e);
  }
  // fallback: seed em código (mesma forma pública)
  return NextResponse.json(MENTOR_SEED.map((m) => ({ ...m, active: true, source: "seed" })));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? null;
  if (!session || !isSuperAdmin({ email: session.user?.email, role })) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const reset = new URL(req.url).searchParams.get("reset") === "1";
  const results: { slug: string; op: "created" | "updated"; degraded: string[] }[] = [];
  try {
    for (const m of MENTOR_SEED) {
      const base = {
        course: m.course, name: m.name, emoji: m.emoji, personaId: m.personaId,
        enabledSkills: m.enabledSkills, signatureArtifacts: m.signatureArtifacts, sources: m.sources,
        academicLevel: m.academicLevel, guardrail: m.guardrail ?? null, order: m.order, active: true,
      };
      const existing = await prisma.mentorTemplate.findUnique({ where: { slug: m.slug } });
      if (existing) {
        await prisma.mentorTemplate.update({
          where: { slug: m.slug },
          data: reset ? { ...base, personaText: m.personaText } : base, // preserva personaText editado
        });
        results.push({ slug: m.slug, op: "updated", degraded: degradedSkills(m) });
      } else {
        await prisma.mentorTemplate.create({ data: { slug: m.slug, personaText: m.personaText, ...base } });
        results.push({ slug: m.slug, op: "created", degraded: degradedSkills(m) });
      }
    }
    return NextResponse.json({ ok: true, count: results.length, reset, results });
  } catch (e: any) {
    console.error("MENTORS SEED:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "seed failed", results }, { status: 500 });
  }
}
