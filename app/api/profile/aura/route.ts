/**
 * GET /api/profile/aura — o cartão AURA do PRÓPRIO usuário: saldo (soma do ledger), nível,
 * contadores (nós validados, cérebros completos, habilidades on-chain), credenciais acadêmicas
 * (sem documento), parede de atestados (Credential cunhadas) e eventos recentes.
 * Só o dono (privacidade); flag AURA_ECONOMY (404 desligada).
 */
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma, eu, exigirFlag } from "@/lib/aura/academico-server";
import { levelFromAura } from "@/lib/aura/rules";
import { somaEventos } from "@/lib/aura/ledger";
import { viewPublica } from "@/lib/aura/academico";

export async function GET() {
  const off = exigirFlag(); if (off) return off;
  const me = await eu();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [eventos, academicas, atestados, user, mapas] = await Promise.all([
    prisma.auraEvent.findMany({ where: { userId: me.id }, orderBy: { createdAt: "desc" } }),
    prisma.academicCredential.findMany({ where: { userId: me.id }, orderBy: { createdAt: "desc" } }),
    prisma.credential.findMany({ where: { userId: me.id, status: "issued" }, orderBy: { issuedAt: "desc" }, select: { id: true, type: true, title: true, assetId: true, network: true, issuedAt: true } }),
    prisma.user.findUnique({ where: { id: me.id }, select: { aura: true, academicLevel: true } }),
    // Cérebros do aluno (HANDOFF_CEREBRO_AURA §8 — perfil): título, arquétipo, duas completudes.
    Promise.resolve().then(() => prisma.mapaProbabilistico.findMany({ where: { ownerId: me.id }, orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, titulo: true, tipoTopico: true, modoValidacao: true, completudeAprendizado: true, completudeConclusao: true, backbone: true, updatedAt: true } })).catch(() => [] as never[]),
  ]);
  const aura = somaEventos(eventos);
  const nivel = levelFromAura(aura);
  const conta = (s: string) => eventos.filter((e) => e.source === s).length;
  return NextResponse.json({
    aura, cacheDesatualizado: (user?.aura ?? 0) !== aura, ...nivel,
    validatedSkills: conta("node_validated"),
    completedBrains: conta("brain_completed"),
    learnedNodes: conta("node_learned"),
    academicLevel: user?.academicLevel ?? null,
    habilidadesValidadas: eventos.filter((e) => e.source === "node_validated").map((e) => ({ id: e.id, titulo: e.reason ?? e.refId, at: e.createdAt.toISOString() })),
    cerebros: mapas.map((m) => ({ id: m.id, titulo: m.titulo, tipoTopico: m.tipoTopico, modoValidacao: m.modoValidacao, aprendizado: m.completudeAprendizado, conclusao: m.completudeConclusao, passos: m.backbone.length, completo: m.backbone.length > 0 && m.completudeConclusao >= 1, updatedAt: m.updatedAt.toISOString() })),
    academicas: academicas.map(viewPublica),
    parede: atestados.map((a) => ({ ...a, issuedAt: a.issuedAt ? a.issuedAt.toISOString() : null })),
    recent: eventos.slice(0, 10).map((e) => ({ id: e.id, source: e.source, amount: e.amount, reason: e.reason, at: e.createdAt.toISOString() })),
  });
}
