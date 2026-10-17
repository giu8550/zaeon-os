"use client";
/**
 * Presença das pessoas no chat do escritório (#423, parte 3):
 *   LinhaSistema   → "Martinez entrou no escritório" (linha do sistema, centralizada, sem balão).
 *   AvisoDigitando → "Giulia está digitando…" (passageiro, no mesmo lugar do aviso dos agentes).
 * Regras e frases em lib/canal/presenca.ts.
 */
import { textoDigitando } from "@/lib/canal/presenca";
import { TXT_MUDO, TXT_2 } from "@/lib/canal/vidro";

export function LinhaSistema({ texto, hora }: { texto: string; hora?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-1">
      <span className={`px-3 py-1 rounded-full text-[11.5px] bg-slate-500/10 dark:bg-white/[0.06] ${TXT_2}`}>{texto}</span>
      {hora && <span className={`text-[10px] ${TXT_MUDO}`}>{hora}</span>}
    </div>
  );
}

export function AvisoDigitando({ nomes }: { nomes: string[] }) {
  const texto = textoDigitando(nomes);
  if (!texto) return null;
  return (
    <div aria-live="polite" className={`px-1 text-[12px] ${TXT_MUDO}`}>
      {texto}<span className="animate-pulse">…</span>
    </div>
  );
}
