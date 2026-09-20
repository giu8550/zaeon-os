/**
 * lib/skilltree/types.ts — contratos da Árvore de Habilidades GENERATIVA.
 *
 * A árvore é gerada por IA a partir do TÓPICO (1 por tópico, cache global em `skill_trees`);
 * o progresso é POR usuário e nó (`skill_progress`). Ver docs/SKILLTREE_GENERATIVA.md.
 */

export type SkillBranch = "teoria" | "experimental" | "pratica";
export const BRANCHES: readonly SkillBranch[] = ["teoria", "experimental", "pratica"] as const;

/** Nó do grafo gerado (shape persistido em SkillTree.nodes). */
export type SkillNode = {
  id: string;
  title: string;
  branch: SkillBranch;
  level: number;        // 1 = básico … N = avançado (camada do layout)
  prereqs: string[];    // ids de nós que precisam estar `mastered` para este ficar `available`
  summary: string;
};

export type SkillStatus = "locked" | "available" | "in_progress" | "mastered";

/** Nó + estado do usuário (o que a UI e o mentor consomem). */
export type SkillNodeState = SkillNode & { status: SkillStatus; mastery: number };

export type SkillTreeDTO = {
  topicSlug: string;
  topicLabel: string;
  nodes: SkillNode[];
  model: string;        // provenance ("gemini-2.5-flash" | "fallback")
  degraded: boolean;    // true = trilha linear (geração falhou; NÃO cacheada)
};

/** Limiar de maestria (0..1) a partir do qual o nó conta como dominado e desbloqueia os filhos. */
export const MASTERY_THRESHOLD = 0.8;

/** Normaliza o tópico em slug estável: "Fotossíntese em C4" → "fotossintese-em-c4". */
export function topicSlug(topic: string): string {
  return String(topic ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Rótulo limpo do tópico (o que aparece no painel). */
export function topicLabel(topic: string): string {
  return String(topic ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}
