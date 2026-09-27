/**
 * POST /api/mentors/seed — SEMEIA/atualiza os 13 a partir de `lib/agent/mentors.ts` (upsert
 * por slug). Só super-admin. Idempotente. Preserva `personaText` editado no banco;
 * `?reset=1` sobrescreve com o seed. Devolve, por mentor, as skills que degradam no runtime.
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/src/lib/auth";
import { isSuperAdmin } from "@/lib/auth/roles";
import { MENTOR_SEED, degradedSkills } from "@/lib/agent/mentors";

const prisma = new PrismaClient();

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
        academicLevel: m.academicLevel, guardrail: m.guardrail ?? null, order: m.order,
      };
      const existing = await prisma.mentorTemplate.findUnique({ where: { slug: m.slug } });
      if (existing) {
        await prisma.mentorTemplate.update({ where: { slug: m.slug }, data: reset ? { ...base, personaText: m.personaText } : base });
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
