/**
 * lib/mentors/limite.ts — teto de CONTRATAÇÃO de mentores por papel (PURO).
 * Aluno = 3; professor (teacher/professor/admin) = 10. Enforçado em POST /api/mentors/plug.
 */
import { isTeacherSession } from "@/lib/aulas/roles";

export const LIMITE_ALUNO = 3;
export const LIMITE_PROFESSOR = 10;

export function limiteContratacao(session: unknown): number {
  return isTeacherSession(session) ? LIMITE_PROFESSOR : LIMITE_ALUNO;
}

export function podeContratar(ativos: number, limite: number): boolean {
  return ativos < limite;
}

export function mensagemTeto(limite: number): string {
  return `Você já contratou seus ${limite} mentores — solte um para contratar outro.`;
}
