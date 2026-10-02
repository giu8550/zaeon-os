/**
 * /api/credentials/academic — credencial ACADÊMICA do próprio usuário.
 *   GET  → as minhas (sem documento).
 *   POST { nivel, area?, instituicao?, doc? } → cria `pendente`. Com documento = metodo "doc_review"
 *        (entra na fila do verificador); sem = "declarado" (0 AURA, badge "não verificado").
 *        Nenhuma AURA aqui — só o verificador paga. docHash detecta diploma reusado.
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, eu, exigirFlag } from "@/lib/aura/academico-server";
import { isNivelAcademico } from "@/lib/aura/rules";
import { docValido, hashDocumento, viewPublica } from "@/lib/aura/academico";

export async function GET() {
  const off = exigirFlag(); if (off) return off;
  const me = await eu();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.academicCredential.findMany({ where: { userId: me.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ credenciais: rows.map(viewPublica) });
}

export async function POST(req: Request) {
  const off = exigirFlag(); if (off) return off;
  const me = await eu();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!isNivelAcademico(b?.nivel)) return NextResponse.json({ error: "nivel inválido" }, { status: 400 });
  const area = typeof b?.area === "string" ? b.area.trim().slice(0, 120) || null : null;
  const instituicao = typeof b?.instituicao === "string" ? b.instituicao.trim().slice(0, 160) || null : null;
  let docRef: string | null = null, docHash: string | null = null;
  if (b?.doc !== undefined && b?.doc !== null && b?.doc !== "") {
    if (!docValido(b.doc)) return NextResponse.json({ error: "Documento inválido (PDF/PNG/JPG/WebP até 4MB)." }, { status: 400 });
    docRef = b.doc; docHash = hashDocumento(b.doc);
  }
  const duplicado = docHash ? (await prisma.academicCredential.count({ where: { docHash, userId: { not: me.id } } })) > 0 : false;
  const row = await prisma.academicCredential.create({
    data: { userId: me.id, nivel: b.nivel, area, instituicao, docRef, docHash, metodo: docRef ? "doc_review" : "declarado", status: "pendente" },
  });
  return NextResponse.json({ credencial: viewPublica(row), aviso: duplicado ? "Este documento já foi enviado por outra conta — o verificador será avisado." : null }, { status: 201 });
}
