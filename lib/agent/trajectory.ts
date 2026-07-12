/**
 * lib/agent/trajectory.ts — PR04 do runbook (§13.1) · §11.1 do plano.
 * O MOTOR do laço da Aura: a resposta como TRAJETÓRIA TIPADA multi-step.
 *   route → (quick? draft→finalize) → plan → loop{ gather → reason → draft → critique
 *   → shouldRevise? } → finalize (provenance + persistMemory + stream).
 *
 * Pura ORQUESTRAÇÃO: toda I/O (LLM, tools, memória, stream) entra por `HarnessDeps`
 * injetável → transpila e testa sem rede. Stop conditions determinísticas. O
 * reasoning-sandwich (deep-think só em plan+critique) é decisão de quem implementa
 * `plan`/`critique`. Roda atrás da flag AURA_HARNESS (o chamador decide).
 */
import {
  INTENTS, shouldRevise,
  type IntentId, type Mode, type AcademicMode, type WorkKind,
  type StructuredAnswer, type ExaminerVerdict, type Issue, type ProvenanceRecord,
} from "@/lib/agent/contracts";
import type { Finding, ToolResult, ToolCtx } from "@/lib/agent/runtime";

export type Phase = "route" | "plan" | "gather" | "reason" | "draft" | "critique" | "finalize";
export type StopReason = "aprovado" | "orcamento" | "maxIter" | "loop" | "erro";

/** Um passo do plano (o que o gather vai chamar). */
export type Step = { tool: string; args?: any; note?: string };

/** Passo emitido para o trace (action bus / stream). NÃO é o AgentStep de actions.ts
 *  (aquele tem união fechada) — o adaptador de UI mapeia isto → AgentStep. */
export type TrajectoryStep = { phase: Phase; label: string; status: "running" | "done" | "error" };

export type Budget = { tokens: number; ms: number };

export type Classification = { intent: IntentId; mode: Mode; academicMode: AcademicMode; kind?: WorkKind };

export type TrajectoryState = {
  objective: string;
  intent: IntentId;
  mode: Mode;
  academicMode: AcademicMode;
  kind?: WorkKind;
  plan: Step[];
  evidence: Finding[];
  reasoning?: string;
  draft?: StructuredAnswer;
  critique: Issue[];
  score?: number;
  artifacts: NonNullable<StructuredAnswer["artifacts"]>;
  memoryWrites: Finding[];      // o que o finalize vai persistir como drawers (L3)
  phase: Phase;
  iter: number;
  spent: { tokens: number; ms: number };
  budget: Budget;
  stop?: StopReason;
  startedAt: number;
};

/** As dependências de I/O do motor. Implementadas no wiring (route/PR-M3/etc.). */
export interface HarnessDeps {
  classify(objective: string, ctx: ToolCtx): Promise<Classification>;
  plan(st: TrajectoryState): Promise<Step[]>;                 // reasoning-heavy (fatia 1 do sandwich)
  runTool(name: string, args: any, ctx: ToolCtx): Promise<ToolResult>;
  reason(st: TrajectoryState): Promise<string>;              // conecta evidence → reasoning
  draft(st: TrajectoryState): Promise<StructuredAnswer>;
  critique(st: TrajectoryState): Promise<ExaminerVerdict>;    // examiner (ScholarEval), fatia 2 do sandwich
  emit(step: TrajectoryStep): void;                          // trace → action bus / stream
  persistMemory(writes: Finding[], ctx: ToolCtx): Promise<void>;  // L3 write no finalize
  budgetFor?(spec: (typeof INTENTS)[IntentId], mode: Mode): Budget;
}

const DEFAULT_BUDGET: Record<Mode, Budget> = {
  quick: { tokens: 4_000, ms: 15_000 },
  elaborated: { tokens: 16_000, ms: 45_000 },
  research: { tokens: 60_000, ms: 180_000 },
};

const mk = (phase: Phase, label = phase): TrajectoryStep => ({ phase, label, status: "running" });

function toFindings(res: ToolResult): Finding[] {
  return res.ok && res.findings ? res.findings : [];
}

function overBudget(st: TrajectoryState): boolean {
  return st.spent.tokens >= st.budget.tokens || (Date.now() - st.startedAt) >= st.budget.ms;
}

function seedState(objective: string, r: Classification, budget: Budget): TrajectoryState {
  return {
    objective, intent: r.intent, mode: r.mode, academicMode: r.academicMode, kind: r.kind,
    plan: [], evidence: [], critique: [], artifacts: [], memoryWrites: [],
    phase: "route", iter: 0, spent: { tokens: 0, ms: 0 }, budget, startedAt: Date.now(),
  };
}

/** Passos ainda não executados nesta iteração (paraleliza tools independentes). */
function nextTools(st: TrajectoryState): Step[] {
  return st.plan.filter((s) => !!s.tool);
}

/**
 * O laço. Devolve o StructuredAnswer final (com provenance). Nunca lança: erros de
 * fase são capturados e viram stop="erro" com o melhor draft disponível.
 */
export async function runTrajectory(
  objective: string,
  ctx: ToolCtx,
  d: HarnessDeps,
): Promise<{ answer: StructuredAnswer; state: TrajectoryState }> {
  let st: TrajectoryState;
  try {
    d.emit(mk("route"));
    const r = await d.classify(objective, ctx);
    const spec = INTENTS[r.intent];
    const budget = (d.budgetFor?.(spec, r.mode)) ?? DEFAULT_BUDGET[r.mode];
    st = seedState(objective, r, budget);

    // QUICK: 1 tiro (conversa/dúvida) — sem plano, sem crítico.
    if (r.mode === "quick") {
      st.phase = "draft"; d.emit(mk("draft"));
      st.draft = await d.draft(st);
      st.stop = "aprovado";
      return finalize(st, ctx, d);
    }

    st.phase = "plan"; d.emit(mk("plan"));
    st.plan = await d.plan(st);

    for (;;) {
      st.iter++;

      st.phase = "gather"; d.emit(mk("gather"));
      const steps = nextTools(st);
      const results = await Promise.all(
        steps.map((s) => d.runTool(s.tool, s.args, ctx).catch((e) => toolErrLike(e))),
      );
      for (const res of results) {
        st.evidence.push(...toFindings(res));
        if (res.artifact) st.artifacts.push(res.artifact);
      }

      st.phase = "reason"; d.emit(mk("reason"));
      st.reasoning = await d.reason(st);

      st.phase = "draft"; d.emit(mk("draft"));
      st.draft = await d.draft(st);

      if (spec.critic === "off") { st.stop = "aprovado"; break; }

      st.phase = "critique"; d.emit(mk("critique"));
      const v = await d.critique(st);
      st.critique = v.issues; st.score = v.score;

      if (!shouldRevise(v, spec, st.iter)) {
        st.stop = v.decision === "aprovado" || v.score >= (spec.reviseThreshold ?? 7) ? "aprovado" : "maxIter";
        break;
      }
      if (overBudget(st)) { st.stop = "orcamento"; break; }
      // senão: revisa — os issues guiam o próximo gather/draft (o `plan`/`draft` os leem em st.critique).
    }
    return finalize(st, ctx, d);
  } catch (e) {
    // fail-safe: devolve o que tiver, marcando erro (nunca derruba a rota).
    const fallback: StructuredAnswer = { nucleo: "Não consegui concluir o raciocínio agora." };
    const state = (typeof st! !== "undefined" ? st! : seedState(objective, { intent: "conversa", mode: "quick", academicMode: "flexible" }, DEFAULT_BUDGET.quick));
    state.stop = "erro";
    return { answer: state.draft ?? fallback, state };
  }
}

function toolErrLike(e: unknown): ToolResult {
  return { ok: false, error: String((e as any)?.message ?? e), provenance: {} };
}

async function finalize(
  st: TrajectoryState,
  ctx: ToolCtx,
  d: HarnessDeps,
): Promise<{ answer: StructuredAnswer; state: TrajectoryState }> {
  st.phase = "finalize"; d.emit({ phase: "finalize", label: "finalize", status: "done" });
  const answer: StructuredAnswer = st.draft ?? { nucleo: "" };

  // provenance mínimo (o wiring completa model/traceId).
  const provenance: ProvenanceRecord = {
    by: "aura", intent: st.intent, toolsUsed: st.plan.map((s) => s.tool),
    sources: st.evidence.map((f) => f.source).filter(Boolean) as ProvenanceRecord["sources"],
    model: "gemini", at: new Date().toISOString(), traceId: ctx.traceId ?? "",
  };
  answer.provenance = { ...provenance, ...(answer.provenance ?? {}) };
  if (st.artifacts.length && !answer.artifacts) answer.artifacts = st.artifacts;

  // L3: persiste o que virou memória (deriva do turno). Best-effort.
  const writes = st.memoryWrites.length ? st.memoryWrites : st.evidence;
  try { await d.persistMemory(writes, ctx); } catch { /* nunca derruba o finalize */ }

  return { answer, state: st };
}
