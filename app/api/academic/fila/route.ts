/**
 * GET /api/academic/fila?status=pendente — fila do VERIFICADOR (professor vinculado / instituição).
 * Professor vê credenciais dos seus alunos (TeacherStudent); instituição vê as emitidas por ela.
 * Nunca devolve o documento (rota própria, guardada). Marca `docDuplicado`.
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, eu, exigirFlag, comoVerificador, alunosDoVerificador } from "@/lib/aura/academico-server";
import { elegibilidade, isStatus, viewPublica } from "@/lib/aura/academico";

export async function GET(req: Request) {
  const off = exigirFlag(); if (off) return off;
  const me = await eu();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const v = await comoVerificador(me);
  const gate = elegibilidade(v, "", true); // papel/habilitação (o vínculo é por item abaixo)
  if (!gate.ok) return NextResponse.json({ error: "Forbidden", motivo: gate.motivo }, { status: 403 });
  const st = new URL(req.url).searchParams.get("status");
  const status = isStatus(st) ? st : "pendente";
  const alunos = await alunosDoVerificador(me);
  const where = alunos === null
    ? { status, instituicao: { equals: me.institution ?? "\u0000", mode: "insensitive" as const } }
    : { status, userId: { in: alunos } };
  const rows = await prisma.academicCredential.findMany({ where, orderBy: { createdAt: "asc" }, take: 200 });
  const ids = [...new Set(rows.map((r) => r.userId))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } }) : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  const hashes = rows.map((r) => r.docHash).filter((h): h is string => !!h);
  const dup = hashes.length ? await prisma.academicCredential.groupBy({ by: ["docHash"], where: { docHash: { in: hashes } }, _count: { _all: true } }) : [];
  const dupSet = new Set(dup.filter((d) => d._count._all > 1).map((d) => d.docHash));
  return NextResponse.json({
    fila: rows.map((r) => ({ ...viewPublica(r), temDoc: !!r.docRef, docDuplicado: !!r.docHash && dupSet.has(r.docHash), aluno: { id: r.userId, nome: byId.get(r.userId)?.name ?? null, email: byId.get(r.userId)?.email ?? null } })),
    papel: gate.papel,
  });
}
