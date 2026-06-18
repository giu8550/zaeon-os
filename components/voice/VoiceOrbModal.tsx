"use client";

/**
 * VoiceOrbModal — orbe de voz da Zaeon (full-screen), sutil e sem rótulos.
 *
 * Sem texto de estado ("Falando…"): a própria animação comunica.
 *  - speaking: orbe EXPANDE/pulsa pra fora (ela está falando)
 *  - listening: orbe RETRAI e respira leve (ela está te ouvindo)
 *  - thinking: ⟁ girando discreto
 *
 * Estética Zaeon (violeta→ciano), claro/escuro, respeita prefers-reduced-motion.
 */
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

type OrbState = "listening" | "thinking" | "speaking";

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
  const speaking = state === "speaking";
  const listening = state === "listening";
  // núcleo: expande ao falar, retrai ao escutar
  const coreAnim = speaking
    ? { scale: [1, 1.18, 1] }
    : listening
      ? { scale: [0.82, 0.9, 0.82] }
      : { scale: 1 };
  const coreTrans = { duration: speaking ? 1.1 : 2.2, repeat: Infinity, ease: "easeInOut" as const };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-white/55 dark:bg-[#060912]/70 backdrop-blur-xl"
        >
          <button
            onClick={(e) => { e.stopPropagation(); onClose?.(); }}
            className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-slate-400 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="Fechar voz"
          >
            <X size={20} />
          </button>

          <div className="relative w-56 h-56 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* anéis — expansivos ao falar, recolhidos ao escutar (sutis) */}
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 116 + i * 30,
                  height: 116 + i * 30,
                  background: "radial-gradient(circle, rgba(139,92,246,0.10), rgba(34,211,238,0.03) 70%, transparent 72%)",
                  border: "1px solid rgba(34,211,238,0.16)",
                }}
                animate={state === "thinking"
                  ? { rotate: 360 }
                  : speaking
                    ? { scale: [1, 1.18 - i * 0.02, 1], opacity: [0.35, 0.7, 0.35] }
                    : { scale: [0.82, 0.9, 0.82], opacity: [0.25, 0.4, 0.25] }}
                transition={state === "thinking"
                  ? { duration: 7 + i * 2, repeat: Infinity, ease: "linear" }
                  : { duration: (speaking ? 1.3 : 2.4) + i * 0.3, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
              />
            ))}

            {/* núcleo */}
            <motion.div
              animate={coreAnim}
              transition={coreTrans}
              className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-[0_0_40px_-12px_rgba(139,92,246,0.5)]"
              style={{ background: "linear-gradient(135deg,#8b5cf6,#22d3ee)" }}
            >
              {state === "thinking" ? (
                <span className="text-white text-2xl animate-[spin_4s_linear_infinite] motion-reduce:animate-none" style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.6))" }}>&#10177;</span>
              ) : (
                <div className="flex items-center gap-[5px] h-12">
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <motion.span
                      key={i}
                      className="w-[3px] rounded-full bg-white/90"
                      animate={speaking
                        ? { height: ["22%", "95%", "45%", "100%", "35%", "75%", "30%"] }
                        : { height: ["20%", "34%", "24%"] }}
                      transition={{ duration: (speaking ? 0.7 : 1.6) + (i % 4) * 0.16, repeat: Infinity, ease: "easeInOut", delay: i * 0.06 }}
                      style={{ height: "30%" }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* só a transcrição (quando houver), sem rótulo de estado */}
          {caption && (
            <div className="mt-7 text-center px-8" onClick={(e) => e.stopPropagation()}>
              <p className="text-[14px] text-slate-700 dark:text-white/80 max-w-sm leading-relaxed">{caption}</p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
