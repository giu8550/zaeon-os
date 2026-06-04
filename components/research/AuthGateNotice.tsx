"use client";
import { useState } from "react";
import { Lock } from "lucide-react";
import ZaeonAuthModal from "@/components/main/OnboardModal";

// Janela de gate de autenticação: aparece quando uma feature autenticada responde 401.
// Reaproveita o fluxo real de login/criar conta do app (ZaeonAuthModal → Google + Convidado).
export default function AuthGateNotice({
  message = "Faça login ou crie sua conta para usar as features disponíveis.",
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`rounded-2xl border border-violet-400/20 bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.18)] ${className}`}
    >
      <div className="mx-auto mb-3 w-11 h-11 rounded-2xl bg-violet-500/10 border border-violet-400/25 flex items-center justify-center">
        <Lock className="text-violet-500 dark:text-violet-300" size={20} />
      </div>
      <p className="text-sm font-semibold text-slate-700 dark:text-white/80 leading-snug max-w-xs mx-auto">
        {message}
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold uppercase tracking-wide px-5 py-2.5 transition-colors shadow-[0_0_20px_rgba(139,92,246,0.25)] cursor-pointer"
      >
        Entrar ou criar conta
      </button>

      <ZaeonAuthModal isOpen={open} onClose={() => setOpen(false)} role="student" />
    </div>
  );
}
