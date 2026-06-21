"use client";

/**
 * UpgradeCard — cartão (modal) no estilo Zaeon para quando o usuário bate num limite
 * ou tenta usar um recurso premium (voz, profundo, projetos, ou cota da pesquisa).
 *
 * Visual: vidro fosco, gradiente violeta→ciano, ⟁. Claro e escuro. Oferece upgrade
 * (vai pra /about#planos) ou inserir código de convite.
 */
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function UpgradeCard({
  open,
  title,
  message,
  plan = "Plus",
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  plan?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-[2rem] p-[1.5px] bg-gradient-to-br from-violet-500/70 to-cyan-400/70 shadow-2xl"
          >
            <div className="rounded-[1.9rem] bg-white dark:bg-[#0b1120] p-7 flex flex-col items-center text-center">
              <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white/80"><X size={18} /></button>

              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-[0_8px_24px_-6px_rgba(139,92,246,0.6)]"
                style={{ background: "linear-gradient(135deg,#8b5cf6,#22d3ee)" }}>
                &#10177;
              </div>

              <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">{title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600 dark:text-white/70">{message}</p>

              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest text-white"
                style={{ background: "linear-gradient(135deg,#7c3aed,#06b6d4)" }}>
                disponível no {plan}
              </div>

              <button
                onClick={() => { onClose(); router.push("/about#planos"); }}
                className="mt-6 w-full py-3 rounded-2xl text-white font-black uppercase tracking-widest text-[12px] transition-transform hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg,#7c3aed,#06b6d4)", boxShadow: "0 12px 30px -10px rgba(34,211,238,0.55)" }}
              >
                Ver planos
              </button>
              <button
                onClick={() => { onClose(); router.push("/?invite=1"); }}
                className="mt-2 text-[11px] font-bold text-slate-500 dark:text-white/50 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors"
              >
                Tenho um código de convite
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
