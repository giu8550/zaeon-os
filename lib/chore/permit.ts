/**
 * lib/chore/permit.ts — o porteiro da chore. ENVOLVE o permit() de lib/agent/runtime.ts (não edita):
 *   permit(def, {plan:"free", execMode:"auto"}) ∧ nome ∈ CHORE_TOOLS (a MESMA def) ∧ def.fase === fase
 *   ∧ write só em "agir" ∧ 1 enqueue_task e 1 post_internal por chore. Fora disso → DENY.
 */
import { permit, runTool, err, type Gate } from "@/lib/agent/runtime";
import { CHORE_TOOLS, type ChoreCtx, type ChoreToolDef, type ChoreToolResult, type FaseChore } from "@/lib/chore/tools";

const CTX_CHORE = { plan: "free" as const, execMode: "auto" as const, gpuAvailable: false };

export function permitChore(def: ChoreToolDef | undefined | null, fase: FaseChore, ctx: Pick<ChoreCtx, "estado">): Gate {
  if (!def || !Object.prototype.hasOwnProperty.call(CHORE_TOOLS, def.name)) return "DENY";
  if (CHORE_TOOLS[def.name] !== def) return "DENY";                 // def forjada com nome válido
  if (permit(def, CTX_CHORE) !== "ALLOW") return "DENY";            // aprovação humana não existe aqui: vira DENY
  if (def.fase !== fase) return "DENY";
  if (def.risk !== "read" && fase !== "agir") return "DENY";
  if (def.name === "enqueue_task" && ctx.estado.enqueueFeito) return "DENY";
  if (def.name === "post_internal" && ctx.estado.postado) return "DENY";
  return "ALLOW";
}

/** Roda UMA tool da chore por nome, na fase dada. Nunca lança. Nome fora das nove = unknown_tool. */
export async function runChoreTool(name: string, args: unknown, fase: FaseChore, ctx: ChoreCtx): Promise<ChoreToolResult> {
  const def = Object.prototype.hasOwnProperty.call(CHORE_TOOLS, name) ? CHORE_TOOLS[name as keyof typeof CHORE_TOOLS] : undefined;
  if (!def) return err(`tool desconhecida: ${name}`, "unknown_tool");
  if (permitChore(def, fase, ctx) !== "ALLOW") return err(`tool ${name} negada na fase ${fase}`, "tool_denied");
  return (await runTool(def, args, { ...ctx, ...CTX_CHORE } as ChoreCtx)) as ChoreToolResult;
}
