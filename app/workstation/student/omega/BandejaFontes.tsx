"use client";
/**
 * A BANDEJA de fontes da pesquisa (tela roxa do Marketplace › Estudos): o que a pessoa já guardou — os artigos salvos na
 * biblioteca e as citações — num lugar só, à vista, logo abaixo da barra da pesquisa. É onde as REFERÊNCIAS e os
 * ESTUDOS RELACIONADOS salvos "caem" (o tutorial do tablet mostra ela em destaque).
 */
import { useLibraryFiles } from "@/lib/useLibraryFiles";
import { useSavedCitations } from "@/lib/useSavedCitations";

export default function BandejaFontes() {
  const { files } = useLibraryFiles();
  const { citations } = useSavedCitations();
  const itens = [...files.map((f) => ({ id: `f-${f.id}`, t: f.title, k: "📄" })), ...citations.map((c) => ({ id: `c-${c.id}`, t: c.title, k: "🔖" }))];
  return (
    <div data-tour="bandeja" className="my-3 rounded-2xl border border-violet-300/30 bg-white/40 px-3 py-2.5 dark:border-white/10 dark:bg-black/20">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-700 dark:text-violet-200">◆ Bandeja de fontes</span>
        <span className="text-[10.5px] tabular-nums text-slate-500 dark:text-white/45">{files.length} artigo{files.length === 1 ? "" : "s"} · {citations.length} citaç{citations.length === 1 ? "ão" : "ões"}</span>
      </div>
      {itens.length === 0 ? (
        <p className="text-[11.5px] text-slate-500 dark:text-white/45">Vazia por enquanto — o que você salvar das referências aparece aqui.</p>
      ) : (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {itens.slice(0, 12).map((i) => (
            <span key={i.id} title={i.t} className="inline-flex max-w-[220px] shrink-0 items-center gap-1 rounded-full border border-violet-300/40 bg-violet-50/80 px-2.5 py-1 text-[11px] text-violet-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80">
              <span aria-hidden>{i.k}</span><span className="truncate">{i.t || "Sem título"}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
