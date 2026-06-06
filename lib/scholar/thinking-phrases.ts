// Sequência de "raciocínio" para o loading da geração de sugestão/prereqs.
// Como esses fluxos são 1 POST (não-stream), as fases são SIMULADAS no tempo,
// mas sequenciadas para dar a sensação de a IA realmente pensando.

export interface ThinkingStep {
  icon: string;
  label: string;
}

export const THINKING_STEPS: ThinkingStep[] = [
  { icon: "⟁", label: "interpolando dados" },
  { icon: "⊹", label: "cruzando referências" },
  { icon: "✶", label: "mapeando lacunas" },
  { icon: "◇", label: "avaliando viabilidade" },
  { icon: "✦", label: "calibrando originalidade" },
  { icon: "◷", label: "estimando bolsa e prazo" },
  { icon: "✎", label: "redigindo a proposta" },
];

const STEP_MS = 1100;

/** Estado da animação de "pensamento" em função do tempo decorrido. */
export function thinkingState(
  elapsedMs: number,
  opts?: { stepMs?: number }
): { index: number; progress: number; step: ThinkingStep } {
  const stepMs = opts?.stepMs ?? STEP_MS;
  const total = THINKING_STEPS.length * stepMs;
  const e = Math.max(0, elapsedMs);
  const index = Math.min(THINKING_STEPS.length - 1, Math.floor(e / stepMs));
  const progress = Math.min(0.95, e / total); // assintótico — nunca "completa" sem o resultado real
  return { index, progress, step: THINKING_STEPS[index] };
}
