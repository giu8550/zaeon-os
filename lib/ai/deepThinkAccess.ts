/**
 * Acesso ao "pensamento profundo" (Gemini Pro) — por plano.
 *
 *   free        : sem profundo.
 *   plus        : 1×/dia (cota diária via User.deepThinkUsedAt).
 *   pro / max   : ilimitado.
 *   override (deepThinkEnabled) ou super admin: ilimitado.
 */
import connectToDatabase from "@/src/lib/db";
import User from "@/src/models/User";
import { isSuperAdmin } from "@/lib/auth/roles";
import { effectivePlan, planCapabilities, type DeepMode, type PlanState } from "@/lib/plans";

export interface DeepStatus { mode: DeepMode; usedToday: boolean }

function sameDay(a?: Date | null, b: Date = new Date()): boolean {
  if (!a) return false;
  const d = new Date(a);
  return d.getFullYear() === b.getFullYear() && d.getMonth() === b.getMonth() && d.getDate() === b.getDate();
}

/** Modo de profundo da conta + se a cota diária já foi usada hoje. */
export async function deepThinkStatus(email?: string | null): Promise<DeepStatus> {
  if (!email) return { mode: "none", usedToday: false };
  try {
    await connectToDatabase();
    const u: any = await User.findOne({ email }).select("role plan plusUntil trialGranted deepThinkEnabled deepThinkUsedAt").lean();
    if (isSuperAdmin({ email, role: u?.role })) return { mode: "unlimited", usedToday: false };
    const state: PlanState = { plan: u?.plan || "free", plusUntil: u?.plusUntil ?? null, trialGranted: !!u?.trialGranted };
    const caps = planCapabilities(effectivePlan(state));
    const mode: DeepMode = caps.deep !== "none" ? caps.deep : (u?.deepThinkEnabled ? "unlimited" : "none");
    return { mode, usedToday: sameDay(u?.deepThinkUsedAt) };
  } catch {
    return isSuperAdmin({ email }) ? { mode: "unlimited", usedToday: false } : { mode: "none", usedToday: false };
  }
}

/** Marca o uso diário (cota do Plus). */
export async function markDeepThinkUsed(email: string): Promise<void> {
  try {
    await connectToDatabase();
    await User.updateOne({ email }, { $set: { deepThinkUsedAt: new Date() } });
  } catch { /* ignore */ }
}

/** Compat: true se a conta PODE usar profundo (qualquer modo != none). */
export async function canDeepThink(email?: string | null): Promise<boolean> {
  return (await deepThinkStatus(email)).mode !== "none";
}
