/**
 * lib/solana/hooks.ts — ganchos fire-and-forget: TODA conquista → Solana, sem bloquear nada.
 *
 * Cada função devolve na hora; o mint acontece atrás. Nunca lança (issueCredential já não lança;
 * aqui só garantimos que uma promise rejeitada não vira unhandledRejection).
 *
 * Onde plugar:
 *  - onSkillMastered      → skill-tree, ao marcar nó `mastered` (PR skill-tree chama isto).
 *  - onWorkFinalized      → Research Lab, ao exportar/publicar o trabalho (abnt-export).
 *  - onCourseCompleted    → Aulas, ao AulaProgress virar "completed" (submit/progress).
 *  - onMentorCertified    → camada mestra §3.7, ao passar no TutorEval (token-2022 non-transferable).
 */
import { issueCredential, type IssueInput } from "./credentials";

type Meta = Record<string, unknown> | null | undefined;

function fire(userId: string, input: IssueInput) {
  try {
    void issueCredential(userId, input).catch((e) => console.warn("[credentials hook]", e));
  } catch (e) {
    console.warn("[credentials hook]", e);
  }
}

export function onSkillMastered(userId: string, nodeId: string, title: string, metadata?: Meta) {
  fire(userId, { type: "skill", refId: nodeId, title, metadata: { source: "skill-tree", nodeId, ...(metadata ?? {}) } });
}

export function onWorkFinalized(userId: string, workId: string, title: string, metadata?: Meta) {
  fire(userId, { type: "work", refId: workId, title, metadata: { source: "research-lab", researchWorkId: workId, ...(metadata ?? {}) } });
}

export function onCourseCompleted(userId: string, aulaId: string, title: string, metadata?: Meta) {
  fire(userId, { type: "course", refId: aulaId, title, metadata: { source: "aulas", aulaId, ...(metadata ?? {}) } });
}

/** Alto valor → token-2022 non-transferable (soulbound forte). */
export function onMentorCertified(userId: string, certId: string, title: string, metadata?: Meta) {
  fire(userId, { type: "mentor-cert", refId: certId, title, standard: "token2022-nt", metadata: { source: "tutor-eval", mentorCertId: certId, ...(metadata ?? {}) } });
}
