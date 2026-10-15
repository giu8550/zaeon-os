/**
 * lib/octa/runner.ts — o ponto ÚNICO por onde uma tool do Octa Code roda. Costura o pack inteiro:
 *   guard da tarefa (P1) → segredos só no executor (P2) → runTool/permit (runtime) → redação da saída (P2)
 *   → conteúdo externo embrulhado como DADO + sinal de injeção (P7) → trace (P7) → log SHIT pro juiz (P1).
 * Depois de um sinal de prompt-injection, toda mutação seguinte da tarefa exige aprovação humana.
 */
import { createHash } from "node:crypto";
import { getTool, runTool, err, type ApproveFn, type ToolContext, type ToolResult } from "@/lib/agent/runtime";
import { octaPermit, commitGuard, pathsFromArgs, type OctaTask, type OctaTaskState } from "@/lib/octa/guard";
import { redact, PLACEHOLDER_RE, SecretError, type SecretVault } from "@/lib/octa/secrets";
import { embrulhar } from "@/lib/octa/untrusted";
import { Tracer } from "@/lib/octa/trace";
import type { ActionLog } from "@/lib/octa/shit";

export type SessaoOcta = {
  sessionId: string;
  task: OctaTask;
  state: OctaTaskState & { sinaisInjecao: number };
  ctx: ToolContext;
  tracer: Tracer;
  log: ActionLog[];
  vault?: SecretVault;
  approve?: ApproveFn;
};

export type ResultadoOcta = ToolResult & { paraModelo: string };

export function novaSessao(p: Omit<SessaoOcta, "state" | "log" | "tracer"> & { tracer?: Tracer }): SessaoOcta {
  return { ...p, tracer: p.tracer ?? new Tracer({ taskId: p.task.id }), state: { subagentsLaunched: 0, sinaisInjecao: 0 }, log: [] };
}

const negado = (code: string, msg: string): ResultadoOcta => ({ ...err(msg, code), paraModelo: `NEGADO (${code}): ${msg}` });

export async function runOctaTool(nome: string, args: unknown, s: SessaoOcta): Promise<ResultadoOcta> {
  const def = getTool(nome);
  if (!def) return negado("unknown_tool", `tool desconhecida: ${nome}`);
  const mutates = def.risk !== "read";
  const path = pathsFromArgs(args)[0];
  s.tracer.registrar("tool_chamada", { tool: nome, args });

  const g = octaPermit(def, args, s.ctx, s.task, s.state);
  s.tracer.registrar("guard", { tool: nome, gate: g.gate, reason: g.reason, detail: g.detail });
  if (g.gate === "DENY") {
    s.log.push({ tool: nome, mutates, path, denied: true });
    return negado(g.reason ?? "tool_denied", g.detail ?? "negado pela tarefa");
  }

  // Segredos: o modelo mandou placeholder; só aqui (executor) vira valor. A saída volta redigida.
  let argsExec = args;
  let valores = new Map<string, string>();
  const bruto = JSON.stringify(args ?? null);
  if (s.vault && new RegExp(PLACEHOLDER_RE.source).test(bruto)) {
    try {
      const r = await s.vault.resolvePlaceholders(bruto, { sessionId: s.sessionId, acao: nome });
      argsExec = JSON.parse(r.texto);
      valores = r.valores;
    } catch (e) {
      if (e instanceof SecretError) { s.log.push({ tool: nome, mutates, path, denied: true }); return negado(`secret_${e.motivo}`, e.message); }
      throw e;
    }
  }

  // Depois de sinal de injeção, mutação não roda sem humano — mesmo se o guard deixaria.
  const exigeHumano = mutates && s.state.sinaisInjecao > 0;
  const ctxExec = { ...s.ctx, taskMode: s.task.mode };
  const t0 = Date.now();
  let res: ToolResult;
  if (exigeHumano) {
    const ok = s.approve ? await s.approve(def, args, s.ctx).catch(() => false) : false;
    res = ok ? await runTool(def, argsExec, ctxExec, { approve: async () => true }) : err("aprovação humana exigida após sinal de prompt-injection", "needs_approval");
  } else {
    res = await runTool(def, argsExec, ctxExec, { approve: s.approve });
  }

  commitGuard(def, s.state);
  const saida = redact(JSON.stringify(res), valores);
  const resRedigido = JSON.parse(saida) as ToolResult;
  s.tracer.registrar("tool_resultado", { tool: nome, resultado: resRedigido }, { ms: Date.now() - t0 });

  // Tudo que veio de fora vira DADO cercado. Sinal de injeção → trace + escalada.
  const { texto, sinais } = embrulhar(saida, `tool:${nome}`);
  if (sinais.length) {
    s.state.sinaisInjecao += sinais.length;
    s.tracer.registrar("sinal", { tipo: "prompt_injection", tool: nome, sinais });
  }
  s.log.push({ tool: nome, mutates, path, denied: !res.ok && res.code === "tool_denied", contentHash: mutates ? createHash("sha256").update(bruto).digest("hex").slice(0, 16) : undefined });
  return { ...resRedigido, paraModelo: texto };
}
