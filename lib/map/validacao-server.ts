/**
 * lib/map/validacao-server.ts — as deps REAIS (Prisma, ledger, Solana) do lib/map/validacao.ts,
 * mais os helpers de sessão/vínculo das rotas de validação. Nada aqui é chamado pelo cliente.
 */
import { prisma } from "@/src/lib/prisma";
import { grantAura } from "@/lib/aura/ledger";
import { auraEnabled } from "@/lib/aura/rules";
import { patchMapa } from "@/lib/map/store";
import type { ValidacaoDeps, ValidacaoRow } from "@/lib/map/validacao";

export const OID = /^[a-f0-9]{24}$/i;

export const depsReais = (): ValidacaoDeps => ({
  patchMapa: (id, fn) => patchMapa(id, fn as any) as any,
  grantAura: (i) => grantAura(prisma as any, i),
  issueCredential: async (userId, i) => {
    const m = await import("@/lib/solana/credentials");
    const rec = await m.issueCredential(userId, i);
    return rec ? { id: rec.id } : null;
  },
  validacoes: {
    upsertPendente: async (i) => prisma.mapaValidacao.upsert({
      where: { mapaId_noId_validadorId: { mapaId: i.mapaId, noId: i.noId, validadorId: i.validadorId } },
      create: { ...i, status: "pendente" },
      update: { evidencia: i.evidencia, status: "pendente", comentario: null },
    }) as unknown as ValidacaoRow,
    update: async (id, data) => prisma.mapaValidacao.update({ where: { id }, data }) as unknown as ValidacaoRow,
  },
  professoresDe: async (alunoId) => (await prisma.teacherStudent.findMany({ where: { studentId: alunoId }, select: { teacherId: true } })).map((r) => r.teacherId),
  auraLigada: auraEnabled,
});

/** Quem está logado, como VERIFICADOR potencial. */
export async function verificadorAtual(): Promise<{ id: string; role: string | null; verificadorHabilitado: boolean; temCredencialVerificada: boolean; institution: string | null } | null> {
  const { eu, comoVerificador } = await import("@/lib/aura/academico-server");
  const me = await eu();
  if (!me) return null;
  const v = await comoVerificador(me);
  return { id: me.id, role: me.role, verificadorHabilitado: v.verificadorHabilitado, temCredencialVerificada: v.temCredencialVerificada, institution: me.institution };
}

/** Vínculo professor ↔ aluno (TeacherStudent). Instituição: vínculo = aluno com credencial dela (aproximação do PR1). */
export async function vinculadoAoAluno(validadorId: string, role: string | null, institution: string | null, alunoId: string): Promise<boolean> {
  const r = (role ?? "").toLowerCase();
  if (r === "instituicao" || r === "institution") {
    if (!institution) return false;
    const c = await prisma.academicCredential.count({ where: { userId: alunoId, instituicao: institution, status: "verificado" } });
    return c > 0;
  }
  const v = await prisma.teacherStudent.findUnique({ where: { teacherId_studentId: { teacherId: validadorId, studentId: alunoId } }, select: { id: true } }).catch(() => null);
  return !!v;
}
