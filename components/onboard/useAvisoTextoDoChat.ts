"use client";
/** #618: o chat avisa o tour quando o campo fica com texto ou vazio (o contorno passa pro ➤ e volta) — EVT_CHAT_TEXTO.
 *  #629: avisa a CADA mudança (não só vazio ↔ cheio) — o tour espera a pessoa parar de digitar antes de mandar apertar. */
import { useEffect } from "react";
import { EVT_CHAT_TEXTO } from "@/lib/onboarding/tourSala";

export function useAvisoTextoDoChat(texto: string): void {
  useEffect(() => { window.dispatchEvent(new CustomEvent(EVT_CHAT_TEXTO, { detail: !!texto.trim() })); }, [texto]);
}
