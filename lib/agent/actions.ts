"use client";

/**
 * Action bus — o plano de passos que a Zaeon EXECUTA visivelmente (Fase 2).
 *
 * A Zaeon (servidor) devolve um `plan: AgentStep[]` (abrir sala → executar → pronto).
 * O AgentActionRunner (no widget) consome este store e mostra os passos rodando um a
 * um, com narração por TTS no modo voz. Como o plano vem da RESPOSTA do servidor —
 * a mesma pra texto, áudio e ligação — a experiência é uniforme entre os modos.
 *
 * Store em memória + evento de sync (mesmo padrão de mission.ts), sem persistência:
 * é um fluxo de execução efêmero, não estado durável (esse é o AgentContext).
 */
import { useEffect, useState } from "react";

export type StepKind = "navigate" | "create" | "type" | "say" | "done";
export type StepStatus = "pending" | "running" | "done" | "error";

export type AgentStep = {
  kind: StepKind;
  label: string;          // texto humano exibido no cockpit ("Abrindo a Sala de Estudos")
  detail?: string;        // ex.: o que está sendo "digitado" (o tópico)
  route?: string;         // p/ navigate
  skill?: string;         // p/ create (study|research|write|code)
  topic?: string;         // p/ create
  status?: StepStatus;
};

export type AgentPlan = { id: string; steps: AgentStep[]; index: number; active: boolean } | null;

const EVT = "zaeon:agent-plan";
let plan: AgentPlan = null;
const listeners = new Set<(p: AgentPlan) => void>();

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVT));
  for (const l of listeners) l(plan);
}

export function getPlan(): AgentPlan {
  return plan;
}

/** Inicia um novo plano (substitui qualquer um em andamento). */
export function startPlan(steps: AgentStep[]): AgentPlan {
  const safe = (Array.isArray(steps) ? steps : [])
    .filter((s) => s && typeof s.label === "string")
    .map((s) => ({ ...s, status: "pending" as StepStatus }));
  if (!safe.length) return null;
  plan = { id: String(Date.now()), steps: safe, index: 0, active: true };
  emit();
  return plan;
}

/** Marca o status do passo no índice atual e avança o ponteiro. */
export function setStepStatus(index: number, status: StepStatus) {
  if (!plan || !plan.steps[index]) return;
  plan = { ...plan, steps: plan.steps.map((s, i) => (i === index ? { ...s, status } : s)) };
  emit();
}

export function advancePlan() {
  if (!plan) return;
  const next = plan.index + 1;
  plan = { ...plan, index: next, active: next < plan.steps.length };
  emit();
}

export function finishPlan() {
  if (!plan) return;
  plan = { ...plan, active: false };
  emit();
  const id = plan.id;
  setTimeout(() => { if (plan && plan.id === id) { plan = null; emit(); } }, 4000); // some sozinho
}

export function clearPlan() { plan = null; emit(); }

export function usePlan(): AgentPlan {
  const [p, setP] = useState<AgentPlan>(getPlan());
  useEffect(() => {
    const h = () => setP(getPlan());
    listeners.add(setP);
    window.addEventListener(EVT, h);
    return () => { listeners.delete(setP); window.removeEventListener(EVT, h); };
  }, []);
  return p;
}
