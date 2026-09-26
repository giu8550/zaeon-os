"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useSession } from "next-auth/react";
import { UserIcon } from "@heroicons/react/24/outline";

// Componentes Internos
import MenuNavigation from "@/components/sub/MenuNavigation";
import StarBackground from "@/components/main/star-background";
import InviteButton from "@/components/sub/InviteButton";
import { UserPlus } from "lucide-react";

// Mural de modelos (v2): as IAs que o público já conhece, num lugar só.
// Texto, não logos oficiais (limpo + evita marca de terceiros). Os "extras"
// ficam mais discretos que os quatro principais.
const MODELS_MAIN = [
  { name: "GPT", org: "OpenAI" },
  { name: "Claude", org: "Anthropic" },
  { name: "Gemini", org: "Google" },
  { name: "Grok", org: "xAI" },
];
const MODELS_MORE = ["Llama", "DeepSeek", "Mistral"];

export default function HeroPage() {
  const { t } = useTranslation();
  const { status } = useSession();

  const [showChatbox, setShowChatbox] = useState(false);

  // Redireciona diretamente para o chat caso já esteja logado
  useEffect(() => {
    if (status === "authenticated") {
      setShowChatbox(true);
    }
  }, [status]);

  return (
    <main className="w-full min-h-screen flex flex-col items-start justify-start relative px-8 md:px-16 lg:px-24 pt-24 md:pt-32 lg:pt-40 pb-20 overflow-hidden transition-colors duration-700 font-sans">

      {/* BACKGROUND LIMPO - Apenas o StarBackground visível */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <StarBackground />
      </div>

      {/* ========================================= */}
      {/* HERO v2 — TODAS AS IAS, FEITO PRA CIÊNCIA */}
      {/* ========================================= */}
      <motion.div
        animate={{
          scale: showChatbox ? 0.9 : 1,
          y: showChatbox ? -30 : 0,
          opacity: 1,
        }}
        transition={{ type: "spring", stiffness: 90, damping: 20 }}
        className="flex flex-col items-start text-left max-w-4xl z-10 w-full origin-left"
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative flex flex-col items-start justify-center"
        >
          <h1 className="text-3xl sm:text-4xl md:text-[3.5rem] font-light tracking-tighter text-slate-900 dark:text-white leading-[1.15] z-10 relative">
            Todas as IAs. Um lugar só. <br className="hidden md:block" />
            Feito pra{" "}
            <span
              className="cyber-glitch relative inline-block font-semibold text-cyan-600 dark:text-cyan-400"
              data-text="ciência"
            >
              ciência
            </span>
            .
          </h1>

          <AnimatePresence>
            {!showChatbox && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 24 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <p className="max-w-2xl text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-400 font-light leading-relaxed">
                  GPT, Claude, Gemini, Grok e mais — num sistema interativo onde você não só
                  conversa, você{" "}
                  <span className="text-slate-800 dark:text-slate-200 font-normal">
                    produz conhecimento
                  </span>
                  .
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* CTAs */}
        <AnimatePresence>
          {!showChatbox && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mt-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-center justify-start"
            >
              <button
                onClick={() => setShowChatbox(true)}
                className="group relative flex items-center justify-center gap-3 px-10 py-4 rounded-full bg-cyan-500 text-slate-950 font-semibold uppercase tracking-[0.18em] text-[11px] overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_28px_rgba(34,211,238,0.45)]"
              >
                <UserIcon className="w-4 h-4" />
                Começar grátis
              </button>
              <a
                href="#modelos"
                className="group relative flex items-center justify-center gap-3 px-10 py-4 rounded-full border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 font-medium uppercase tracking-[0.18em] text-[11px] transition-all hover:border-cyan-400 hover:scale-105 bg-transparent"
              >
                Ver os modelos
              </a>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MURAL DE MODELOS + TEASER DA TRIANGULAÇÃO */}
        <AnimatePresence>
          {!showChatbox && (
            <motion.div
              id="modelos"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="mt-14 w-full max-w-3xl scroll-mt-28"
            >
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-500 mb-4">
                Todos num só lugar
              </p>
              <div className="flex flex-wrap gap-3">
                {MODELS_MAIN.map((m) => (
                  <span
                    key={m.name}
                    className="text-xs text-slate-700 dark:text-slate-200 border border-slate-300/60 dark:border-white/12 rounded-lg px-3.5 py-2 bg-white/40 dark:bg-white/[0.03] backdrop-blur-sm"
                  >
                    <span className="font-medium">{m.name}</span>
                    <span className="text-slate-400 dark:text-slate-500"> · {m.org}</span>
                  </span>
                ))}
                {MODELS_MORE.map((name) => (
                  <span
                    key={name}
                    className="text-xs text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-white/10 rounded-lg px-3.5 py-2 bg-white/30 dark:bg-white/[0.02]"
                  >
                    {name}
                  </span>
                ))}
              </div>

              <div className="mt-6 flex items-center gap-2.5">
                <span className="text-sm italic text-slate-500 dark:text-slate-400">
                  Por que vários modelos? Porque ciência é triangular.
                </span>
                <span className="text-sm text-cyan-600 dark:text-cyan-400">→</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ========================================= */}
      {/* CHATBOX (Aparece ao logar / clicar começar) */}
      {/* ========================================= */}
      <AnimatePresence>
        {showChatbox && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: -20, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
            className="w-full max-w-[760px] z-20 mt-0 relative origin-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-full max-w-[500px] shrink-0">
                <MenuNavigation />
              </div>
              {/* Convite = card próprio à direita, centralizado na linha do menu */}
              {status === "authenticated" && (
                <div className="hidden lg:flex w-56 shrink-0 flex-col">
                  <div className="rounded-[28px] p-4 backdrop-blur-2xl bg-white/40 dark:bg-cyan-950/10 border border-slate-200 dark:border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-white/55 mb-1.5 flex items-center gap-1.5"><UserPlus size={13} /> Convide</p>
                    <p className="text-[11px] text-slate-500 dark:text-white/50 mb-3 leading-relaxed">Traga um amigo pra Zaeon e cresçam juntos.</p>
                    <InviteButton variant="menu" />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSS do Glitch Holográfico Elegante (assinatura da casa) */}
      <style jsx global>{`
        .cyber-glitch {
          position: relative;
        }

        .cyber-glitch::before,
        .cyber-glitch::after {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: transparent;
          pointer-events: none;
        }

        .cyber-glitch::before {
          left: 1px;
          text-shadow: -1px 0 rgba(6, 182, 212, 0.8);
          clip-path: polygon(0 0, 100% 0, 100% 10%, 0 10%);
          animation: glitch-elegant-1 3.5s infinite linear alternate-reverse;
        }

        .cyber-glitch::after {
          left: -1px;
          text-shadow: 1px 0 rgba(255, 255, 255, 0.3);
          clip-path: polygon(0 80%, 100% 80%, 100% 100%, 0 100%);
          animation: glitch-elegant-2 4s infinite linear alternate-reverse;
        }

        @keyframes glitch-elegant-1 {
          0% { clip-path: polygon(0 15%, 100% 15%, 100% 25%, 0 25%); transform: translate(0); }
          10% { clip-path: polygon(0 45%, 100% 45%, 100% 50%, 0 50%); transform: translate(-1px, 1px); }
          20% { clip-path: polygon(0 85%, 100% 85%, 100% 90%, 0 90%); transform: translate(1px, -1px); }
          30% { clip-path: polygon(0 10%, 100% 10%, 100% 20%, 0 20%); transform: translate(0); }
          40% { clip-path: polygon(0 60%, 100% 60%, 100% 70%, 0 70%); transform: translate(-1px, 0); }
          50% { clip-path: polygon(0 30%, 100% 30%, 100% 40%, 0 40%); transform: translate(0); }
          60%, 100% { clip-path: polygon(0 0, 0 0, 0 0, 0 0); transform: translate(0); }
        }

        @keyframes glitch-elegant-2 {
          0%, 40% { clip-path: polygon(0 0, 0 0, 0 0, 0 0); transform: translate(0); }
          50% { clip-path: polygon(0 20%, 100% 20%, 100% 30%, 0 30%); transform: translate(1px, 0); }
          60% { clip-path: polygon(0 75%, 100% 75%, 100% 80%, 0 80%); transform: translate(-1px, 1px); }
          70% { clip-path: polygon(0 40%, 100% 40%, 100% 55%, 0 55%); transform: translate(0); }
          80% { clip-path: polygon(0 80%, 100% 80%, 100% 90%, 0 90%); transform: translate(1px, -1px); }
          90% { clip-path: polygon(0 5%, 100% 5%, 100% 15%, 0 15%); transform: translate(-1px, 0); }
          100% { clip-path: polygon(0 60%, 100% 60%, 100% 65%, 0 65%); transform: translate(0); }
        }
      `}</style>
    </main>
  );
}
