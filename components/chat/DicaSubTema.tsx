"use client";
/** Chat vazio de uma sub-conversa: diz de qual conversa ela saiu (o contexto da mãe vai junto nos envios). */
import { CornerDownRight } from "lucide-react";
import type { Thread } from "@/lib/chat/threads";

export default function DicaSubTema({ threads, ativa }: { threads: readonly Thread[]; ativa: string | null }) {
  const atual = threads.find((t) => t.id === ativa);
  const mae = atual?.parentId ? threads.find((t) => t.id === atual.parentId) : null;
  if (!mae) return null;
  return (
    <p className="text-[13px] leading-relaxed text-slate-600 dark:text-white/60">
      <CornerDownRight size={14} aria-hidden className="inline -mt-0.5 mr-1.5" />
      Sub-tema de <strong className="font-semibold text-slate-800 dark:text-white/85">“{mae.titulo}”</strong> — o contexto dessa conversa vai junto.
    </p>
  );
}
