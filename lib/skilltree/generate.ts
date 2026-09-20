/**
 * lib/skilltree/generate.ts — GERAÇÃO da árvore por tópico (Gemini Flash) + cache por slug.
 *
 *   getOrCreateSkillTree(topic) → cache (`skill_trees`) OU gera → valida → grava.
 *   Falha/JSON inválido → `fallbackTree` (trilha linear de 5 nós de teoria), degraded=true e
 *   NÃO cacheada (o próximo pedido tenta gerar de novo). Nunca 500.
 *
 * Partes puras (prompt, sanitize, fallback) são testadas sem rede; `genJson` é injetável.
 */
import { GEMINI_MODEL_FLASH } from "@/lib/ai/model";
import { BRANCHES, topicLabel, topicSlug, type SkillBranch, type SkillNode, type SkillTreeDTO } from "./types";

export type GenJson = <T>(system: string, user: string, opts?: { temperature?: number; model?: string; timeoutMs?: number }) => Promise<T>;

export const MIN_NODES = 5;
export const MAX_NODES = 16;
export const MAX_LEVEL = 8;

export const SKILLTREE_SYSTEM =
  "Você é a Aura montando uma ÁRVORE DE HABILIDADES para um tópico de estudo (PT-BR). " +
  "Monte de 8 a 14 nós cobrindo os TRÊS ramos: \"teoria\" (conceitos/fundamentos), \"experimental\" " +
  "(observar, medir, testar, simular) e \"pratica\" (aplicar, resolver, construir). " +
  "É um GRAFO com pré-requisitos, não uma lista: cada nó lista os ids dos nós que precisam ser dominados antes. " +
  "\"level\" vai de 1 (básico, sem pré-requisitos) até 5 (avançado); um pré-requisito SEMPRE tem level menor que o nó (sem ciclos). " +
  "Ids curtos em kebab-case e únicos (ex.: \"fundamentos\", \"medir-taxa\"). \"summary\": 1–2 frases do que a pessoa saberá fazer ao dominar o nó. " +
  "Responda SOMENTE JSON válido (sem markdown): " +
  "{\"nodes\":[{\"id\":\"…\",\"title\":\"…\",\"branch\":\"teoria|experimental|pratica\",\"level\":1,\"prereqs\":[\"…\"],\"summary\":\"…\"}]}";

const RETRY_HINT =
  "\n\nResponda SOMENTE o objeto JSON pedido. Garanta pelo menos 8 nós, os três ramos presentes " +
  "(teoria, experimental, pratica) e pré-requisitos apontando só para ids existentes com level menor.";

export function buildUserPrompt(topic: string): string {
  return `Tópico de estudo: ${topicLabel(topic)}`;
}

// ───────────────────────────── sanitize (puro) ─────────────────────────────
const BRANCH_ALIASES: Record<string, SkillBranch> = {
  teoria: "teoria", teorica: "teoria", teorico: "teoria", theory: "teoria", conceito: "teoria",
  experimental: "experimental", experimento: "experimental", experiment: "experimental", laboratorio: "experimental",
  pratica: "pratica", pratico: "pratica", practice: "pratica", practical: "pratica", aplicacao: "pratica",
};

function normBranch(v: unknown): SkillBranch | null {
  const k = String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return BRANCH_ALIASES[k] ?? null;
}

function normId(v: unknown): string {
  return topicSlug(String(v ?? "")).slice(0, 40);
}

/** true se o grafo (prereqs) tem ciclo. */
export function hasCycle(nodes: Pick<SkillNode, "id" | "prereqs">[]): boolean {
  const adj = new Map(nodes.map((n) => [n.id, n.prereqs]));
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (id: string): boolean => {
    const s = state.get(id) ?? 0;
    if (s === 1) return true;
    if (s === 2) return false;
    state.set(id, 1);
    for (const p of adj.get(id) ?? []) if (adj.has(p) && visit(p)) return true;
    state.set(id, 2);
    return false;
  };
  return nodes.some((n) => visit(n.id));
}

export function hasAllBranches(nodes: Pick<SkillNode, "branch">[]): boolean {
  const seen = new Set(nodes.map((n) => n.branch));
  return BRANCHES.every((b) => seen.has(b));
}

/**
 * Valida/normaliza a saída do modelo. Devolve null se não dá pra usar (poucos nós, ramo faltando).
 * Regras: ids únicos; branch mapeado; level 1..MAX_LEVEL; prereqs só p/ ids existentes, ≠ self e com
 * level MENOR (isso garante grafo acíclico por construção); ordena por level.
 */
export function sanitizeTree(raw: unknown): SkillNode[] | null {
  const list = Array.isArray((raw as any)?.nodes) ? (raw as any).nodes : Array.isArray(raw) ? raw : null;
  if (!list) return null;
  const seen = new Set<string>();
  const nodes: SkillNode[] = [];
  for (const n of list) {
    if (!n || typeof n !== "object") continue;
    const title = String(n.title ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (!title) continue;
    let id = normId(n.id) || normId(title);
    if (!id) continue;
    let k = 2;
    while (seen.has(id)) id = `${normId(n.id) || normId(title)}-${k++}`.slice(0, 44);
    seen.add(id);
    const branch = normBranch(n.branch) ?? "teoria";
    const lvlRaw = Number(n.level);
    const level = Number.isFinite(lvlRaw) ? Math.min(MAX_LEVEL, Math.max(1, Math.round(lvlRaw))) : 1;
    const prereqs = Array.isArray(n.prereqs) ? n.prereqs.map(normId).filter(Boolean) : [];
    const summary = String(n.summary ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
    nodes.push({ id, title, branch, level, prereqs, summary });
    if (nodes.length >= MAX_NODES) break;
  }
  if (nodes.length < MIN_NODES) return null;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    n.prereqs = Array.from(new Set(n.prereqs)).filter((p) => p !== n.id && byId.has(p) && byId.get(p)!.level < n.level);
  }
  // nó sem pré-requisito e level>1 é ok (raiz tardia); mas raiz de level 1 com prereqs é impossível (já filtrado).
  if (!hasAllBranches(nodes)) return null;
  if (hasCycle(nodes)) return null; // impossível após o filtro por level — defesa em profundidade
  return nodes.sort((a, b) => a.level - b.level || a.title.localeCompare(b.title));
}

// ───────────────────────────── fallback (degradado) ─────────────────────────────
/** Trilha linear de 5 nós de teoria — nunca deixa o estudo sem árvore. Ids estáveis (t1..t5). */
export function fallbackTree(topic: string): SkillNode[] {
  const t = topicLabel(topic) || "o tópico";
  const steps: [string, string][] = [
    ["Fundamentos", `Vocabulário e ideias básicas de ${t}.`],
    ["Conceitos-chave", `Os conceitos centrais que sustentam ${t}.`],
    ["Como funciona", `Mecanismos e relações de causa e efeito em ${t}.`],
    ["Casos e exemplos", `Reconhecer ${t} em situações concretas.`],
    ["Síntese e revisão", `Explicar ${t} com as próprias palavras, do começo ao fim.`],
  ];
  return steps.map(([title, summary], i) => ({
    id: `t${i + 1}`,
    title: `${title} de ${t}`.slice(0, 120),
    branch: "teoria" as const,
    level: i + 1,
    prereqs: i === 0 ? [] : [`t${i}`],
    summary,
  }));
}

// ───────────────────────────── geração (Gemini, injetável) ─────────────────────────────
const defaultGenJson: GenJson = async (system, user, opts) => {
  const { geminiJson } = await import("@/lib/scholar/gemini");
  return geminiJson(system, user, opts);
};

/** Gera + valida (1 retry com dica mais estrita). Lança se as duas tentativas falharem. */
export async function generateSkillTree(topic: string, genJson: GenJson = defaultGenJson): Promise<{ nodes: SkillNode[]; model: string }> {
  const model = GEMINI_MODEL_FLASH;
  const user = buildUserPrompt(topic);
  const first = await genJson<unknown>(SKILLTREE_SYSTEM, user, { temperature: 0.3, model, timeoutMs: 30_000 });
  let nodes = sanitizeTree(first);
  if (!nodes) {
    const second = await genJson<unknown>(SKILLTREE_SYSTEM, user + RETRY_HINT, { temperature: 0.2, model, timeoutMs: 30_000 });
    nodes = sanitizeTree(second);
  }
  if (!nodes) throw new Error("skilltree_invalid");
  return { nodes, model };
}

/** Lê do cache por slug; senão gera e grava. Degrada em trilha linear (não cacheada) em falha. */
export async function getOrCreateSkillTree(topic: string, opts?: { genJson?: GenJson }): Promise<SkillTreeDTO> {
  const slug = topicSlug(topic);
  const label = topicLabel(topic);
  const { prisma } = await import("@/src/lib/prisma");
  const cached = await prisma.skillTree.findUnique({ where: { topicSlug: slug } }).catch(() => null);
  if (cached) {
    return { topicSlug: slug, topicLabel: cached.topicLabel, nodes: cached.nodes as unknown as SkillNode[], model: cached.model, degraded: false };
  }
  try {
    const { nodes, model } = await generateSkillTree(label, opts?.genJson);
    try {
      await prisma.skillTree.create({ data: { topicSlug: slug, topicLabel: label, nodes: nodes as any, model } });
    } catch {
      // corrida (dois pedidos do mesmo tópico): quem gravou primeiro vence.
      const again = await prisma.skillTree.findUnique({ where: { topicSlug: slug } }).catch(() => null);
      if (again) return { topicSlug: slug, topicLabel: again.topicLabel, nodes: again.nodes as unknown as SkillNode[], model: again.model, degraded: false };
    }
    return { topicSlug: slug, topicLabel: label, nodes, model, degraded: false };
  } catch (e) {
    if (process.env.NODE_ENV !== "test") console.warn("[skilltree] geração falhou → trilha linear:", (e as any)?.message ?? e);
    return { topicSlug: slug, topicLabel: label, nodes: fallbackTree(label), model: "fallback", degraded: true };
  }
}

/** Nós de um tópico já conhecido (cache) ou a trilha linear (mesmos ids do fallback). */
export async function loadTreeNodes(slug: string): Promise<{ topicLabel: string; nodes: SkillNode[]; degraded: boolean }> {
  const { prisma } = await import("@/src/lib/prisma");
  const cached = await prisma.skillTree.findUnique({ where: { topicSlug: slug } }).catch(() => null);
  if (cached) return { topicLabel: cached.topicLabel, nodes: cached.nodes as unknown as SkillNode[], degraded: false };
  const label = slug.replace(/-/g, " ");
  return { topicLabel: label, nodes: fallbackTree(label), degraded: true };
}
