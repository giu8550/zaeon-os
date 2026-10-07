"use client";
/**
 * O lugar das CONVERSAS na sidebar PRINCIPAL do app (estilo ChatGPT/Claude: navegação em cima,
 * conversas da sala embaixo, numa coluna só). A página (app/research-lab/page.tsx) põe um <div>
 * vazio na sidebar e o publica aqui; o chat da sala ativa desenha a lista dele lá por portal —
 * o estado continua no chat. Sem provedor (workstation embutida, testes) o chat desenha a lista
 * ao lado de si, como antes.
 */
import { createContext, useContext } from "react";

export type SlotConversas = { el: HTMLElement | null; sala: "estudos" | "pesquisa" | null };
export const ConversasSlotContext = createContext<SlotConversas | null>(null);

/**
 * O <div> da sidebar onde ESTA sala desenha as conversas — só se ela é a sala ativa (as duas salas
 * podem estar montadas ao mesmo tempo; só uma lista aparece). `undefined` = não há sidebar
 * principal (desenhe ao lado do chat); `null` = há, mas é de outra sala (não desenhe).
 */
export function useConversasSlot(sala: "estudos" | "pesquisa"): HTMLElement | null | undefined {
  const ctx = useContext(ConversasSlotContext);
  if (!ctx) return undefined;
  return ctx.sala === sala ? ctx.el : null;
}
