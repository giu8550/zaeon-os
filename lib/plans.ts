// Planos da Zaeon — lógica pura (sem IO). Fonte única da matriz de limites.
//
// Tiers: free → plus → pro → max.
//   free  : Sala de Pesquisa = 1 trabalho no total (um entre relatório, artigo ou TCC, vitalício);
//           sem voz; sem profundo; Estudos livre.
//   plus  : Pesquisa ilimitada; voz; profundo 1x/dia; Estudos livre.   (R$20 estud. · R$80)
//   pro   : tudo do plus + profundo ilimitado + aba Projetos.          (R$90)
//   max   : tudo do pro + ferramentas personalizadas.                  (R$250)
// Sala de Estudos é SEMPRE livre (todos os tiers). Projetos: pro/max OU liberado pelo admin.

export type Plan = "free" | "plus" | "pro" | "max";
export type DeepMode = "none" | "daily" | "unlimited";

export const STUDENT_TRIAL_DAYS = 30;
export const FREE_RESEARCH_TOTAL = 1; // free: 1 trabalho no total (não é 1 de cada)
export const WORK_TYPES = ["relatorio", "artigo", "tcc"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export interface PlanState {
  plan: Plan;
  plusUntil: Date | null;
  trialGranted: boolean;
}

export interface Capabilities {
  researchUnlimited: boolean; // Sala de Pesquisa sem limite de trabalhos
  voice: boolean;             // Modo Voz Avançado
  deep: DeepMode;             // Pensamento Profundo
  projects: boolean;          // aba Projetos (Zaeon Code) pelo plano
}

/** Ordem canônica dos tiers (free < plus < pro < max). Base do gating por `minPlan`. */
export const PLAN_ORDER: Plan[] = ["free", "plus", "pro", "max"];
/** Rank numérico do plano (free=0 … max=3). Usado pelo permit() do runtime das tools. */
export function planRank(p?: string | null): number {
  return PLAN_ORDER.indexOf(normalizePlan(p));
}
/** `true` se `plan` cobre (>=) o `minPlan` exigido. Comparador único de tier. */
export function planAtLeast(plan: string | null | undefined, minPlan: Plan): boolean {
  return planRank(plan) >= planRank(minPlan);
}

/** Normaliza valores antigos/desconhecidos. "pulse" (nome antigo) vira "plus". */
export function normalizePlan(p?: string | null): Plan {
  if (p === "plus" || p === "pro" || p === "max") return p;
  if (p === "pulse") return "plus";
  return "free";
}

/** Plano efetivo: se o pago expirou (plusUntil no passado), cai para free. */
export function effectivePlan(s: PlanState, now: Date = new Date()): Plan {
  const plan = normalizePlan(s.plan);
  if (plan !== "free" && s.plusUntil && now > s.plusUntil) return "free";
  return plan;
}

export function planCapabilities(plan: Plan): Capabilities {
  switch (plan) {
    case "max":
    case "pro":
      return { researchUnlimited: true, voice: true, deep: "unlimited", projects: true };
    case "plus":
      return { researchUnlimited: true, voice: true, deep: "daily", projects: false };
    default:
      return { researchUnlimited: false, voice: false, deep: "none", projects: false };
  }
}

export function daysLeft(s: PlanState, now: Date = new Date()): number | null {
  if (!s.plusUntil) return null;
  const ms = s.plusUntil.getTime() - now.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Concede o trial de estudante (Pulse, idempotente). Retorna novo estado. */
export function grantStudentTrial(
  s: PlanState, now: Date = new Date(), days: number = STUDENT_TRIAL_DAYS,
): PlanState {
  if (s.trialGranted) return s;
  let until = new Date(now.getTime() + days * 86_400_000);
  if (s.plusUntil && s.plusUntil > until) until = s.plusUntil;
  return { plan: "plus", plusUntil: until, trialGranted: true };
}

/** Recursos exclusivos de pago (ex.: WhatsApp/busca avançada). */
export function whatsappEnabled(s: PlanState, now?: Date): boolean {
  return effectivePlan(s, now) !== "free";
}

// Metadados p/ a página Sobre Nós e os cartões de upgrade (estilo Zaeon).
export const PLAN_INFO: { id: Plan; name: string; price: string; tagline: string; perks: string[] }[] = [
  {
    id: "free", name: "Free", price: "Grátis", tagline: "Para começar",
    perks: ["Sala de Estudos ilimitada", "Sala de Pesquisa: 1 trabalho (relatório, artigo ou TCC)", "Sem modo voz", "Sem pensamento profundo"],
  },
  {
    id: "plus", name: "Plus", price: "R$20 estudante · R$80", tagline: "O dia a dia acadêmico",
    perks: ["Sala de Pesquisa ilimitada", "Modo Voz Avançado", "Pensamento Profundo 1×/dia", "Sala de Estudos ilimitada"],
  },
  {
    id: "pro", name: "Pro", price: "R$90", tagline: "Para quem produz muito",
    perks: ["Tudo do Plus", "Pensamento Profundo ilimitado", "Aba Projetos (Zaeon Code)", "Voz avançada"],
  },
  {
    id: "max", name: "Max", price: "R$250", tagline: "O arsenal completo",
    perks: [
      "Tudo do Pro",
      "Melhor de vários: a Aura gera vários rascunhos e entrega o melhor",
      "Geração científica pesada sob demanda — moléculas, proteínas, simulações",
      "Agentes com skills avançadas + ferramentas personalizadas",
      "Prioridade no suporte",
    ],
  },
];
