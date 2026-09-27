"use client";

/**
 * Preenchimento de lacunas por arrastar/tocar/teclar (acessível). Reusa o reducer puro
 * lib/aulas/dragPlacement. Mouse: HTML5 DnD. Toque/teclado: "pega" um chip (clique/Enter) e
 * "solta" numa lacuna (clique/Enter). cloze (allowType) também permite digitar.
 */
import { useState } from "react";
import { placeWord, clearSlot, bankAvailable } from "@/lib/aulas/dragPlacement";

export default function WordDrag({ slots, bank, value, onChange, allowType, locked, correct }: {
  slots: number; bank: string[]; value: (string | null)[]; onChange: (v: (string | null)[]) => void;
  allowType?: boolean; locked?: boolean; correct?: boolean[];
}) {
  const v: (string | null)[] = Array.from({ length: slots }, (_, i) => value[i] ?? null);
  const [picked, setPicked] = useState<string | null>(null); // palavra "pega" via teclado/clique
  const avail = bankAvailable(bank, v);
  const drop = (slotIdx: number, word: string) => { if (!locked && word) onChange(placeWord(v, word, slotIdx)); setPicked(null); };
  const slotCls = (i: number) =>
    locked && correct ? (correct[i] ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100" : "border-rose-400/60 bg-rose-500/10 text-rose-100")
      : "border-cyan-400/30 bg-white/5 text-white";

  return (
    <div className="flex flex-col gap-3">
      {/* lacunas (slots) — clicáveis/dropáveis/focáveis */}
      <div className="flex flex-wrap items-center gap-2">
        {v.map((w, i) => (
          <button key={i} type="button" disabled={locked}
            aria-label={`Lacuna ${i + 1}${w ? `: ${w}` : " vazia"}`}
            onClick={() => { if (locked) return; if (picked) drop(i, picked); else if (w) onChange(clearSlot(v, i)); }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); drop(i, e.dataTransfer.getData("text/plain")); }}
            className={`min-w-[72px] min-h-[34px] rounded-lg border px-2 text-[13px] transition-colors ${slotCls(i)}`}>
            {w || (allowType ? "" : "—")}
          </button>
        ))}
      </div>

      {/* opção de DIGITAR (cloze) */}
      {allowType && !locked && (
        <div className="flex flex-wrap gap-2">
          {v.map((w, i) => (
            <input key={i} value={w || ""} onChange={(e) => onChange(placeWord(v, e.target.value, i))}
              placeholder={`lacuna ${i + 1}`}
              className="w-28 rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[12px] text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50" />
          ))}
        </div>
      )}

      {/* banco de palavras — arrastáveis (mouse) e "pegáveis" (toque/teclado) */}
      {!locked && (
        <div className="flex flex-wrap gap-2">
          {avail.map((w, k) => (
            <button key={`${w}-${k}`} type="button" draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", w)}
              onClick={() => setPicked(picked === w ? null : w)}
              aria-grabbed={picked === w}
              title="Arraste para a lacuna, ou clique aqui e depois na lacuna"
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold border cursor-grab active:cursor-grabbing transition-colors ${picked === w ? "border-cyan-400 bg-cyan-500/20 text-white" : "border-white/15 bg-white/[0.06] text-white/85 hover:border-cyan-400/40"}`}>
              {w}
            </button>
          ))}
          {avail.length === 0 && <span className="text-[11.5px] text-white/30 italic">todas as palavras foram usadas</span>}
        </div>
      )}
    </div>
  );
}
