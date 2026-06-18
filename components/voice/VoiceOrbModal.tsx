"use client";

/**
 * VoiceOrbModal — modal de "ondas vocais" da Zaeon (full-screen).
 *
 * Estética Zaeon: gradiente violeta (#8b5cf6) → ciano (#22d3ee), vidro fosco, glow.
 * Funciona em claro e escuro. Respeita prefers-reduced-motion.
 *
 * Estados:
 *  - "listening": ondas pulsando (a pessoa fala)
 *  - "thinking":  órbita girando (só backend processando)
 *  - "speaking":  ondas seguindo a fala da Zaeon
 *
 * Ondas sintéticas (sem permissão extra de áudio) — robusto em qualquer device.
 */
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

type OrbState = "listening" | "thinking" | "speaking";

const LABEL: Record<OrbState, string> = {
  listening: "Ouvindo…",
  thinking: "Pensando…",
  speaking: "Falando…",
};

export default function VoiceOrbModal({
  open,
  state = "listening",
  caption,
  onClose,
}: {
  open: boolean;
  state?: OrbState;
  caption?: string;
  onClose?: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-white/70 dark:bg-[#060912]/80 backdrop-blur-2xl"
        >
          <button
            onClick={(e) => { e.stopPropagation(); onClose?.(); }}
            className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-slate-500 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="Fechar voz"
          >
            <X size={20} />
          </button>

          {/* Orbe de ondas */}
          <div className="relative w-56 h-56 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* anéis pulsando */}
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 120 + i * 34,
                  height: 120 + i * 34,
                  background: "radial-gradient(circle, rgba(139,92,246,0.18), rgba(34,211,238,0.05) 70%, transparent 72%)",
                  border: "1px solid rgba(34,211,238,0.25)",
                }}
                animate={state === "thinking"
                  ? { rotate: 360 }
                  : { scale: [1, 1.12 - i * 0.02, 1], opacity: [0.5, 0.85, 0.5] }}
                transition={state === "thinking"
                  ? { duration: 6 + i * 2, repeat: Infinity, ease: "linear" }
                  : { duration: 1.6 + i * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
              />
            ))}

            {/* núcleo: barras de onda (listening/speaking) ou ⟁ girando (thinking) */}
            <div className="relative w-28 h-28 rounded-full flex items-center justify-center shadow-[0_0_50px_-8px_rgba(139,92,246,0.6)]"
              style={{ background: "linear-gradient(135deg,#8b5cf6,#22d3ee)" }}>
              {state === "thinking" ? (
                <span className="text-white text-3xl animate-[spin_4s_linear_infinite] motion-reduce:animate-none" style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.6))" }}>&#10177;</span>
              ) : (
                <div className="flex items-end gap-1.5 h-12">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1.5 rounded-full bg-white/90"
                      animate={{ height: ["18%", "100%", "40%", "85%", "25%"] }}
                      transition={{ duration: 0.9 + (i % 3) * 0.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }}
                      style={{ height: "40%" }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 text-center px-8" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-black uppercase tracking-[0.2em] bg-gradient-to-r from-violet-500 to-cyan-500 bg-clip-text text-transparent">{LABEL[state]}</p>
            {caption && <p className="mt-2 text-[13px] text-slate-600 dark:text-white/70 max-w-xs leading-relaxed">{caption}</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
