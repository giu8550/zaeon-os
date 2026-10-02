/** lib/aura/academico-server.ts — helpers SERVER das rotas de credencial acadêmica (sessão, verificador, vínculo). */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { isSuperAdmin } from "@/lib/auth/roles";
import { auraEnabled } from "@/lib/aura/rules";
import { elegibilidade, type Verificador, type Elegibilidade } from "@/lib/aura/academico";

export const OID = /^[a-f0-9]{24}$/i;
export { prisma };

export function exigirFlag(): NextResponse | null {
  return auraEnabled() ? null : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export type Eu = { id: string; email: string; role: string | null; institution: string | null; verificadorHabilitado: boolean; isSuperAdmin: boolean };
export async function eu(): Promise<Eu | null> {
  const s = await getServerSession(authOptions).catch(() => null);
  const email = s?.user?.email;
  if (!email) return null;
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, institution: true, verificadorHabilitado: true } });
  return u ? { id: u.id, email, role: u.role, institution: u.institution, verificadorHabilitado: u.verificadorHabilitado, isSuperAdmin: isSuperAdmin({ email, role: u.role }) } : null;
}

export async function comoVerificador(me: Eu): Promise<Verificador> {
  const temCred = (await prisma.academicCredential.count({ where: { userId: me.id, status: "verificado" } })) > 0;
  return { id: me.id, role: me.role, verificadorHabilitado: me.verificadorHabilitado, temCredencialVerificada: temCred, isSuperAdmin: me.isSuperAdmin };
}

/** Vínculo: professor ↔ aluno (TeacherStudent) ou instituição ↔ credencial emitida por ela. */
export async function vinculado(me: Eu, alvoUserId: string, instituicaoDaCred: string | null): Promise<boolean> {
  const role = (me.role ?? "").toLowerCase();
  if (role === "instituicao" || role === "institution") {
    return !!me.institution && !!instituicaoDaCred && me.institution.trim().toLowerCase() === instituicaoDaCred.trim().toLowerCase();
  }
  const v = await prisma.teacherStudent.findUnique({ where: { teacherId_studentId: { teacherId: me.id, studentId: alvoUserId } }, select: { id: true } }).catch(() => null);
  return !!v;
}

export async function elegivel(me: Eu, alvoUserId: string, instituicaoDaCred: string | null): Promise<Elegibilidade> {
  const v = await comoVerificador(me);
  return elegibilidade(v, alvoUserId, await vinculado(me, alvoUserId, instituicaoDaCred));
}

/** Ids dos alunos que este verificador pode ver na fila. null = instituição (filtra por nome). */
export async function alunosDoVerificador(me: Eu): Promise<string[] | null> {
  const role = (me.role ?? "").toLowerCase();
  if (role === "instituicao" || role === "institution") return null;
  const rows = await prisma.teacherStudent.findMany({ where: { teacherId: me.id }, select: { studentId: true } });
  return rows.map((r) => r.studentId);
}
