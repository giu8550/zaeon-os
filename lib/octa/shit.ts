/**
 * lib/octa/shit.ts — P1 do Pack Octa (§2). Heurística do juiz: a taxonomia SHIT sobre o LOG de ações de
 * uma tarefa. Não bloqueia nada (quem bloqueia é o guard); MARCA pra o juiz e pro painel.
 *   S — Scope creep: tocou arquivo que o pedido/o file-lock não mencionam.
 *   H — Hypothetical hardening: criou guard/hash/validação sem consumidor no próprio diff.
 *   I — Intent violation: tentou mutar numa tarefa de leitura.
 *   T — Task thrashing: re-editou o mesmo arquivo vezes demais / desfez a própria edição.
 *
 * Padrão adaptado de lennney/stop-that-shit (MIT, só o conceito).
 */
import { inFileLock, type OctaTask } from "@/lib/octa/guard";

export type ShitKind = "scope_creep" | "hypothetical_hardening" | "intent_violation" | "task_thrashing";
export type ShitFlag = { kind: ShitKind; detail: string };

/** Uma ação registrada durante a tarefa. `added` = símbolos novos; `uses` = símbolos que a ação referencia; `contentHash` = hash após editar. */
export type ActionLog = {
  tool: string;
  mutates: boolean;
  path?: string;
  denied?: boolean;
  added?: string[];
  uses?: string[];
  contentHash?: string;
};

/** As 4 perguntas antes de cada ação extra (vão no prompt do agente e no checklist do juiz). */
export const PERGUNTAS_ANTES_DE_AGIR = [
  "O usuário pediu isso?",
  "O resultado exige isso?",
  "Existe evidência alcançável de que é necessário?",
  "A aceitação falharia sem isso?",
] as const;

const HARDENING_RE = /^(validate|assert|guard|ensure|check|verify|sanitize|hash)[A-Z_]/;
const THRASH_LIMIT = 4;

export function detectShit(task: OctaTask, log: ActionLog[], opts: { requestedPaths?: string[] } = {}): ShitFlag[] {
  const flags: ShitFlag[] = [];
  const scope = [...task.fileLock, ...(opts.requestedPaths ?? [])];

  // I — intenção: qualquer tentativa de mutação em review/answer (mesmo negada) é sinal.
  if (task.mode !== "change") {
    const tent = log.filter((a) => a.mutates);
    if (tent.length) flags.push({ kind: "intent_violation", detail: `${tent.length} tentativa(s) de escrita em modo ${task.mode}` });
  }

  // S — escopo: mutação aceita fora do escopo declarado.
  const fora = new Set(log.filter((a) => a.mutates && !a.denied && a.path && !inFileLock(a.path, scope)).map((a) => a.path!));
  for (const p of fora) flags.push({ kind: "scope_creep", detail: `editou ${p}, que não está no pedido nem no file-lock` });

  // H — hardening hipotético: símbolo de guarda criado e nunca referenciado por outra ação.
  const criados = log.flatMap((a) => (a.added ?? []).filter((s) => HARDENING_RE.test(s)).map((s) => ({ s, path: a.path })));
  for (const { s, path } of criados) {
    if (!log.some((a) => a.uses?.includes(s))) flags.push({ kind: "hypothetical_hardening", detail: `${s} em ${path ?? "?"} sem consumidor` });
  }

  // T — thrashing: muitas edições no mesmo arquivo, ou voltou a um conteúdo anterior (A→B→A).
  const porArquivo = new Map<string, string[]>();
  for (const a of log) if (a.mutates && !a.denied && a.path) porArquivo.set(a.path, [...(porArquivo.get(a.path) ?? []), a.contentHash ?? ""]);
  for (const [p, hashes] of porArquivo) {
    if (hashes.length > THRASH_LIMIT) { flags.push({ kind: "task_thrashing", detail: `${hashes.length} edições em ${p}` }); continue; }
    const vistos = hashes.filter(Boolean);
    if (vistos.some((h, i) => i >= 2 && vistos.slice(0, i - 1).includes(h))) flags.push({ kind: "task_thrashing", detail: `${p} voltou a um estado anterior` });
  }
  return flags;
}
