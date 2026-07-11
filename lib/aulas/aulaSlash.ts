/**
 * Opções "/" dos blocos de PERGUNTA da aula (modo teach), derivadas do registro único
 * lib/aulas/blockTypes (READY_BLOCKS). `key` = kind do AULA_BLOCKS; `kind:"aula"` distingue
 * dos blocos de estrutura/studio. PURO (testável).
 */
import type { SlashOption } from "@/lib/study/slashMenu";
import { READY_BLOCKS } from "@/lib/aulas/blockTypes";

export const AULA_SLASH_OPTIONS: SlashOption[] = READY_BLOCKS.map((b) => ({
  key: b.kind, label: b.label, emoji: b.emoji, kind: "aula" as const,
}));

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Filtra os blocos de pergunta pelo texto após a "/" (sem acento, case-insensitive). */
export function filterAulaSlash(query: string): SlashOption[] {
  const q = norm((query || "").trim());
  if (!q) return AULA_SLASH_OPTIONS;
  return AULA_SLASH_OPTIONS.filter((o) => norm(o.label).includes(q) || o.key.includes(q));
}
