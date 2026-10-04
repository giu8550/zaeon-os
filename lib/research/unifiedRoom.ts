/**
 * lib/research/unifiedRoom.ts — Sala de Pesquisa UNIFICADA (Estudos + Pesquisa num lugar só).
 *
 * Flag NEXT_PUBLIC_UNIFIED_RESEARCH_ROOM (off por padrão → o merge não muda nada até ligar).
 * É NEXT_PUBLIC_* porque o gate é no cliente (qual sidebar/aba renderiza) — e por isso
 * precisa ser BUILD-ARG no Dockerfile/compose (ver docs/RUNBOOK_PROD_ATIVAR_TCC_DESENHO.md).
 *
 * Ligada: a sidebar perde "Sala de Estudos"; a "Sala de Pesquisa" ganha sub-abas horizontais
 * Chat · Estudos · Pesquisas. As abas de topo antigas viram ALIAS (links/tour não quebram):
 *   sala-de-estudos → pesquisa + estudos
 *   pesquisas       → pesquisa + pesquisas
 */
const on = (v: string | undefined) => v === "1" || v === "true";

export const unifiedResearchRoom = (): boolean =>
  on(process.env.NEXT_PUBLIC_UNIFIED_RESEARCH_ROOM) || on(process.env.UNIFIED_RESEARCH_ROOM);

export type LabTab =
  | "pesquisa"
  | "sala-de-estudos"
  | "pesquisas"
  | "pevem"
  | "projetos"
  | "escritorio"
  | "news"
  | "profile";

export type ResearchSubTab = "chat" | "estudos" | "pesquisas";

export const LAB_TABS: readonly LabTab[] = [
  "pesquisa", "sala-de-estudos", "pesquisas", "pevem", "projetos", "escritorio", "news", "profile",
];
export const SUB_TABS: readonly ResearchSubTab[] = ["chat", "estudos", "pesquisas"];

/** Abas antigas que, na sala unificada, viram sub-abas da Sala de Pesquisa. */
const ALIAS: Partial<Record<LabTab, ResearchSubTab>> = {
  "sala-de-estudos": "estudos",
  pesquisas: "pesquisas",
};

/**
 * Normaliza um pedido de aba (deep-link ?tab=, localStorage, evento zaeon:set-tab, tour).
 * - inválida → null (quem chama ignora / cai no default);
 * - flag off → a aba como veio (layout atual intacto);
 * - flag on  → alias pra `pesquisa` + a sub-aba correspondente. `subTab` ausente = não mexe.
 */
export function resolveLabTab(
  tab: unknown,
  unified: boolean,
): { tab: LabTab; subTab?: ResearchSubTab } | null {
  if (typeof tab !== "string" || !(LAB_TABS as readonly string[]).includes(tab)) return null;
  const t = tab as LabTab;
  if (!unified) return { tab: t };
  const sub = ALIAS[t];
  return sub ? { tab: "pesquisa", subTab: sub } : { tab: t };
}

/** Sub-aba válida? (?sub= e localStorage). */
export function isSubTab(v: unknown): v is ResearchSubTab {
  return typeof v === "string" && (SUB_TABS as readonly string[]).includes(v);
}
