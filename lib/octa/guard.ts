/**
 * lib/octa/guard.ts — P1 do Pack Octa (§2). O porteiro de TAREFA do Octa Code. ENVOLVE o permit() de
 * lib/agent/runtime.ts (não substitui): permit(def, ctx) ∧ modo da tarefa ∧ file-lock ∧ orçamento de
 * subagentes. Toda negação devolve um MOTIVO estável — o agente vê por que parou, o juiz conta.
 *
 * Padrão adaptado de lennney/stop-that-shit (MIT, só o conceito — nenhum código copiado).
 */
import { permit, isReadOnlyMode, type Gate, type TaskMode, type ToolContext, type ToolDef } from "@/lib/agent/runtime";

export type DenyReason =
  | "PERMIT_DENY"               // o permit() base negou (plano etc.)
  | "MODE_FORBIDS_MUTATION"     // review/answer tentando escrever
  | "OUTSIDE_FILE_LOCK"         // escrita num arquivo que a tarefa não declarou
  | "PATH_NOT_ALLOWED"          // path absoluto, traversal (..) ou vazio
  | "MUTATION_WITHOUT_PATH"     // tool de escrita sem dizer onde escreve, com file-lock ativo
  | "SUBAGENT_BUDGET_EXCEEDED"; // teto de subagentes da tarefa estourado

/** O contrato de uma tarefa do Octa: o que pode fazer e onde. Declarado ANTES de rodar. */
export type OctaTask = {
  id: string;
  mode: TaskMode;
  /** Globs relativos à raiz do workspace (`lib/octa/**`, `app/page.tsx`). Vazio em `change` = nada é gravável. */
  fileLock: string[];
  /** Máximo de subagentes que a tarefa pode lançar (default 2). */
  subagentBudget?: number;
};

/** Estado mutável da tarefa enquanto roda (o guard incrementa). */
export type OctaTaskState = { subagentsLaunched: number };

export type GuardDecision = { gate: Gate; reason?: DenyReason; detail?: string };

export const DEFAULT_SUBAGENT_BUDGET = 2;
/** Nomes de tool que lançam subagente — contam contra o orçamento. */
export const SUBAGENT_TOOLS = new Set(["spawn_subagent", "launch_agent", "delegate_task"]);

// ───────────────────────────── paths ─────────────────────────────
const PATH_KEYS = ["path", "file", "filePath", "file_path", "target", "dest", "destination"];
const PATHS_KEYS = ["paths", "files"];

/** Extrai os paths que uma chamada de tool pretende tocar (convenções comuns de args). */
export function pathsFromArgs(args: unknown): string[] {
  if (!args || typeof args !== "object") return [];
  const a = args as Record<string, unknown>;
  const out: string[] = [];
  for (const k of PATH_KEYS) if (typeof a[k] === "string") out.push(a[k] as string);
  for (const k of PATHS_KEYS) if (Array.isArray(a[k])) for (const v of a[k] as unknown[]) if (typeof v === "string") out.push(v);
  return out;
}

/** Normaliza um path relativo; `null` = inválido (absoluto, `..`, vazio, NUL). */
export function normalizePath(p: string): string | null {
  const s = String(p ?? "").trim().replace(/\\/g, "/");
  if (!s || s.includes("\0") || s.startsWith("/") || /^[a-zA-Z]:/.test(s)) return null;
  const parts: string[] = [];
  for (const seg of s.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") return null;
    parts.push(seg);
  }
  return parts.length ? parts.join("/") : null;
}

/** Glob mínimo: `**` = qualquer profundidade, `*` = qualquer coisa sem `/`, `?` = 1 char. */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") { i++; re += "(?:.*/)?"; } else re += ".*";
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export function inFileLock(path: string, lock: string[]): boolean {
  const n = normalizePath(path);
  if (!n) return false;
  return lock.some((g) => {
    const ng = normalizePath(g.replace(/\*\*$/, "__ALL__"))?.replace(/__ALL__$/, "**");
    return !!ng && globToRegExp(ng).test(n);
  });
}

// ───────────────────────────── a decisão ─────────────────────────────
/**
 * Decide se a chamada pode rodar dentro da tarefa. Ordem: permit base → modo → subagentes → file-lock.
 * NÃO incrementa estado; `commitGuard` faz isso depois que a chamada é aceita.
 */
export function octaPermit(def: ToolDef, args: unknown, ctx: ToolContext, task: OctaTask, state: OctaTaskState): GuardDecision {
  const base = permit(def, { ...ctx, taskMode: task.mode });
  const mutates = def.risk !== "read";

  if (base === "DENY") {
    if (mutates && isReadOnlyMode(task.mode)) return { gate: "DENY", reason: "MODE_FORBIDS_MUTATION", detail: `tarefa em modo ${task.mode} não escreve (${def.name})` };
    return { gate: "DENY", reason: "PERMIT_DENY", detail: def.name };
  }

  if (SUBAGENT_TOOLS.has(def.name)) {
    const budget = task.subagentBudget ?? DEFAULT_SUBAGENT_BUDGET;
    if (state.subagentsLaunched >= budget) return { gate: "DENY", reason: "SUBAGENT_BUDGET_EXCEEDED", detail: `teto de ${budget} subagente(s) atingido` };
  }

  if (mutates) {
    const paths = pathsFromArgs(args);
    if (!paths.length && !SUBAGENT_TOOLS.has(def.name)) return { gate: "DENY", reason: "MUTATION_WITHOUT_PATH", detail: `${def.name} não declarou onde escreve` };
    for (const p of paths) {
      if (!normalizePath(p)) return { gate: "DENY", reason: "PATH_NOT_ALLOWED", detail: p };
      if (!inFileLock(p, task.fileLock)) return { gate: "DENY", reason: "OUTSIDE_FILE_LOCK", detail: `${p} fora do file-lock da tarefa` };
    }
  }
  return { gate: base };
}

/** Registra os efeitos de uma chamada ACEITA (ex.: subagente lançado). */
export function commitGuard(def: ToolDef, state: OctaTaskState): void {
  if (SUBAGENT_TOOLS.has(def.name)) state.subagentsLaunched++;
}

export function newTaskState(): OctaTaskState {
  return { subagentsLaunched: 0 };
}
