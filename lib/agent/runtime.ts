/**
 * lib/agent/runtime.ts — PR03 do runbook (§13.1) · §11.2 do plano.
 * Runtime das tools da Aura: define/registra ToolDef, e executa com um middleware
 * de guardrails (permit → timeout → run → normaliza). `runTool` NUNCA lança.
 *
 * Gating (deny-by-default): plano (planAtLeast), GPU sob demanda, risco + execMode.
 * `memory_search` é runtime "ts" + minPlan "free" — memória é STANDARD (nunca gateada).
 */
import type { FunctionDeclaration } from "@google-cloud/vertexai";
import { type Plan, planAtLeast } from "@/lib/plans";
import type { ProvenanceRecord, Source, StudioRef, ExecMode } from "@/lib/agent/contracts";
import { type AuraErrorCode, messageForError } from "@/lib/agent/errors";

// ─────────────────────────── Tipos da tool ───────────────────────────
export type ToolRuntime = "ts" | "python" | "mcp";
export type ToolRisk = "read" | "write" | "destructive";

/** Um achado de evidência com fonte (alimenta StructuredAnswer.evidencia). */
export type Finding = { text: string; source?: Source };

export type ToolResult = {
  ok: boolean;
  findings?: Finding[];
  artifact?: StudioRef;
  error?: string;          // mensagem PT-BR (voz do produto) — de messageForError(code)
  code?: AuraErrorCode;    // código tipado da falha (taxonomia lib/agent/errors.ts)
  provenance: Partial<ProvenanceRecord>;
};

/** Contexto de execução da tool (subconjunto do AgentContext + plano/infra). */
export type ToolCtx = {
  userId?: string | null;
  plan?: Plan | string | null;      // tier do usuário (free|plus|pro|max)
  execMode?: ExecMode;              // auto | guiado (§11.4)
  gpuAvailable?: boolean;          // p/ tools demandGpu (T3)
  surface?: string | null;
  traceId?: string;
};

export type ToolDef = {
  name: string;
  runtime: ToolRuntime;
  risk: ToolRisk;
  minPlan: Plan;                    // gating por plano (planAtLeast)
  demandGpu?: boolean;             // exige GPU disponível (T3 Max sob demanda)
  schema: FunctionDeclaration;      // o que a LLM (Gemini) enxerga
  run: (args: any, ctx: ToolCtx) => Promise<ToolResult>;
};

// ─────────────────────────── Permissão (gate único) ───────────────────────────
export type Permit = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

/**
 * Deny-by-default. Ordem: plano insuficiente → DENY; GPU exigida e ausente → DENY;
 * destrutivo/escrita OU modo guiado → REQUIRE_APPROVAL (cartão HITL); senão ALLOW.
 * Memória e leituras em modo auto passam direto.
 */
export function permit(def: ToolDef, ctx: ToolCtx): Permit {
  if (!planAtLeast(ctx.plan ?? "free", def.minPlan)) return "DENY";
  if (def.demandGpu && !ctx.gpuAvailable) return "DENY";
  if (def.risk === "destructive") return "REQUIRE_APPROVAL";
  if (def.risk === "write") return ctx.execMode === "guiado" ? "REQUIRE_APPROVAL" : "ALLOW";
  // risk === "read": em guiado, tools de escopo caro ainda podem pedir aprovação —
  // aqui leitura é sempre liberada (barato); o gate de plano/GPU acima já protegeu.
  return "ALLOW";
}

// ─────────────────────────── Helpers ───────────────────────────
export function toolErr(code: AuraErrorCode, detail?: string, provenance: Partial<ProvenanceRecord> = {}): ToolResult {
  return { ok: false, code, error: messageForError(code), provenance: { ...provenance, error: detail } as any };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function timeoutFor(def: ToolDef): number {
  if (def.runtime === "python") return 60_000;   // microserviço de skills
  if (def.runtime === "mcp") return 30_000;
  return 15_000;                                  // in-process ts
}

/**
 * Executa a tool com o middleware. `approve` é o callback do cartão HITL (guiado /
 * ações caras); se ausente e o gate pedir aprovação, nega com segurança.
 */
export async function runTool(
  def: ToolDef,
  args: any,
  ctx: ToolCtx,
  opts?: { approve?: (def: ToolDef, args: any) => Promise<boolean> },
): Promise<ToolResult> {
  const gate = permit(def, ctx);
  if (gate === "DENY") return toolErr("tool_denied", def.name);
  if (gate === "REQUIRE_APPROVAL") {
    const ok = opts?.approve ? await opts.approve(def, args).catch(() => false) : false;
    if (!ok) return toolErr("tool_unapproved", def.name);
  }
  try {
    return await withTimeout(def.run(args, ctx), timeoutFor(def));
  } catch (e: any) {
    const timedOut = String(e?.message ?? e).toLowerCase().includes("timeout");
    return toolErr(timedOut ? "tool_timeout" : "tool_failed", `${def.name}: ${String(e?.message ?? e)}`);
  }
}

// ─────────────────────────── Registry ───────────────────────────
const REGISTRY = new Map<string, ToolDef>();

export function registerTool(def: ToolDef): void { REGISTRY.set(def.name, def); }
export function getTool(name: string): ToolDef | undefined { return REGISTRY.get(name); }
export function listTools(): ToolDef[] { return [...REGISTRY.values()]; }
/** As tools que a LLM enxerga para uma intenção (schemas), respeitando o gate de plano. */
export function schemasFor(names: string[], ctx: ToolCtx): FunctionDeclaration[] {
  return names
    .map((n) => REGISTRY.get(n))
    .filter((d): d is ToolDef => !!d && permit(d, ctx) !== "DENY")
    .map((d) => d.schema);
}
