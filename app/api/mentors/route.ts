/**
 * GET /api/mentors — CATÁLOGO dos Mentores (público p/ logados; não expõe personaText inteiro
 * na lista — só o necessário pro card). Catálogo vazio → semeia os 13 na hora (idempotente),
 * então a Plugin Store funciona sem passo de ops. Edições no banco prevalecem.
 * Semear/atualizar à força: POST /api/mentors/seed (super-admin).
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { MENTOR_SEED, degradedSkills, type MentorSkill } from "@/lib/agent/mentors";
import { ensureMentorSeed } from "@/lib/agent/mentors-server";

const prisma = new PrismaClient();

const pub = (m: any) => ({
  id: m.id, slug: m.slug, course: m.course, name: m.name, emoji: m.emoji,
  enabledSkills: m.enabledSkills, signatureArtifacts: m.signatureArtifacts, sources: m.sources,
  academicLevel: m.academicLevel, guardrail: m.guardrail ?? null, order: m.order,
  tagline: String(m.personaText ?? "").split(/(?<=\.)\s/)[0]?.slice(0, 160) ?? "",
  degradedSkills: degradedSkills({ enabledSkills: (m.enabledSkills ?? []) as MentorSkill[] }),
});

export async function GET() {
  try {
    await ensureMentorSeed(prisma);
    const rows = await prisma.mentorTemplate.findMany({ orderBy: { order: "asc" } });
    return NextResponse.json(rows.map(pub));
  } catch (e) {
    console.error("MENTORS GET (db):", e);
    // sem banco: catálogo do seed (id null → não dá pra plugar, mas a loja não quebra)
    return NextResponse.json(MENTOR_SEED.map((m) => pub({ ...m, id: null })));
  }
}
