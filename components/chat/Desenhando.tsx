"use client";
/** O diagrama interativo leva ~20 s: um aviso discreto no lugar onde ele vai aparecer. */
export default function Desenhando() {
  return (
    <div role="status" className="my-2 flex items-center gap-2 rounded-xl border border-dashed border-cyan-400/40 px-3 py-2.5 text-[13px] text-slate-600 dark:text-white/65">
      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" aria-hidden />
      Desenhando o diagrama interativo…
    </div>
  );
}
