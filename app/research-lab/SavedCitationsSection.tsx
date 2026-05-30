"use client";
import { useState } from "react";
import { useSavedCitations } from "@/lib/useSavedCitations";
import { BookMarked, Copy, Check, Download, Trash2 } from "lucide-react";

export default function SavedCitationsSection() {
  const { citations, remove } = useSavedCitations();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  };
  const downloadAll = () => {
    if (citations.length === 0) return;
    const txt = citations.map((c) => c.abnt).join("\n\n");
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "referencias-abnt.txt";
    a.click();
  };

  return (
    <section className="p-6 rounded-[32px] shrink-0 border-2 border-slate-300 dark:border-white/10 bg-white dark:bg-[#0f172a] shadow-xl flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="bg-black dark:bg-white text-white dark:text-black text-[11px] font-black px-5 py-2 rounded-full uppercase tracking-widest flex items-center gap-2 shadow-md">
          <BookMarked className="w-4 h-4" /> Citações Salvas {citations.length > 0 && `(${citations.length})`}
        </span>
        {citations.length > 0 && (
          <button onClick={downloadAll} className="ml-auto px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-full text-[10px] font-black uppercase shadow-md flex items-center gap-2 transition-colors">
            <Download className="w-3.5 h-3.5" /> Baixar todas (.txt)
          </button>
        )}
      </div>

      {citations.length === 0 ? (
        <div className="bg-slate-100 dark:bg-white/5 rounded-2xl p-6 border border-slate-300 dark:border-white/10 text-center">
          <span className="text-xs text-black dark:text-white font-medium italic">
            Nenhuma citação salva. Salve citações no agente Omega Scholar (aba Estudos) — elas aparecem aqui já formatadas em ABNT.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
          {citations.map((c) => (
            <div key={c.id} className="rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-300 dark:border-white/10 p-4">
              <p className="text-[13px] leading-relaxed text-slate-800 dark:text-slate-200 font-serif select-all">{c.abnt}</p>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={() => copy(c.id, c.abnt)} className="inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full border border-slate-300 dark:border-white/15 text-slate-600 dark:text-white/70 hover:border-violet-400">
                  {copiedId === c.id ? <><Check className="w-3 h-3 text-emerald-500" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
                </button>
                {c.pdfUrl ? (
                  <a href={`/api/ai/scholar/pdf?url=${encodeURIComponent(c.pdfUrl)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full border border-violet-300/40 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20">
                    <Download className="w-3 h-3" /> PDF
                  </a>
                ) : c.doi ? (
                  <a href={`https://doi.org/${c.doi}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full border border-slate-300 dark:border-white/15 text-slate-600 dark:text-white/70 hover:border-violet-400">Abrir DOI</a>
                ) : c.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full border border-slate-300 dark:border-white/15 text-slate-600 dark:text-white/70 hover:border-violet-400">Abrir fonte</a>
                ) : null}
                <button onClick={() => remove(c.id)} className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="w-3 h-3" /> Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
