"use client";
/**
 * components/research/AbntToolbar.tsx — a barra simples do editor ABNT: o aluno clica em "Figura",
 * "Tabela", "Citação longa"… e o bloco certo entra no texto. Ninguém precisa decorar `%%tabela` nem
 * `![...](...)`. "Prévia ABNT" alterna entre escrever e ver como sai.
 */
import { useRef } from "react";
import { BLOCOS } from "@/lib/abntBlocks";

export type BlocoAbnt = keyof typeof BLOCOS;

const BOTOES: Array<{ id: BlocoAbnt; rotulo: string; dica: string }> = [
  { id: "secao", rotulo: "Seção", dica: "Novo título de seção (1, 2, 3…)" },
  { id: "subsecao", rotulo: "Subseção", dica: "Novo subtítulo (1.1, 1.2…)" },
  { id: "citacaoLonga", rotulo: "Citação longa", dica: "Citação direta com mais de 3 linhas (vira bloco recuado 4 cm)" },
  { id: "tabela", rotulo: "Tabela", dica: "Tabela com título e fonte (padrão IBGE)" },
  { id: "quadro", rotulo: "Quadro", dica: "Quadro fechado (dado qualitativo)" },
];

const btn = "px-3 h-8 rounded-full text-[12px] font-semibold text-slate-600 dark:text-white/70 hover:text-cyan-600 dark:hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors whitespace-nowrap";

export default function AbntToolbar({ onInsert, onImagem, previa, onPrevia }: {
  onInsert: (b: BlocoAbnt) => void;
  onImagem: (f: File) => void;
  previa: boolean;
  onPrevia: (v: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="shrink-0 flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1" role="toolbar" aria-label="Inserir elementos ABNT" onClick={(e) => e.stopPropagation()}>
      <div className="flex rounded-full bg-slate-100 dark:bg-white/5 p-0.5 mr-2 shrink-0">
        <button type="button" onClick={() => onPrevia(false)} aria-pressed={!previa}
          className={`px-3 h-7 rounded-full text-[12px] font-semibold ${!previa ? "bg-white dark:bg-white/15 text-black dark:text-white shadow-sm" : "text-slate-500 dark:text-white/50"}`}>
          Escrever
        </button>
        <button type="button" onClick={() => onPrevia(true)} aria-pressed={previa}
          className={`px-3 h-7 rounded-full text-[12px] font-semibold ${previa ? "bg-white dark:bg-white/15 text-black dark:text-white shadow-sm" : "text-slate-500 dark:text-white/50"}`}>
          Prévia ABNT
        </button>
      </div>
      {!previa && (
        <>
          {BOTOES.map((b) => (
            <button key={b.id} type="button" title={b.dica} className={btn} onClick={() => onInsert(b.id)}>{b.rotulo}</button>
          ))}
          <button type="button" title="Escolher imagem — vira Figura N com título e fonte" className={btn} onClick={() => fileRef.current?.click()}>Figura</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImagem(f); e.target.value = ""; }} />
        </>
      )}
    </div>
  );
}
