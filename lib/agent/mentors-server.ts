/**
 * lib/agent/mentors-server.ts — lado SERVER dos Mentores (Prisma). Sem UI, sem rede externa.
 *
 * - `ensureMentorSeed`: catálogo vazio → cria os 13 a partir do seed em código (idempotente).
 * - `resolveMentor`: por `mentorId` (ObjectId do MentorTemplate) ou slug → bloco pronto pro
 *   `systemContext` + o `wing` da memória (`<slug>/<userId>`). Banco primeiro (editável), seed
 *   como fallback — o chat nunca fica sem persona por causa de DB.
 * - `mentorWing`: o andar de memória do mentor — isola o recall/escrita por mentor E por usuário.
 */
import type { PrismaClient } from "@prisma/client";
import { MENTOR_SEED, mentorBySlug, mentorSystemContext, isMentorSlug, type MentorLike } from "@/lib/agent/mentors";
import type { Wing } from "@/lib/agent/memory";

export const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
export const isObjectId = (v: unknown): v is string => typeof v === "string" && OBJECT_ID_RE.test(v);

const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);

/** Catálogo vazio → semeia os 13. Chamado lazy pelo GET /api/mentors e pelo POST /seed. */
export async function ensureMentorSeed(prisma: PrismaClient): Promise<number> {
  const n = await prisma.mentorTemplate.count();
  if (n > 0) return 0;
  await prisma.mentorTemplate.createMany({
    data: MENTOR_SEED.map((m) => ({
      slug: m.slug, course: m.course, name: m.name, emoji: m.emoji, personaId: m.personaId,
      personaText: m.personaText, enabledSkills: m.enabledSkills, signatureArtifacts: m.signatureArtifacts,
      sources: m.sources, academicLevel: m.academicLevel, guardrail: m.guardrail ?? null, order: m.order,
    })),
  });
  return MENTOR_SEED.length;
}

/**
 * Slug é a CHAVE pública dos mentores (payload: `mentor:"farmacia"`, `{ slug }` nas APIs).
 * Resolve slug → MentorTemplate.id (semeando o catálogo se vazio). `templateId` (ObjectId)
 * é aceito como fallback. null = não é mentor.
 */
export async function templateIdFrom(prisma: PrismaClient, body: any): Promise<{ id: string; slug: string } | null> {
  const slug = body?.slug ?? body?.mentor;
  if (isMentorSlug(slug)) {
    await ensureMentorSeed(prisma);
    const t = await prisma.mentorTemplate.findUnique({ where: { slug }, select: { id: true, slug: true } });
    return t ?? null;
  }
  if (isObjectId(body?.templateId)) {
    const t = await prisma.mentorTemplate.findUnique({ where: { id: body.templateId }, select: { id: true, slug: true } });
    return t ?? null;
  }
  return null;
}

export type ResolvedMentor = { id: string | null; slug: string; name: string; context: string; wing: Wing };

/** Andar de memória do mentor: isola por mentor E por usuário (outra conta nunca vê). */
export function mentorWing(slug: string, userId: string | null | undefined): Wing {
  return { kind: "agente", label: userId ? `${slug}/${userId}` : slug };
}

function fromRow(row: any): MentorLike & { slug: string } {
  return {
    slug: String(row.slug),
    name: String(row.name),
    course: String(row.course),
    personaText: String(row.personaText),
    signatureArtifacts: asStrArr(row.signatureArtifacts),
    academicLevel: row.academicLevel === "pos" ? "pos" : "graduacao",
    guardrail: row.guardrail ? String(row.guardrail) : undefined,
  };
}

/**
 * Resolve o mentor ativo do turno. Aceita ObjectId (contrato oficial: `mentorId`) ou slug
 * (retrocompat). Banco → seed. Devolve null se não é mentor (o chat segue como Aura base).
 */
export async function resolveMentor(ref: unknown, userId: string | null | undefined): Promise<ResolvedMentor | null> {
  let row: any = null;
  let seed = null as ReturnType<typeof mentorBySlug> | null;
  if (isObjectId(ref) || isMentorSlug(ref)) {
    try {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      try {
        row = isObjectId(ref)
          ? await prisma.mentorTemplate.findUnique({ where: { id: ref } })
          : await prisma.mentorTemplate.findUnique({ where: { slug: ref } });
      } finally {
        await prisma.$disconnect().catch(() => {});
      }
    } catch { row = null; } // sem DB/client → seed
    if (!row && isMentorSlug(ref)) seed = mentorBySlug(ref) ?? null;
  }
  const m = row ? fromRow(row) : seed;
  if (!m) return null;
  return { id: row?.id ?? null, slug: m.slug, name: m.name, context: mentorSystemContext(m), wing: mentorWing(m.slug, userId) };
}
