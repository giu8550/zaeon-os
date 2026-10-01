"use client";

/**
 * Sugestões da Sala de Pesquisa no TCC — aceitar/rejeitar inline. A Pesquisa NUNCA muda o texto
 * em silêncio: cada sugestão mostra o que entra (e o que sai), a nota do revisor e as fontes
 * verificadas (ABNT). Usado na aba TCC da Sala de Estudos e acima do editor da Sala de Pesquisa.
 */
import { useState } from "react";
import { Check, X, BookOpen, Loader2 } from "lucide-react";
import { avisarTccMudou, tccApi, type Revisao, type TccDoc } from "@/lib/tcc/client";

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

/** O trecho NOVO da sugestão (anexar mostra só o que entra; reescrita mostra o texto inteiro). */
function trechoNovo(s: Revisao): string {
  if (s.op === "anexar" && s.antes && s.depois.startsWith(s.antes.trimEnd())) return s.depois.slice(s.antes.trimEnd().length).trim();
  return s.depois;
}

export default function TccSugestoes({
  workId, sugestoes, podeDecidir, onDecidida, compacto = false,
}: {
  workId: string;
  sugestoes: Revisao[];
  podeDecidir: boolean;
  onDecidida?: (tcc: TccDoc | null) => void;
  compacto?: boolean;
}) {
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const decidir = async (s: Revisao, aceitar: boolean) => {
    setOcupada(s.id); setErro(null);
    try {
      const r = await tccApi.decidir(workId, s.id, aceitar);
      onDecidida?.(r.tcc);
      avisarTccMudou(workId);
    } catch (e: any) {
      setErro(e?.status === 404 ? "Essa sugestão já foi decidida." : e?.status === 403 ? "Você só pode ler este TCC." : "Não deu pra aplicar agora. Tente de novo.");
      onDecidida?.(null);
    } finally {
      setOcupada(null);
    }
  };

  if (!sugestoes.length) {
    return compacto ? null : (
      <p className="px-1 py-6 text-center text-sm text-slate-500 dark:text-white/50">
        Nenhuma sugestão pendente. O que a Sala de Pesquisa propuser aparece aqui pra você aceitar ou rejeitar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      {erro && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{erro}</p>}
      {sugestoes.map((s) => {
        const novo = trechoNovo(s);
        return (
          <article key={s.id} className="rounded-xl border border-amber-300/60 bg-amber-50/70 dark:bg-amber-400/[0.06] dark:border-amber-300/25 p-3">
            <header className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-200 font-medium">Sala de Pesquisa · rigor</span>
              <span className="text-slate-600 dark:text-white/60">
                {s.op === "inserir" ? "nova seção" : s.op === "anexar" ? "acrescentar em" : "reescrever"} <strong className="text-slate-800 dark:text-white/85">{s.titulo}</strong>
              </span>
            </header>
            {s.nota && <p className="mt-2 text-[13px] italic text-slate-700 dark:text-white/70">{s.nota}</p>}
            {s.op === "substituir" && s.antes?.trim() && !compacto && (
              <p className="mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-white/40 line-through decoration-rose-400/60 whitespace-pre-wrap">{clip(s.antes, 400)}</p>
            )}
            <p className="mt-2 text-[14px] leading-relaxed text-slate-800 dark:text-white/90 whitespace-pre-wrap border-l-2 border-emerald-500/60 pl-2">
              {clip(novo, compacto ? 280 : 1200)}
            </p>
            {s.fontes.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-[12px] text-slate-600 dark:text-white/60">
                {s.fontes.map((f, i) => (
                  <li key={i} className="flex gap-1.5">
                    <BookOpen size={13} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden />
                    {f.url || f.doi ? (
                      <a href={f.url || `https://doi.org/${f.doi}`} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted hover:text-cyan-700 dark:hover:text-cyan-300">{f.abnt}</a>
                    ) : <span>{f.abnt}</span>}
                  </li>
                ))}
              </ul>
            )}
            {podeDecidir && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button" disabled={!!ocupada} onClick={() => decidir(s, true)}
                  className="min-h-[44px] px-4 rounded-full inline-flex items-center gap-1.5 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                >
                  {ocupada === s.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Aceitar
                </button>
                <button
                  type="button" disabled={!!ocupada} onClick={() => decidir(s, false)}
                  className="min-h-[44px] px-4 rounded-full inline-flex items-center gap-1.5 text-sm border border-slate-300 dark:border-white/20 text-slate-700 dark:text-white/80 hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-300 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"
                >
                  <X size={15} /> Rejeitar
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
