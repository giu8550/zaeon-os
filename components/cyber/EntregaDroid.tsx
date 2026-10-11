"use client";
/**
 * EntregaDroid — a ENTREGA na Sala do Saber (lib/cyber/entregaAbnt): o Droid pediu a pesquisa; aqui a pessoa escolhe UMA
 * das pesquisas dela (os livros do inventário) e entrega. O servidor avalia (completa e em ABNT?) e o veredito volta pro
 * engine (`resultadoEntrega`): aceita → o tutorial das motos; recusada → o Droid diz o que falta. "Ainda não" = desistiu.
 */
import { useEffect, useState } from "react";
import type { ItemPesquisa } from "@/lib/estudos/itens";
import { REQUISITOS_ENTREGA } from "@/lib/cyber/entregaAbnt";

const COR = "#ffc46b";

export default function EntregaDroid({ onVeredito }: { onVeredito: (r: { aceito: boolean; faltando: string[] } | null) => void }) {
  const [pesquisas, setPesquisas] = useState<ItemPesquisa[] | null>(null), [sel, setSel] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false), [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch("/api/estudos/itens", { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})).then((j: { pesquisas?: ItemPesquisa[] }) => { if (vivo) { const ps = (j.pesquisas ?? []).filter((p) => !p.id.startsWith("local:")); setPesquisas(ps); setSel(ps[0]?.id ?? null); } }).catch(() => { if (vivo) setPesquisas([]); });
    return () => { vivo = false; };
  }, []);
  const entregar = async () => {
    if (!sel || lendo) return;
    setLendo(true); setErro(null);
    try {
      const r = await fetch("/api/cyber/entrega", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workId: sel }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.error ?? "O Droid não conseguiu ler agora. Tente de novo."); setLendo(false); return; }
      onVeredito({ aceito: !!j.aceito, faltando: Array.isArray(j.faltando) ? j.faltando : [] });
    } catch { setErro("Sem conexão. Tente de novo."); setLendo(false); }
  };
  return (
    <div role="dialog" aria-label="Entregar a pesquisa ao Droid" onPointerDown={(e) => e.stopPropagation()}
      className="absolute left-1/2 top-[18%] z-[41] w-[min(94vw,560px)] -translate-x-1/2 rounded-[16px] border-2 p-4 text-amber-50"
      style={{ borderColor: `${COR}cc`, background: "linear-gradient(180deg,rgba(26,18,6,.96),rgba(10,7,3,.97))", boxShadow: `0 24px 70px -20px #000, 0 0 40px -12px ${COR}` }}>
      <p className="text-[11px] font-black uppercase tracking-[0.26em]" style={{ color: COR }}>◆ Entregar ao Droid</p>
      <p className="mt-1 text-[13.5px] text-amber-50/80">Escolha a pesquisa. Ele só aceita se estiver <b>completa e em ABNT</b>: resumo com palavras-chave, introdução, desenvolvimento, conclusão, {REQUISITOS_ENTREGA.refsMin}+ referências, {REQUISITOS_ENTREGA.citacoesMin}+ citações e ~{Math.ceil(REQUISITOS_ENTREGA.palavrasMin / 300)} páginas.</p>
      <div className="mt-3 max-h-[38vh] space-y-1.5 overflow-y-auto pr-1">
        {pesquisas === null ? <p className="text-sm text-amber-50/60">carregando as suas pesquisas…</p> : !pesquisas.length ? (
          <p className="text-sm text-amber-50/70">Você ainda não tem pesquisas salvas. Crie uma no tablet (T) e volte.</p>
        ) : pesquisas.map((p) => (
          <label key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${sel === p.id ? "border-[#ffc46b]/80 bg-[#ffc46b]/10" : "border-white/10 hover:border-white/25"}`}>
            <input type="radio" name="pesquisa" checked={sel === p.id} onChange={() => setSel(p.id)} className="accent-[#ffc46b]" />
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{p.titulo}</span>
            <span className="shrink-0 text-[11.5px] tabular-nums text-amber-50/55">{p.paginas} pág.</span>
          </label>
        ))}
      </div>
      {erro && <p className="mt-2 text-[12px] text-rose-300">{erro}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={() => onVeredito(null)} disabled={lendo} className="min-h-[40px] rounded-full border border-white/20 px-4 text-[12px] font-bold uppercase tracking-wider text-amber-50/80 hover:text-white disabled:opacity-40">Ainda não</button>
        <button type="button" onClick={() => void entregar()} disabled={!sel || lendo}
          className="min-h-[40px] rounded-full border-2 px-5 text-[12px] font-black uppercase tracking-[0.16em] text-[#1a1004] disabled:opacity-40" style={{ background: COR, borderColor: "#fff1cf" }}>
          {lendo ? "O Droid está lendo…" : "Entregar ▸"}
        </button>
      </div>
    </div>
  );
}
