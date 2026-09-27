/**
 * lib/skilltree/progress.ts — PROGRESSO por usuário e DESBLOQUEIO por maestria.
 *
 *   computeStates(nodes, mastery)  → status de cada nó (puro): mastered ≥ limiar; available quando
 *                                     TODOS os prereqs estão mastered; in_progress se já tem maestria; senão locked.
 *   masteryUpdate(userId, slug, nodeId, delta) → sobe a maestria, recomputa, persiste os status que
 *                                     mudaram, espelha no User.skills (RPG) e dispara o gancho de credencial.
 *   treeContextBlock(...)           → bloco de texto p/ o AgentContext do harness (o mentor sabe onde o aluno está).
 */
import { MASTERY_THRESHOLD, type SkillNode, type SkillNodeState, type SkillStatus } from "./types";
import { loadTreeNodes } from "./generate";
import { issueCredential } from "./credential";

export type MasteryMap = Record<string, number>;

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

/** Estado de cada nó a partir do mapa de maestria do usuário (puro, determinístico). */
export function computeStates(nodes: SkillNode[], mastery: MasteryMap): SkillNodeState[] {
  const isMastered = (id: string) => clamp01(mastery[id] ?? 0) >= MASTERY_THRESHOLD;
  return nodes.map((n) => {
    const m = clamp01(mastery[n.id] ?? 0);
    let status: SkillStatus;
    if (m >= MASTERY_THRESHOLD) status = "mastered";
    else if (n.prereqs.every(isMastered)) status = m > 0 ? "in_progress" : "available";
    else status = "locked";
    return { ...n, mastery: m, status };
  });
}

/** Próximos nós recomendados (disponíveis/em andamento, do mais básico ao avançado). */
export function nextNodes(states: SkillNodeState[], limit = 3): SkillNodeState[] {
  return states
    .filter((s) => s.status === "available" || s.status === "in_progress")
    .sort((a, b) => b.mastery - a.mastery || a.level - b.level)
    .slice(0, limit);
}

// ───────────────────────────── espelho no RPG (User.skills) ─────────────────────────────
const RANKS: [string, number][] = [["F", 0], ["E", 3], ["D", 8], ["C", 15], ["B", 25], ["A", 40], ["S", 60], ["SS", 100]];
export const XP_PER_NODE = 25;

/** Espelha o total de nós dominados na skill `mastery` do RPG (rank F→SS). Puro. */
export function mirrorSkills(skills: unknown, masteredTotal: number): Record<string, unknown> {
  const base = skills && typeof skills === "object" && !Array.isArray(skills) ? { ...(skills as Record<string, unknown>) } : {};
  let rank = "F";
  let next = RANKS[1][1];
  for (let i = 0; i < RANKS.length; i++) {
    if (masteredTotal >= RANKS[i][1]) { rank = RANKS[i][0]; next = RANKS[i + 1]?.[1] ?? RANKS[i][1]; }
  }
  base.mastery = { rank, current: masteredTotal, next, metricName: "Nós dominados" };
  return base;
}

// ───────────────────────────── persistência ─────────────────────────────
export type MasteryUpdateResult =
  | { ok: true; states: SkillNodeState[]; node: SkillNodeState; unlocked: string[]; newlyMastered: boolean; degraded: boolean }
  | { ok: false; reason: "locked" | "unknown_node" };

async function loadMastery(userId: string, topicSlug: string): Promise<MasteryMap> {
  const { prisma } = await import("@/src/lib/prisma");
  const rows = await prisma.skillProgress.findMany({ where: { userId, topicSlug }, select: { nodeId: true, mastery: true } });
  const map: MasteryMap = {};
  for (const r of rows) map[r.nodeId] = r.mastery;
  return map;
}

/** Nós + status/maestria do usuário para o tópico. */
export async function getProgress(userId: string | null, topicSlug: string): Promise<{ topicLabel: string; degraded: boolean; states: SkillNodeState[] }> {
  const { topicLabel, nodes, degraded } = await loadTreeNodes(topicSlug);
  const mastery = userId ? await loadMastery(userId, topicSlug).catch(() => ({} as MasteryMap)) : {};
  return { topicLabel, degraded, states: computeStates(nodes, mastery) };
}

/**
 * Sobe a maestria do nó (delta em 0..1). Nó `locked` não sobe (o desbloqueio é por pré-requisito).
 * Ao cruzar o limiar: os nós cujos prereqs ficaram todos `mastered` viram `available` (persistido),
 * `User.skills.mastery` e `xp` são atualizados e `issueCredential` é disparado (gancho Solana).
 */
export async function masteryUpdate(userId: string, topicSlug: string, nodeId: string, delta: number): Promise<MasteryUpdateResult> {
  const { prisma } = await import("@/src/lib/prisma");
  const { nodes, degraded } = await loadTreeNodes(topicSlug);
  if (!nodes.some((n) => n.id === nodeId)) return { ok: false, reason: "unknown_node" };
  const before = await loadMastery(userId, topicSlug);
  const prev = computeStates(nodes, before);
  const prevNode = prev.find((s) => s.id === nodeId)!;
  if (prevNode.status === "locked") return { ok: false, reason: "locked" };

  const after: MasteryMap = { ...before, [nodeId]: clamp01((before[nodeId] ?? 0) + delta) };
  const states = computeStates(nodes, after);
  const node = states.find((s) => s.id === nodeId)!;
  const newlyMastered = prevNode.status !== "mastered" && node.status === "mastered";
  const unlocked = states
    .filter((s) => s.status !== "locked" && prev.find((p) => p.id === s.id)?.status === "locked")
    .map((s) => s.id);

  // persiste o nó tocado + todo nó cujo status mudou (desbloqueios)
  const changed = states.filter((s) => s.id === nodeId || s.status !== prev.find((p) => p.id === s.id)?.status);
  await Promise.all(changed.map((s) =>
    prisma.skillProgress.upsert({
      where: { userId_topicSlug_nodeId: { userId, topicSlug, nodeId: s.id } },
      create: { userId, topicSlug, nodeId: s.id, mastery: s.mastery, status: s.status },
      update: { mastery: s.mastery, status: s.status },
    }),
  ));

  if (newlyMastered) {
    // espelho RPG: total de nós dominados (todos os tópicos) → rank; +XP. Best-effort.
    try {
      const total = await prisma.skillProgress.count({ where: { userId, status: "mastered" } });
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { skills: true } });
      await prisma.user.update({ where: { id: userId }, data: { skills: mirrorSkills(u?.skills, total) as any, xp: { increment: XP_PER_NODE } } });
    } catch { /* espelho nunca derruba o progresso */ }
    // gancho PR Solana (fire-and-forget)
    void issueCredential(userId, { type: "skill", topicSlug, nodeId, title: node.title }).catch(() => undefined);
  }
  return { ok: true, states, node, unlocked, newlyMastered, degraded };
}

// ───────────────────────────── contexto p/ o mentor (harness) ─────────────────────────────
/** Bloco de texto (puro) com a posição do aluno na árvore + guardrail pedagógico. */
export function treeContextText(topicLabel: string, states: SkillNodeState[], focusNodeId?: string | null): string {
  const mastered = states.filter((s) => s.status === "mastered").map((s) => s.title);
  const open = nextNodes(states, 4).map((s) => s.title);
  const locked = states.filter((s) => s.status === "locked").length;
  const focus = focusNodeId ? states.find((s) => s.id === focusNodeId) : undefined;
  const lines = [
    `ÁRVORE DE HABILIDADES do tópico "${topicLabel}" (posição do aluno):`,
    `- Dominados (${mastered.length}/${states.length}): ${mastered.length ? mastered.join("; ") : "nenhum ainda"}`,
    `- Disponíveis agora: ${open.length ? open.join("; ") : "nenhum"}${locked ? ` · Travados: ${locked}` : ""}`,
  ];
  if (focus) {
    lines.push(`- NÓ EM FOCO: "${focus.title}" [${focus.branch}, nível ${focus.level}, status ${focus.status}, maestria ${Math.round(focus.mastery * 100)}%]${focus.summary ? ` — ${focus.summary}` : ""}`);
  }
  lines.push(
    "GUARDRAIL PEDAGÓGICO: conduza o aluno para o próximo nó disponível. Dê PISTAS e perguntas para ele dominar o nó, " +
    "não a resposta pronta; quando ele demonstrar domínio (explicar, resolver, prever), reconheça explicitamente e proponha o nó seguinte.",
  );
  return lines.join("\n");
}

/** Versão com I/O: carrega árvore + progresso e monta o bloco. "" se não der (best-effort). */
export async function treeContextBlock(userId: string, topicSlug: string, focusNodeId?: string | null): Promise<string> {
  try {
    const { topicLabel, states } = await getProgress(userId, topicSlug);
    return treeContextText(topicLabel, states, focusNodeId);
  } catch {
    return "";
  }
}
