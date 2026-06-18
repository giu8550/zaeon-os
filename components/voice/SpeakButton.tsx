"use client";

/**
 * SpeakButton — botão de play (🔊) drop-in para QUALQUER texto gerado.
 * Usa o controlador global (useTTS): um áudio só no app; parar é imediato.
 * Mostra "parar" apenas quando ESTE texto é o que está tocando.
 */
import { Volume2, Square } from "lucide-react";
import useTTS from "@/lib/voice/useTTS";

export default function SpeakButton({
  text,
  size = 13,
  className,
  title = "Ouvir",
}: {
  text: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const { speak, stop, activeText } = useTTS();
  const clean = (text || "").trim();
  if (!clean) return null;
  const mine = activeText === clean; // só este botão mostra "parar"

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); mine ? stop() : speak(clean); }}
      title={mine ? "Parar" : title}
      aria-label={mine ? "Parar leitura" : title}
      className={className ||
        `shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-lg transition-colors ${mine
          ? "text-cyan-600 dark:text-cyan-300 bg-cyan-500/10"
          : "text-slate-400 dark:text-white/40 hover:text-cyan-600 dark:hover:text-cyan-300 hover:bg-cyan-500/10"}`}
    >
      {mine ? <Square size={size - 1} /> : <Volume2 size={size} />}
    </button>
  );
}
