/**
 * lib/research/unifiedRoom.ts — Sala de Pesquisa UNIFICADA (Estudos + Pesquisa num lugar só).
 *
 * Flag NEXT_PUBLIC_UNIFIED_RESEARCH_ROOM (off por padrão → o merge não muda nada até ligar).
 * É NEXT_PUBLIC_* porque o gate é no cliente (qual sidebar/aba renderiza) — e por isso
 * precisa ser BUILD-ARG no Dockerfile/compose (ver docs/RUNBOOK_PROD_ATIVAR_TCC_DESENHO.md).
 *
 * DUAS SALAS, cada uma = chat + abas (reorganização do handoff UX-resposta):
 *   Sala de Estudos  (tab "sala-de-estudos") = Chat · Meus Estudos · Estudos
 *   Sala de Pesquisa (tab "pesquisa")        = UMA tela só: a folha ("Minhas pesquisas" — documento gerado /
 *                                             leitura do PDF) com o chat ao lado (sem sub-abas desde out/2026;
 *                                             `?sub=` antigo é aceito e ignorado)
 * Alias que sobrou (link antigo não quebra): "pesquisas" → pesquisa + sub-aba pesquisas.
 * ("sala-de-estudos" voltou a ser uma sala de topo; "estudos" deixou de ser sub-aba da Pesquisa.)
 * A aba PROJETOS (Zaeon Code) fica escondida atrás de NEXT_PUBLIC_PROJETOS (off): o código não foi apagado.
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
  | "profile"
  /** a IDE do agente Octa Code — só se abre pelo seletor de agente (não entra em LAB_TABS: deep-link/restauração não abrem) */
  | "octa";

export type ResearchSubTab = "chat" | "pesquisas";

/** Aba Projetos (Zaeon Code): escondida até o dono reativar (NEXT_PUBLIC_PROJETOS=on|1|true). */
export const projetosOn = (): boolean => ["on", "1", "true"].includes(String(process.env.NEXT_PUBLIC_PROJETOS ?? "").toLowerCase());

export const LAB_TABS: readonly LabTab[] = [
  "pesquisa", "sala-de-estudos", "pesquisas", "pevem", "projetos", "escritorio", "news", "profile",
];
export const SUB_TABS: readonly ResearchSubTab[] = ["chat", "pesquisas"];

/** Abas antigas que, na sala unificada, viram sub-abas da Sala de Pesquisa. */
const ALIAS: Partial<Record<LabTab, ResearchSubTab>> = {
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
  projetos: boolean = projetosOn(),
  chatUnico: boolean = on(process.env.NEXT_PUBLIC_CHAT_UNICO),
): { tab: LabTab; subTab?: ResearchSubTab } | null {
  if (typeof tab !== "string" || !(LAB_TABS as readonly string[]).includes(tab)) return null;
  const t = tab as LabTab;
  // CHAT ÚNICO (lib/chat/chatUnico): a Sala de Pesquisa não existe mais — vira o chat da Aura (o modo
  // pesquisa liga por pedido de quem chamou). Projetos escondido cai no mesmo lugar.
  if (chatUnico && (t === "pesquisa" || t === "pesquisas" || (t === "projetos" && !projetos))) return { tab: "sala-de-estudos" };
  // Projetos escondido: links/atalhos antigos (?tab=projetos, voz, localStorage) caem na Sala de Pesquisa.
  if (t === "projetos" && !projetos) return { tab: "pesquisa" };
  if (!unified) return { tab: t };
  const sub = ALIAS[t];
  return sub ? { tab: "pesquisa", subTab: sub } : { tab: t };
}

/** Sub-aba válida? (?sub= e localStorage). */
export function isSubTab(v: unknown): v is ResearchSubTab {
  return typeof v === "string" && (SUB_TABS as readonly string[]).includes(v);
}
