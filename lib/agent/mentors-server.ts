/**
 * lib/agent/mentors-server.ts — resolver SERVER-ONLY do mentor ativo.
 *
 * Prefere a linha EDITÁVEL do banco (`MentorTemplate`, upsert via POST /api/mentors) e
 * cai no seed em código (`mentors.ts`) se a coleção estiver vazia/indisponível — assim
 * o chat nunca fica sem persona por causa de DB, e o admin pode ajustar texto sem deploy.
 * Import tardio do Prisma: quem só precisa do seed (testes, cliente) não carrega o client.
 */
import { mentorBySlug, mentorSystemContext, isMentorSlug, type MentorLike } from "@/lib/agent/mentors";

const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);

async function fromDb(slug: string): Promise<MentorLike | null> {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const row: any = await prisma.mentorTemplate.findUnique({ where: { slug } });
      if (!row || row.active === false) return null;
      return {
        name: String(row.name),
        course: String(row.course),
        personaText: String(row.personaText),
        signatureArtifacts: asStrArr(row.signatureArtifacts),
        academicLevel: row.academicLevel === "pos" ? "pos" : "graduacao",
        guardrail: row.guardrail ? String(row.guardrail) : undefined,
      };
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  } catch {
    return null; // sem DB / sem client gerado → seed
  }
}

/** Bloco pronto pro `systemContext` — ou null se o slug não é um mentor. */
export async function resolveMentorContext(slug: unknown): Promise<string | null> {
  if (!isMentorSlug(slug)) return null;
  const m = (await fromDb(slug)) ?? mentorBySlug(slug);
  return m ? mentorSystemContext(m) : null;
}
