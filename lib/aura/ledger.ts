/**
 * lib/aura/ledger.ts — o livro-razão AURA (server, Prisma injetável).
 *   grantAura   → grava 1 AuraEvent idempotente por (userId,source,refId) e soma no cache User.aura
 *                 (+ level derivado). Já existe = no-op. Soft-cap diário nas fontes de baixo rigor.
 *   reverseAura → evento NEGATIVO (source "reversal", refId "<source>:<refId>") — nunca apaga.
 *   recomputeAura → soma do ledger → regrava User.aura/level (auto-cura do cache).
 * Nada aqui é chamado pelo cliente: só pelos hooks server-side (skilltree, validação, credenciais).
 */
import { AURA, type AuraSource, dentroDoCapDiario, levelFromAura } from "@/lib/aura/rules";

export type AuraEventRow = { id: string; userId: string; source: string; refId: string; amount: number; reason: string | null; createdAt: Date };

export type LedgerDb = {
  auraEvent: {
    findUnique(a: { where: { userId_source_refId: { userId: string; source: string; refId: string } } }): Promise<AuraEventRow | null>;
    create(a: { data: { userId: string; source: string; refId: string; amount: number; reason: string | null } }): Promise<AuraEventRow>;
    count(a: { where: { userId: string; source: string; createdAt?: { gte: Date } } }): Promise<number>;
    findMany(a: { where: { userId: string }; orderBy?: { createdAt: "desc" | "asc" }; take?: number; select?: unknown }): Promise<AuraEventRow[]>;
  };
  user: {
    update(a: { where: { id: string }; data: { aura: { increment: number } | number; level: number } }): Promise<unknown>;
  };
};

export type GrantInput = { userId: string; source: AuraSource; refId: string; amount?: number; reason?: string | null; agora?: Date };
export type GrantResult =
  | { ok: true; novo: boolean; amount: number; aura: number; level: number; eventId: string | null }
  | { ok: false; motivo: "invalido" | "cap_diario" | "erro"; erro?: string };

const OID = /^[a-f0-9]{24}$/i;
const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function amountPadrao(source: AuraSource): number | undefined {
  return source in AURA ? AURA[source as keyof typeof AURA] : undefined;
}

/** Concede AURA 1× por conquista. Rejeita amount ≤ 0 (reversão tem função própria). */
export async function grantAura(db: LedgerDb, input: GrantInput): Promise<GrantResult> {
  const { userId, source, refId } = input;
  const amount = input.amount ?? amountPadrao(source);
  if (!OID.test(userId || "") || !refId || !source || source === "reversal" || !Number.isInteger(amount) || (amount as number) <= 0) return { ok: false, motivo: "invalido" };
  try {
    const existente = await db.auraEvent.findUnique({ where: { userId_source_refId: { userId, source, refId } } });
    if (existente) {
      const total = await somaLedger(db, userId);
      return { ok: true, novo: false, amount: existente.amount, aura: total, level: levelFromAura(total).level, eventId: existente.id };
    }
    const agora = input.agora ?? new Date();
    const hoje = await db.auraEvent.count({ where: { userId, source, createdAt: { gte: inicioDoDia(agora) } } });
    if (!dentroDoCapDiario(source, hoje)) return { ok: false, motivo: "cap_diario" };
    let ev: AuraEventRow;
    try {
      ev = await db.auraEvent.create({ data: { userId, source, refId, amount: amount as number, reason: input.reason ?? null } });
    } catch (e: any) {
      if (e?.code === "P2002") { // corrida: outro grant gravou primeiro → idempotente
        const again = await db.auraEvent.findUnique({ where: { userId_source_refId: { userId, source, refId } } });
        const total = await somaLedger(db, userId);
        return { ok: true, novo: false, amount: again?.amount ?? (amount as number), aura: total, level: levelFromAura(total).level, eventId: again?.id ?? null };
      }
      throw e;
    }
    const total = await somaLedger(db, userId);
    const { level } = levelFromAura(total);
    await db.user.update({ where: { id: userId }, data: { aura: total, level } });
    return { ok: true, novo: true, amount: ev.amount, aura: total, level, eventId: ev.id };
  } catch (e) {
    console.warn("[aura] grant falhou:", (e as Error)?.message);
    return { ok: false, motivo: "erro", erro: String((e as Error)?.message ?? e) };
  }
}

/** Reversão auditável: evento negativo do mesmo valor, 1× por conquista original. */
export async function reverseAura(db: LedgerDb, input: { userId: string; source: AuraSource; refId: string; reason?: string | null }): Promise<GrantResult> {
  const { userId, source, refId } = input;
  if (!OID.test(userId || "") || !refId || source === "reversal") return { ok: false, motivo: "invalido" };
  try {
    const original = await db.auraEvent.findUnique({ where: { userId_source_refId: { userId, source, refId } } });
    if (!original) return { ok: false, motivo: "invalido" };
    const revRef = `${source}:${refId}`;
    const ja = await db.auraEvent.findUnique({ where: { userId_source_refId: { userId, source: "reversal", refId: revRef } } });
    if (ja) { const t = await somaLedger(db, userId); return { ok: true, novo: false, amount: ja.amount, aura: t, level: levelFromAura(t).level, eventId: ja.id }; }
    const ev = await db.auraEvent.create({ data: { userId, source: "reversal", refId: revRef, amount: -original.amount, reason: input.reason ?? `Reversão de ${source}` } });
    const total = await somaLedger(db, userId);
    const { level } = levelFromAura(total);
    await db.user.update({ where: { id: userId }, data: { aura: total, level } });
    return { ok: true, novo: true, amount: ev.amount, aura: total, level, eventId: ev.id };
  } catch (e) {
    return { ok: false, motivo: "erro", erro: String((e as Error)?.message ?? e) };
  }
}

/** Soma PURA de uma lista de eventos (nunca negativa no total exibido). */
export function somaEventos(rows: { amount: number }[]): number {
  return Math.max(0, rows.reduce((s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0), 0));
}

async function somaLedger(db: LedgerDb, userId: string): Promise<number> {
  const rows = await db.auraEvent.findMany({ where: { userId }, select: { amount: true } });
  return somaEventos(rows);
}

/** Auto-cura: soma do ledger → cache. Devolve o saldo. */
export async function recomputeAura(db: LedgerDb, userId: string): Promise<{ aura: number; level: number }> {
  const aura = await somaLedger(db, userId);
  const { level } = levelFromAura(aura);
  await db.user.update({ where: { id: userId }, data: { aura, level } });
  return { aura, level };
}

// ───────────── ganchos prontos pras transições do mapa (PR2) e do skilltree ─────────────
export const grantNodeLearned = (db: LedgerDb, userId: string, nodeId: string, reason?: string) => grantAura(db, { userId, source: "node_learned", refId: nodeId, reason });
export const grantNodeApplied = (db: LedgerDb, userId: string, nodeId: string, reason?: string) => grantAura(db, { userId, source: "node_applied", refId: nodeId, reason });
export const grantNodeValidated = (db: LedgerDb, userId: string, mapaId: string, noId: string, reason?: string) => grantAura(db, { userId, source: "node_validated", refId: `${mapaId}:${noId}`, reason });
export const grantBrainCompleted = (db: LedgerDb, userId: string, mapaId: string, reason?: string) => grantAura(db, { userId, source: "brain_completed", refId: mapaId, reason });
