/**
 * lib/solana/achievements.ts — prova de que a conquista existe ANTES de emitir por rota.
 *
 * POST /api/credentials/issue é chamado pelo cliente; o servidor nunca confia no título/refId
 * do body: resolve a conquista no Mongo (dono = userId da sessão) e monta título + evidência.
 * mentor-cert NÃO é auto-serviço (só gancho server-side do TutorEval, camada mestra §3.7).
 */
import { prisma } from "@/src/lib/prisma";
import type { CredentialType } from "./config";

export type Achievement = { title: string; metadata: Record<string, unknown> };
export type AchievementResult = { ok: true; achievement: Achievement } | { ok: false; reason: string; status: 403 | 404 };

const MASTERED_RANKS = new Set(["S", "SS"]);

export async function verifyAchievement(userId: string, type: CredentialType, refId: string): Promise<AchievementResult> {
  if (type === "mentor-cert") return { ok: false, reason: "certificação de mentor é emitida pelo TutorEval, não por auto-serviço", status: 403 };

  if (type === "course") {
    const progress = await prisma.aulaProgress.findFirst({ where: { aulaId: refId, studentId: userId }, select: { status: true, readingMs: true, updatedAt: true } });
    if (!progress) return { ok: false, reason: "aula não encontrada pra este aluno", status: 404 };
    if (progress.status !== "completed") return { ok: false, reason: "aula ainda não concluída", status: 403 };
    const aula = await prisma.aula.findUnique({ where: { id: refId }, select: { title: true, turmaId: true } });
    const quiz = await prisma.aulaQuiz.findUnique({ where: { aulaId: refId }, select: { id: true } }).catch(() => null);
    const best = quiz
      ? await prisma.aulaQuizSubmission.findFirst({
          where: { studentId: userId, quizId: quiz.id },
          orderBy: { percentage: "desc" },
          select: { percentage: true, passed: true },
        }).catch(() => null)
      : null;
    return {
      ok: true,
      achievement: {
        title: aula?.title?.trim() || "Aula concluída",
        metadata: {
          source: "aulas",
          aulaId: refId,
          turmaId: aula?.turmaId ?? null,
          readingMs: progress.readingMs,
          completedAt: progress.updatedAt,
          bestScorePct: best?.percentage ?? null,
        },
      },
    };
  }

  if (type === "work") {
    const work = await prisma.researchWork.findFirst({ where: { id: refId, userId }, select: { title: true, workType: true, updatedAt: true, content: true } });
    if (!work) return { ok: false, reason: "trabalho não encontrado", status: 404 };
    return {
      ok: true,
      achievement: {
        title: work.title?.trim() || "Trabalho de pesquisa",
        metadata: { source: "research-lab", researchWorkId: refId, workType: work.workType, chars: work.content?.length ?? 0, finalizedAt: work.updatedAt },
      },
    };
  }

  // skill: até o PR da skill-tree ter modelo próprio, a fonte é User.skills (Json, ranks F–SS):
  // nó dominado = `mastered: true` OU rank S/SS.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { skills: true } });
  const skills = (user?.skills && typeof user.skills === "object" ? (user.skills as Record<string, any>) : {}) ?? {};
  const node = skills[refId];
  if (!node) return { ok: false, reason: "nó de habilidade não encontrado", status: 404 };
  const mastered = node.mastered === true || MASTERED_RANKS.has(String(node.rank || "").toUpperCase());
  if (!mastered) return { ok: false, reason: "nó ainda não dominado", status: 403 };
  return {
    ok: true,
    achievement: {
      title: String(node.title || node.name || node.metricName || refId),
      metadata: { source: "skill-tree", nodeId: refId, rank: node.rank ?? null, current: node.current ?? null, next: node.next ?? null },
    },
  };
}
