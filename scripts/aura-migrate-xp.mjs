/**
 * scripts/aura-migrate-xp.mjs — migração ÚNICA e idempotente: User.xp → AuraEvent(legacy_xp).
 *   node --env-file=.env scripts/aura-migrate-xp.mjs            # aplica
 *   node --env-file=.env scripts/aura-migrate-xp.mjs --dry-run  # só conta
 * Para cada usuário com xp > 0: 1 evento (userId,"legacy_xp",userId) com amount=xp (o unique
 * garante que rodar 2× não paga 2×); depois recalcula User.aura/level pela soma do ledger.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const dry = process.argv.includes("--dry-run");
const NIVEIS = [0, 150, 400, 900, 1800, 3600];
const level = (a) => NIVEIS.reduce((l, min, i) => (a >= min ? i + 1 : l), 1);

const users = await prisma.user.findMany({ where: { xp: { gt: 0 } }, select: { id: true, xp: true } });
let criados = 0, pulados = 0;
for (const u of users) {
  const ja = await prisma.auraEvent.findUnique({ where: { userId_source_refId: { userId: u.id, source: "legacy_xp", refId: u.id } } });
  if (ja) { pulados++; continue; }
  if (!dry) await prisma.auraEvent.create({ data: { userId: u.id, source: "legacy_xp", refId: u.id, amount: u.xp, reason: "Migração do XP legado" } });
  criados++;
}
let recomputados = 0;
if (!dry) {
  const todos = await prisma.auraEvent.groupBy({ by: ["userId"], _sum: { amount: true } });
  for (const t of todos) {
    const aura = Math.max(0, t._sum.amount ?? 0);
    await prisma.user.update({ where: { id: t.userId }, data: { aura, level: level(aura) } }).catch(() => null);
    recomputados++;
  }
}
console.log(JSON.stringify({ dry, usuariosComXp: users.length, eventosCriados: criados, jaMigrados: pulados, recomputados }));
await prisma.$disconnect();
