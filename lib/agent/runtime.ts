/**
 * lib/agent/runtime.ts — PR03 do runbook (§13.1; encarna §11.2). O RUNTIME das tools.
 *
 * ToolDef / ToolResult / runTool + o middleware permit() (DENY-BY-DEFAULT). Ponto ÚNICO de
 * gating: risco × plano (minPlan) × GPU-por-demanda × execMode. `runTool` NUNCA lança — tool
 * que estoura/nega/expira vira `{ok:false,error,code}`. Registra as tools da Fase 0 como ToolDef
 * (`studio_generate`, `research_generate`) + stubs (`memory_search` free, `literature_search`
 * python-F2, `examiner`). Tipos ricos: importe de contracts.ts; NÃO reinvente.
 */
import type { FunctionDeclaration } from "@google-cloud/vertexai";
import type { AgentContext } from "@/lib/agent/context";
import type { ExecMode, Source, StudioRef, ProvenanceRecord } from "@/lib/agent/contracts";
import type { Plan } from "@/lib/plans";
import {
  studioGenerateTool,
  researchGenerateTool,
  normalizeStudioKind,
  studioLabel,
  researchWorkType,
} from "@/lib/agent/tools";

// ───────────────────────────── contratos do runtime (§11.2) ─────────────────────────────
export type ToolRuntime = "ts" | "python" | "mcp";
export type ToolRisk = "read" | "write" | "destructive";

/** Um achado de tool — com fonte sempre que possível (§8). */
export type Finding = { claim: string; source?: Source; confidence: "alta" | "média" | "baixa" };

/** Resultado normalizado de TODA tool. `code` (aditivo) alimenta a taxonomia de erro (A1/A2). */
export type ToolResult = {
  ok: boolean;
  findings?: Finding[];
  artifact?: StudioRef;
  error?: string;
  code?: string;
  provenance: Partial<ProvenanceRecord>;
};

/** O contexto que o runtime enxerga: world-state + os campos de gating (plano/execMode/curso/GPU). */
export type ToolContext = AgentContext & {
  plan?: Plan;
  execMode?: ExecMode;
  courseTags?: string[];
  gpuAvailable?: boolean;
};

export interface ToolDef {
  name: string;
  runtime: ToolRuntime;
  risk: ToolRisk;
  minPlan: Plan;
  demandGpu?: boolean;
  schema: FunctionDeclaration; // o que o Gemini (function-calling) enxerga
  run(args: any, ctx: ToolContext): Promise<ToolResult>;
}

export type Gate = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";
export type ApproveFn = (def: ToolDef, args: any, ctx: ToolContext) => Promise<boolean>;

// ───────────────────────────── helpers ─────────────────────────────
const PLAN_ORDER: Plan[] = ["free", "plus", "pro", "max"];
/** true se `plan` alcança `min` (free<plus<pro<max). Substitui o `planRank` citado no §9.10. */
export function planAtLeast(plan: Plan | undefined, min: Plan): boolean {
  return PLAN_ORDER.indexOf(plan ?? "free") >= PLAN_ORDER.indexOf(min);
}

/** normaliza um erro em ToolResult (NUNCA lança). */
export function err(error: string, code?: string): ToolResult {
  return { ok: false, error, code, provenance: {} };
}

const TIMEOUT_MS: Record<ToolRuntime, number> = { ts: 20_000, python: 60_000, mcp: 30_000 };
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`tool timeout (${ms}ms)`)), ms)),
  ]);
}

// ───────────────────────────── permissão (deny-by-default, §11.2) ─────────────────────────────
/**
 * Decisão determinística ANTES de rodar: risco × plano × GPU × execMode.
 * Deny-by-default: plano insuficiente = DENY; destrutivo ou GPU-por-demanda = REQUIRE_APPROVAL;
 * em `guiado`, `write` sobe pra aprovação; leitura/geração em `auto` = ALLOW.
 */
export function permit(def: ToolDef, ctx: ToolContext): Gate {
  if (!planAtLeast(ctx.plan, def.minPlan)) return "DENY";
  if (def.demandGpu && !ctx.gpuAvailable) return "REQUIRE_APPROVAL"; // T3 sob demanda
  if (def.risk === "destructive") return "REQUIRE_APPROVAL";
  if (ctx.execMode === "guiado" && def.risk === "write") return "REQUIRE_APPROVAL";
  return "ALLOW";
}

// ───────────────────────────── execução (nunca lança, §11.2) ─────────────────────────────
export async function runTool(
  def: ToolDef,
  args: any,
  ctx: ToolContext,
  opts?: { approve?: ApproveFn },
): Promise<ToolResult> {
  try {
    const gate = permit(def, ctx);
    if (gate === "DENY") return err("permissão negada", "tool_denied");
    if (gate === "REQUIRE_APPROVAL") {
      const ok = opts?.approve ? await opts.approve(def, args, ctx).catch(() => false) : false;
      if (!ok) return err("aprovação necessária", "needs_approval");
    }
    const res = await withTimeout(def.run(args, ctx), TIMEOUT_MS[def.runtime] ?? 20_000);
    if (!res || typeof res.ok !== "boolean") return err("resultado inválido da tool", "bad_tool_result");
    if (!res.provenance) res.provenance = {};
    return res;
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    return err(msg, /timeout/i.test(msg) ? "tool_timeout" : "tool_error");
  }
}

// ───────────────────────────── registry ─────────────────────────────
const REGISTRY = new Map<string, ToolDef>();
export function registerTool(def: ToolDef): void { REGISTRY.set(def.name, def); }
export function getTool(name: string): ToolDef | undefined { return REGISTRY.get(name); }
export function listTools(): ToolDef[] { return [...REGISTRY.values()]; }

/** Executa por nome (o que o laço chama). Tool desconhecida = DENY silencioso (deny-by-default). */
export async function runToolByName(
  name: string,
  args: any,
  ctx: ToolContext,
  opts?: { approve?: ApproveFn },
): Promise<ToolResult> {
  const def = getTool(name);
  if (!def) return err(`tool desconhecida: ${name}`, "unknown_tool");
  return runTool(def, args, ctx, opts);
}

// ───────────────────────────── ToolDefs — Fase 0 + stubs ─────────────────────────────
const nowIso = () => new Date().toISOString();

/** studio_generate — client-orchestrated: normaliza o pedido num StudioRef (o cliente executa). */
export const studioGenerateDef: ToolDef = {
  name: "studio_generate",
  runtime: "ts",
  risk: "write",
  minPlan: "free",
  schema: studioGenerateTool,
  async run(args, ctx) {
    const kind = normalizeStudioKind(String(args?.kind ?? ""));
    const topic = String(args?.topic ?? ctx.currentGoal ?? "").trim();
    return {
      ok: true,
      artifact: { studioKind: kind, title: topic ? `${studioLabel(kind)}: ${topic}` : studioLabel(kind) },
      provenance: { toolsUsed: ["studio_generate"], at: nowIso() },
    };
  },
};

/** research_generate — idem, para o TRABALHO da Sala de Pesquisa. */
export const researchGenerateDef: ToolDef = {
  name: "research_generate",
  runtime: "ts",
  risk: "write",
  minPlan: "free",
  schema: researchGenerateTool,
  async run(args, ctx) {
    const kind = String(args?.kind ?? "artigo").trim().toLowerCase();
    const topic = String(args?.topic ?? ctx.currentGoal ?? "").trim();
    if (!topic) return err("tema do trabalho ausente", "missing_topic");
    return {
      ok: true,
      artifact: { studioKind: `research:${kind}`, title: `${researchWorkType(kind)}: ${topic}` },
      provenance: { toolsUsed: ["research_generate"], at: nowIso() },
    };
  },
};

const stubSchema = (name: string, description: string, withQuery = true): FunctionDeclaration => ({
  name,
  description,
  parameters: {
    type: "OBJECT" as any,
    properties: withQuery ? { query: { type: "STRING" as any, description: "o que buscar/recuperar" } } : {},
    required: withQuery ? ["query"] : [],
  },
});

/** memory_search — STUB até o PR-M3 (PASSO 5). Memória = free (NUNCA gateia por plano). */
export const memorySearchDef: ToolDef = {
  name: "memory_search",
  runtime: "ts",
  risk: "read",
  minPlan: "free",
  schema: stubSchema("memory_search", "Busca na memória de longo prazo do usuário (recall semântico verbatim)."),
  async run() {
    return { ok: false, error: "memória de longo prazo indisponível", code: "memory_unavailable", provenance: {} };
  },
};

/** literature_search — STUB (F2: microserviço Python; roda no VPS/CI, não no mac). */
export const literatureSearchDef: ToolDef = {
  name: "literature_search",
  runtime: "python",
  risk: "read",
  minPlan: "free",
  schema: stubSchema("literature_search", "Busca literatura acadêmica (papers/fontes) — microserviço de skills (Fase 2)."),
  async run() {
    return { ok: false, error: "busca de literatura ainda não disponível", code: "skill_offline", provenance: {} };
  },
};

/** examiner — STUB até o PR05 (o crítico ScholarEval). */
export const examinerDef: ToolDef = {
  name: "examiner",
  runtime: "ts",
  risk: "read",
  minPlan: "free",
  schema: stubSchema("examiner", "Avalia um rascunho (ScholarEval) e devolve um veredito com issues.", false),
  async run() {
    return { ok: false, error: "examiner ainda não implementado", code: "not_implemented", provenance: {} };
  },
};

// Registra a Fase 0 + stubs no boot do módulo.
[studioGenerateDef, researchGenerateDef, memorySearchDef, literatureSearchDef, examinerDef].forEach(registerTool);
