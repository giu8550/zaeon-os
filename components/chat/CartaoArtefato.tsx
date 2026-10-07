"use client";
/**
 * O artefato-DOCUMENTO (diagrama interativo, aula) dentro da conversa: só um cartão compacto.
 * "Abrir" leva pra aba dele em "Documentos" — lá ele tem a sala inteira (lib/chat/documentos).
 */
import { ArrowUpRight } from "lucide-react";
import { abrirDocumento, ROTULO_DOC, type DocArtefato } from "@/lib/chat/documentos";

export default function CartaoArtefato({ doc }: { doc: Omit<DocArtefato, "focar"> }) {
  const r = ROTULO_DOC[doc.studioKind] ?? { emoji: "⟁", nome: "Documento" };
  return (
    <button
      type="button"
      onClick={() => abrirDocumento({ ...doc, focar: true })}
      className="group my-2 w-full max-w-[420px] flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.05] px-3.5 py-3 text-left hover:border-cyan-400/60 transition-colors"
    >
      <span className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-[20px] bg-cyan-500/10" aria-hidden>{r.emoji}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-white/50">{r.nome} interativo</span>
        <span className="block truncate text-[14px] font-semibold text-slate-900 dark:text-white">{doc.titulo || r.nome}</span>
      </span>
      <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 group-hover:bg-cyan-600 dark:group-hover:bg-cyan-300">
        Abrir <ArrowUpRight size={13} />
      </span>
    </button>
  );
}
