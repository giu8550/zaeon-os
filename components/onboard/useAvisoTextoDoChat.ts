"use client";
/** #618: o chat avisa o tour quando o campo fica com texto ou vazio (o contorno passa pro ➤ e volta) — EVT_CHAT_TEXTO */
import { useEffect } from "react";
import { EVT_CHAT_TEXTO } from "@/lib/onboarding/tourSala";

export function useAvisoTextoDoChat(texto: string): void {
  const temTexto = !!texto.trim();
  useEffect(() => { window.dispatchEvent(new CustomEvent(EVT_CHAT_TEXTO, { detail: temTexto })); }, [temTexto]);
}
