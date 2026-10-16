/**
 * MEUS ESTUDOS → ITENS DO GAME (PURO). O harness do board leva a criar um ITEM no jogo (o dono, out/2026): cada estudo
 * vira um LIVRO no inventário do cyberespaço, que EVOLUI com o estudo — a raridade e o nível vêm do blueprint
 * (lib/estudos/blueprint: profundidade + selos) —, e aparece como livro na biblioteca do cyberespaço. Trabalhar no
 * estudo (confirmar na literatura, ligar o entregável) faz o item subir de nível na frente da pessoa.
 */
import { contarPalavras, paginasDe } from "@/lib/onboarding/tutorialLab";
import { montarBlueprint, raridadeDe, type Raridade } from "./blueprint";
import type { CardEstudo } from "./board";

export type ItemEstudo = {
  id: string; boardId: string; cardId: string;
  titulo: string; raridade: Raridade; nivel: number;
  componentes: number; fontes: number; vendavel: boolean;
  /** a evolução: a próxima raridade e quantos pontos faltam (null = já é lendária) */
  proxima: { raridade: Raridade; faltam: number } | null;
};
const LIMIARES: [Raridade, number][] = [["rara", 25], ["epica", 50], ["lendaria", 75]];
export function proximaRaridade(nivel: number): { raridade: Raridade; faltam: number } | null {
  const atual = raridadeDe(nivel), i = LIMIARES.findIndex(([r]) => r === atual);
  const prox = atual === "comum" ? LIMIARES[0] : LIMIARES[i + 1];
  return prox ? { raridade: prox[0], faltam: Math.max(0, prox[1] - nivel) } : null;
}
/** todos os estudos dos boards → os itens (os mais fortes primeiro) */
export function itensDosBoards(boards: readonly { id: string; cards: readonly CardEstudo[] }[], agora = Date.now()): ItemEstudo[] {
  const out: ItemEstudo[] = [];
  for (const b of boards) for (const c of b.cards) {
    if (c.tipo !== "estudo") continue;
    const bp = montarBlueprint(b.cards, c.id, agora); if (!bp) continue;
    out.push({ id: `${b.id}:${c.id}`, boardId: b.id, cardId: c.id, titulo: bp.titulo, raridade: bp.raridade, nivel: bp.pontos, componentes: bp.componentes.length, fontes: bp.fontes.length, vendavel: bp.vendavel, proxima: proximaRaridade(bp.pontos) });
  }
  return out.sort((a, b) => b.nivel - a.nivel);
}

/** uma PESQUISA (ResearchWork) como item do inventário: um livro-holograma com as páginas escritas */
export type ItemPesquisa = { id: string; titulo: string; paginas: number; palavras: number; atualizadoEm: string | null };
export function pesquisaComoItem(w: { id: string; title?: string | null; content?: string | null; updatedAt?: Date | string | null }): ItemPesquisa {
  const palavras = contarPalavras(w.content ?? "");
  const t = w.updatedAt ? new Date(w.updatedAt) : null;
  return { id: w.id, titulo: (w.title ?? "").replace(/\.(pdf|docx)$/i, "").trim() || "Pesquisa sem título", paginas: paginasDe(palavras), palavras, atualizadoEm: t && !isNaN(t.getTime()) ? t.toISOString() : null };
}
