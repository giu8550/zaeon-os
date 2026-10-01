"use client";
/**
 * Bottom sheet com as ações de geração do Studio (reusa o Studio existente). Diálogo modal
 * acessível: role=dialog + aria-modal, Esc fecha, foco vai pro 1º item, alvos ≥ 44px.
 */
import { useEffect, useRef } from "react";
import { ALVO, FOCO, VIDRO } from "@/components/mobile/estilo";

export const ACOES_MOBILE: ReadonlyArray<{ kind: string; rotulo: string; emoji: string }> = [
  { kind: "mindmap", rotulo: "Mapa mental", emoji: "🧠" },
  { kind: "guide", rotulo: "Guia de estudo", emoji: "📘" },
  { kind: "faq", rotulo: "Perguntas e respostas", emoji: "❓" },
  { kind: "flashcards", rotulo: "Flashcards", emoji: "🗂️" },
  { kind: "image", rotulo: "Imagem", emoji: "🖼️" },
  { kind: "podcast", rotulo: "Podcast", emoji: "🎧" },
  { kind: "molecule", rotulo: "Molécula 3D", emoji: "⚛️" },
];

export function MobileActionsSheet({ aberto, onFechar, onEscolher, topico }: {
  aberto: boolean;
  onFechar: () => void;
  onEscolher: (kind: string) => void;
  topico: string;
}) {
  const primeiro = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!aberto) return;
    primeiro.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberto, onFechar]);
  if (!aberto) return null;
  const semTopico = !topico.trim();
  return (
    <div className="fixed inset-0 z-50 flex items-end" role="presentation">
      <button type="button" aria-label="Fechar" tabIndex={-1} onClick={onFechar} className="absolute inset-0 bg-black/40" />
      <div role="dialog" aria-modal="true" aria-labelledby="m-acoes-titulo"
        className={`relative w-full rounded-t-3xl border-t ${VIDRO} bg-white/90 dark:bg-slate-950/90 px-4 pt-3`}
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-400/60" aria-hidden />
        <h2 id="m-acoes-titulo" className="text-base font-semibold text-slate-900 dark:text-white">Gerar a partir da conversa</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-white/60">
          {semTopico ? "Pergunte algo primeiro: o material sai do assunto da conversa." : <>Sobre: <strong className="text-slate-800 dark:text-white/90">{topico.slice(0, 80)}</strong></>}
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {ACOES_MOBILE.map((a, i) => (
            <li key={a.kind}>
              <button ref={i === 0 ? primeiro : undefined} type="button" disabled={semTopico}
                onClick={() => { onEscolher(a.kind); onFechar(); }}
                className={`${ALVO} ${FOCO} w-full rounded-2xl border border-slate-300/60 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] px-3 py-3 text-left text-[15px] text-slate-800 dark:text-white/90 disabled:opacity-40`}>
                <span aria-hidden className="mr-2">{a.emoji}</span>{a.rotulo}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
