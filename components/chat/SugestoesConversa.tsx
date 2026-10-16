"use client";
/**
 * As 3 SUGESTÕES da conversa nova (pedido do dono, out/2026): "Quero estudar sobre:", "Me ensina a…" e "Faz isso aqui
 * pra mim:" — azuladas e destacadas, logo abaixo do rosto da Aura. Clicar põe o começo no campo de texto (a pessoa
 * completa com o tema) e leva o cursor pra lá. No tutorial do tablet, é aqui que o Droid aponta (data-tour).
 */
import { SUGESTOES_CONVERSA } from "@/lib/onboarding/tutorialLab";

const ICONE = ["✦", "💡", "⚡"] as const;

export default function SugestoesConversa({ onEscolher }: { onEscolher: (comeco: string) => void }) {
  return (
    <div data-tour="sugestoes" className="mx-auto mt-6 flex w-full max-w-[640px] flex-wrap justify-center gap-2.5 px-2">
      {SUGESTOES_CONVERSA.map((s, i) => (
        <button
          key={s}
          type="button"
          onClick={() => onEscolher(s)}
          className="group inline-flex min-h-[42px] items-center gap-2 rounded-2xl border px-4 py-2 text-[14px] font-semibold transition-all
            border-sky-300/70 bg-gradient-to-b from-sky-50 to-blue-100/80 text-blue-900 shadow-[0_8px_22px_-12px_rgba(37,99,235,.7)] hover:-translate-y-0.5 hover:border-sky-400
            dark:border-sky-300/35 dark:from-sky-400/15 dark:to-blue-500/10 dark:text-sky-100 dark:shadow-[0_0_24px_-8px_rgba(56,189,248,.7)] dark:hover:border-sky-300/70"
        >
          <span aria-hidden className="text-sky-500 dark:text-sky-300">{ICONE[i]}</span>
          {s.trim().replace(/:$/, ":")}{s.trim().endsWith(":") ? "" : "…"}
        </button>
      ))}
    </div>
  );
}
