// Planos no web (espelha agent-gateway/app/engines/plans.py). Lógica pura.

export type Plan = "free" | "plus";

export const STUDENT_TRIAL_DAYS = 30;

export interface PlanState {
  plan: Plan;
  plusUntil: Date | null;
  trialGranted: boolean;
}

export function effectivePlan(s: PlanState, now: Date = new Date()): Plan {
  if (s.plan === "plus" && s.plusUntil && now > s.plusUntil) return "free";
  return s.plan;
}

export function daysLeft(s: PlanState, now: Date = new Date()): number | null {
  if (!s.plusUntil) return null;
  const ms = s.plusUntil.getTime() - now.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Concede o Plus de estudante (idempotente). Retorna novo estado. */
export function grantStudentTrial(
  s: PlanState, now: Date = new Date(), days: number = STUDENT_TRIAL_DAYS,
): PlanState {
  if (s.trialGranted) return s;
  let until = new Date(now.getTime() + days * 86_400_000);
  if (s.plusUntil && s.plusUntil > until) until = s.plusUntil;
  return { plan: "plus", plusUntil: until, trialGranted: true };
}

/** WhatsApp e busca avançada são exclusivos do Plus. */
export function whatsappEnabled(s: PlanState, now?: Date): boolean {
  return effectivePlan(s, now) === "plus";
}
