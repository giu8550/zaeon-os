"use client";

import { motion, AnimatePresence } from "framer-motion";
import { SparklesIcon, XMarkIcon } from "@heroicons/react/24/outline";

const TAB_HINTS: Record<string, { emoji: string; title: string; tip: string }> = {
    news: {
        emoji: "📰",
        title: "Central de Notícias",
        tip: "Explore relatórios mensais e eventos do ecossistema Zaeon. Publicações são filtradas por relevância acadêmica.",
    },
    profile: {
        emoji: "🧬",
        title: "Identidade Neural",
        tip: "Clique nos quadrados da Matriz de Objetivos para registrar seu progresso diário. O gráfico atualiza automaticamente.",
    },
};

interface MiniTourToastProps {
    tab: string | null;
    onDismiss: () => void;
}

export default function MiniTourToast({ tab, onDismiss }: MiniTourToastProps) {
    const hint = tab ? TAB_HINTS[tab] : null;

    return (
        <AnimatePresence>
            {hint && (
                <motion.div
                    key={tab}
                    initial={{ y: 40, opacity: 0, scale: 0.9 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 40, opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    className="fixed bottom-6 right-6 z-[9998] max-w-xs bg-white dark:bg-[#1e293b] border border-cyan-400/40 rounded-[24px] p-5 shadow-2xl shadow-cyan-500/10 flex flex-col gap-2"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">{hint.emoji}</span>
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-white">
                                {hint.title}
                            </span>
                        </div>
                        <button
                            onClick={onDismiss}
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors shrink-0 mt-0.5"
                        >
                            <XMarkIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        {hint.tip}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                        <SparklesIcon className="w-3 h-3 text-cyan-500" />
                        <span className="text-[9px] font-bold text-cyan-500 uppercase tracking-widest">
                            Dica da Zaeon
                        </span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
