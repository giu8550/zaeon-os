"use client";

/**
 * ThreadTabs — a fila de conversas da Aura, horizontal, com o + no fim.
 *
 * O gesto que todo mundo já conhece de qualquer IA: uma aba por assunto, um botão pra
 * começar do zero. A diferença aqui é que as SALAS (Estudos, Aulas, Pesquisa) ficam
 * paradas na barra lateral — só as conversas entram e saem daqui. Abrir três conversas
 * nunca move a sala de lugar.
 */
import { Plus, X } from "lucide-react";
import type { Thread } from "@/lib/chat/threads";

export default function ThreadTabs({
  threads, ativa, aoTrocar, aoCriar, aoFechar, ocupada, semCriar = false,
}: {
  threads: readonly Thread[];
  ativa: string | null;
  aoTrocar: (id: string) => void;
  aoCriar: () => void;
  aoFechar: (id: string) => void;
  /** id da conversa que está respondendo agora — ganha o ponto pulsando. */
  ocupada?: string | null;
  /** sem o "＋ Nova" (quem tem a barra oferece o próprio ＋) */
  semCriar?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${semCriar ? "" : "overflow-x-auto custom-scrollbar pb-1"}`} role="tablist" aria-label="Conversas">
      {threads.map((t) => {
        const atual = t.id === ativa;
        return (
          <div
            key={t.id}
            role="tab"
            aria-selected={atual}
            tabIndex={0}
            onClick={() => aoTrocar(t.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aoTrocar(t.id); } }}
            title={t.titulo}
            className={`group shrink-0 inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full border cursor-pointer transition-colors max-w-[190px] ${
              atual
                ? "bg-black dark:bg-white text-white dark:text-black border-transparent"
                : "text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/10 hover:border-cyan-400/50"
            }`}
          >
            {ocupada === t.id && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" aria-label="respondendo" />
            )}
            <span className="text-[11px] font-bold truncate">{t.titulo}</span>
            <button
              onClick={(e) => { e.stopPropagation(); aoFechar(t.id); }}
              aria-label={`Fechar ${t.titulo}`}
              className={`shrink-0 rounded-full p-0.5 transition-opacity ${
                atual ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover:opacity-70 hover:!opacity-100"
              }`}
            >
              <X size={11} />
            </button>
          </div>
        );
      })}

      {!semCriar && <button
        onClick={aoCriar}
        title="Nova conversa"
        aria-label="Nova conversa"
        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-dashed border-slate-300 dark:border-white/15 text-slate-600 dark:text-white/60 hover:border-cyan-400/60 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors"
      >
        <Plus size={13} />
        <span className="text-[11px] font-bold">Nova</span>
      </button>}
    </div>
  );
}
