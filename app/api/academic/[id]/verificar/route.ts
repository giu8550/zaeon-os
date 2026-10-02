/**
 * POST /api/academic/[id]/verificar { status: "verificado"|"rejeitado", metodo? } — chancela do
 * VERIFICADOR (professor vinculado e habilitado, ou instituição). Verificado → grantAura
 * (credential_verified, 1× por credencial, base do nível pelo método), Credential Solana
 * "academic" (fire-and-forget) e User.academicLevel = maior nível verificado. Rejeitado depois de
 * verificado → reversão (evento negativo). Ninguém verifica a própria (403). Admin só rejeita.
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, eu, exigirFlag, elegivel, OID } from "@/lib/aura/academico-server";
import { metodoPermitido, isStatus } from "@/lib/aura/academico";
import { auraPorCredencial, maiorNivel, ROTULO_NIVEL, isNivelAcademico, type NivelAcademico } from "@/lib/aura/rules";
import { grantAura, reverseAura } from "@/lib/aura/ledger";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const off = exigirFlag(); if (off) return off;
  const me = await eu();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!OID.test(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const c = await prisma.academicCredential.findUnique({ where: { id: params.id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const g = await elegivel(me, c.userId, c.instituicao);
  if (!g.ok) return NextResponse.json({ error: g.motivo === "conflito" ? "Ninguém verifica a própria credencial." : "Forbidden", motivo: g.motivo }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const status = b?.status;
  if (!isStatus(status) || status === "pendente") return NextResponse.json({ error: "status deve ser verificado|rejeitado" }, { status: 400 });
  if (!isNivelAcademico(c.nivel)) return NextResponse.json({ error: "credencial com nível inválido" }, { status: 409 });
  const nivel: NivelAcademico = c.nivel;

  if (status === "verificado") {
    if (c.status === "verificado") return NextResponse.json({ ok: true, jaVerificada: true });
    const metodo = metodoPermitido(g.papel, b?.metodo, !!c.docRef);
    if (!metodo) return NextResponse.json({ error: g.papel === "admin" ? "Admin só modera (rejeitar); quem verifica é professor/instituição." : "Sem documento não há verificação (fica 'declarado')." }, { status: 403 });
    const amount = auraPorCredencial(nivel, metodo);
    const grant = await grantAura(prisma as any, { userId: c.userId, source: "credential_verified", refId: c.id, amount, reason: `Título verificado: ${ROTULO_NIVEL[nivel]}${c.area ? ` em ${c.area}` : ""}` });
    const verificadas = await prisma.academicCredential.findMany({ where: { userId: c.userId, status: "verificado", id: { not: c.id } }, select: { nivel: true } });
    const top = maiorNivel([nivel, ...verificadas.map((v) => v.nivel).filter(isNivelAcademico)] as NivelAcademico[]);
    const upd = await prisma.academicCredential.update({
      where: { id: c.id },
      data: { status: "verificado", metodo, verifiedById: me.id, verifiedAt: new Date(), auraEventId: grant.ok ? grant.eventId : null },
    });
    if (top) await prisma.user.update({ where: { id: c.userId }, data: { academicLevel: ROTULO_NIVEL[top] } }).catch(() => undefined);
    // parede de provas: atestado on-chain (best-effort; nunca segura a resposta)
    void import("@/lib/solana/credentials")
      .then((m) => m.issueCredential(c.userId, { type: "academic", refId: c.id, title: `${ROTULO_NIVEL[nivel]}${c.area ? ` em ${c.area}` : ""}${c.instituicao ? ` — ${c.instituicao}` : ""}`, metadata: { metodo, verifiedById: me.id } }))
      .then((rec) => rec && prisma.academicCredential.update({ where: { id: c.id }, data: { credentialId: rec.id } }))
      .catch(() => undefined);
    return NextResponse.json({ ok: true, status: upd.status, metodo, aura: grant.ok ? { concedida: grant.novo ? grant.amount : 0, saldo: grant.aura, level: grant.level } : null });
  }

  // rejeitado (verificador ou admin em moderação)
  const eraVerificada = c.status === "verificado";
  const rev = eraVerificada ? await reverseAura(prisma as any, { userId: c.userId, source: "credential_verified", refId: c.id, reason: "Verificação revertida" }) : null;
  await prisma.academicCredential.update({ where: { id: c.id }, data: { status: "rejeitado", verifiedById: me.id, verifiedAt: new Date() } });
  if (eraVerificada) {
    const restantes = await prisma.academicCredential.findMany({ where: { userId: c.userId, status: "verificado" }, select: { nivel: true } });
    const top = maiorNivel(restantes.map((v) => v.nivel).filter(isNivelAcademico) as NivelAcademico[]);
    await prisma.user.update({ where: { id: c.userId }, data: { academicLevel: top ? ROTULO_NIVEL[top] : "Graduação" } }).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, status: "rejeitado", revertida: !!(rev && rev.ok && rev.novo) });
}
