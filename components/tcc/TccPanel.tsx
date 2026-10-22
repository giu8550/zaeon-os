"use client";

/**
 * A ABA "TCC" da Sala de Estudos — abre POR CIMA da conversa (não troca de sala). O aluno vê o
 * documento crescendo ao vivo (poll), edita uma seção na mão, aceita/rejeita o que a Sala de
 * Pesquisa sugeriu e volta qualquer seção no histórico. Um documento, dois chats.
 *
 * Poll: 2,5 s enquanto a geração em background está rodando; 6 s depois (pega edição da outra
 * sala e sugestão nova). Para quando a aba do navegador está escondida.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { X, Loader2, Pencil, History, Download, FlaskConical, RotateCcw } from "lucide-react";
import ChatMarkdown from "@/components/study/ChatMarkdown";
import TccSugestoes from "@/components/tcc/TccSugestoes";
import { parseAbntMarkers } from "@/lib/abntTemplate";
import { EVT_TCC_MUDOU, ROTULO_OP, ROTULO_ORIGEM, avisarTccMudou, tccApi, type Revisao, type TccDoc } from "@/lib/tcc/client";

type Aba = "doc" | "sugestoes" | "historico";

export default function TccPanel({ workId, onFechar, onTitulo }: {
  workId: string; onFechar: () => void;
  /** chat único: o título/tipo/status lido do banco (a pasta do trabalho no topo do chat se atualiza) */
  onTitulo?: (t: { titulo: string; tipo: string; status: string }) => void;
}) {
  const { data: session } = useSession();
  const [tcc, setTcc] = useState<TccDoc | null>(null);
  const [sugestoes, setSugestoes] = useState<Revisao[]>([]);
  const [historico, setHistorico] = useState<Revisao[] | null>(null);
  const [aba, setAba] = useState<Aba>("doc");
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ id: string; corpo: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [mudou, setMudou] = useState<Set<string>>(new Set()); // seções que mudaram no último poll (realce)
  const corposRef = useRef<Map<string, string>>(new Map());
  const onTituloRef = useRef(onTitulo);
  onTituloRef.current = onTitulo;

  const podeEscrever = tcc?.papel === "dono" || tcc?.papel === "editor";

  const carregar = useCallback(async () => {
    try {
      const d = await tccApi.ler(workId);
      // "crescendo ao vivo": realça o que mudou desde a última leitura (não na 1ª carga)
      const antes = corposRef.current;
      const novas = new Set<string>();
      if (antes.size) for (const s of d.tcc.secoes) if (antes.get(s.id) !== s.corpo) novas.add(s.id);
      corposRef.current = new Map(d.tcc.secoes.map((s) => [s.id, s.corpo]));
      if (novas.size) setMudou(novas);
      setTcc(d.tcc); setSugestoes(d.sugestoes); setErro(null);
      onTituloRef.current?.({ titulo: d.tcc.titulo, tipo: d.tcc.workType || "TCC", status: d.tcc.status });
    } catch (e: any) {
      setErro(e?.status === 404 ? "Este TCC não existe ou você não tem acesso." : "Não consegui carregar o TCC.");
    }
  }, [workId]);

  const carregarHistorico = useCallback(async () => {
    try { setHistorico((await tccApi.historico(workId)).revisoes); } catch { setHistorico([]); }
  }, [workId]);

  useEffect(() => { corposRef.current = new Map(); void carregar(); }, [carregar]);

  // Poll (rápido enquanto gera, lento depois) + recarrega quando outra tela avisa que mudou.
  const gerando = tcc?.status === "gerando";
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) void carregar(); }, gerando ? 2500 : 6000);
    const onMudou = (e: any) => { if (e?.detail?.workId === workId) void carregar(); };
    window.addEventListener(EVT_TCC_MUDOU, onMudou);
    return () => { clearInterval(t); window.removeEventListener(EVT_TCC_MUDOU, onMudou); };
  }, [carregar, gerando, workId]);

  useEffect(() => { if (aba === "historico") void carregarHistorico(); }, [aba, carregarHistorico]);
  useEffect(() => { if (!mudou.size) return; const t = setTimeout(() => setMudou(new Set()), 2500); return () => clearTimeout(t); }, [mudou]);

  const salvarSecao = async () => {
    if (!editando) return;
    setSalvando(true);
    try {
      const r = await tccApi.editar(workId, { secaoId: editando.id, op: "substituir", corpo: editando.corpo, origem: "aluno" });
      corposRef.current = new Map(r.tcc.secoes.map((s) => [s.id, s.corpo]));
      setTcc(r.tcc); setEditando(null); avisarTccMudou(workId);
    } catch (e: any) {
      setErro(e?.status === 409 ? "Outra sala salvou ao mesmo tempo — tente de novo." : e?.status === 403 ? "Você só pode ler este TCC." : "Não deu pra salvar.");
    } finally { setSalvando(false); }
  };

  const desfazer = async (rev: Revisao) => {
    try {
      const r = await tccApi.desfazer(workId, rev.id);
      setTcc(r.tcc); avisarTccMudou(workId); void carregarHistorico();
    } catch { setErro("Não deu pra restaurar essa versão."); }
  };

  const exportar = async () => {
    if (!tcc) return;
    setExportando(true); setErro(null);
    try {
      // Mesmo contrato do export da Sala de Pesquisa (worker ABNT NBR 14724).
      const r = await fetch("/api/documents/abnt-export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: tcc.titulo, content: tcc.content, workType: "TCC", citations: [],
          author: session?.user?.name || "Autor", institution: "", course: (session?.user as any)?.course || "",
          city: "", year: String(new Date().getFullYear()), format: "docx",
          parsedSections: parseAbntMarkers(tcc.content) ?? undefined, researchWorkId: tcc.id,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErro(r.status === 503 ? "O serviço ABNT está fora do ar agora." : d?.error || "Não consegui exportar.");
        return;
      }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url; a.download = `${tcc.titulo.replace(/\s+/g, "_").replace(/[^\w-]/g, "") || "TCC"}_ABNT.docx`; a.click();
      URL.revokeObjectURL(url);
    } catch { setErro("Não consegui exportar."); } finally { setExportando(false); }
  };

  const pendentesPorSecao = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sugestoes) m.set(s.secaoId, (m.get(s.secaoId) ?? 0) + 1);
    return m;
  }, [sugestoes]);

  const historicoPorSecao = useMemo(() => {
    const m = new Map<string, Revisao[]>();
    for (const r of historico ?? []) m.set(r.secaoId, [...(m.get(r.secaoId) ?? []), r]);
    return [...m.entries()];
  }, [historico]);

  const abaBtn = (id: Aba, rotulo: string, extra?: number) => (
    <button
      type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
      className={`min-h-[44px] px-3 text-sm border-b-2 transition-colors ${aba === id ? "border-cyan-500 text-slate-900 dark:text-white" : "border-transparent text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80"}`}
    >
      {rotulo}{extra ? <span className="ml-1.5 px-1.5 rounded-full text-[11px] bg-amber-500/20 text-amber-800 dark:text-amber-200">{extra}</span> : null}
    </button>
  );

  return (
    <aside
      aria-label="TCC desta conversa"
      className="h-full w-full flex flex-col bg-white dark:bg-[#0b1120] text-slate-900 dark:text-white border-l border-slate-200 dark:border-white/10"
    >
      <header className="px-4 pt-3 pb-2 flex items-start gap-2 border-b border-slate-200 dark:border-white/10">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-cyan-700 dark:text-cyan-300 font-tech">TCC · em construção</p>
          <h2 className="text-lg font-serif leading-snug truncate" title={tcc?.titulo}>{tcc?.titulo ?? "Carregando…"}</h2>
          {gerando && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-white/55 inline-flex items-center gap-1.5" aria-live="polite">
              <Loader2 size={12} className="animate-spin" /> A Aura está escrevendo — as seções vão aparecendo aqui.
            </p>
          )}
          {tcc?.status === "erro" && <p className="mt-0.5 text-xs text-rose-600 dark:text-rose-300">A geração parou no meio. Peça no chat pra continuar o TCC.</p>}
        </div>
        <button type="button" onClick={exportar} disabled={!tcc || exportando} title="Exportar no padrão ABNT (.docx)" aria-label="Exportar no padrão ABNT"
          className="min-h-[44px] min-w-[44px] rounded-full inline-flex items-center justify-center text-slate-600 dark:text-white/70 hover:text-cyan-600 dark:hover:text-cyan-300 disabled:opacity-40">
          {exportando ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
        </button>
        <Link href={`/research-lab?work=${workId}`} title="Lapidar com rigor na Sala de Pesquisa" aria-label="Abrir na Sala de Pesquisa"
          className="min-h-[44px] min-w-[44px] rounded-full inline-flex items-center justify-center text-slate-600 dark:text-white/70 hover:text-cyan-600 dark:hover:text-cyan-300">
          <FlaskConical size={18} />
        </Link>
        <button type="button" onClick={onFechar} aria-label="Fechar o TCC e voltar à conversa"
          className="min-h-[44px] min-w-[44px] rounded-full inline-flex items-center justify-center text-slate-600 dark:text-white/70 hover:text-rose-600 dark:hover:text-rose-300">
          <X size={20} />
        </button>
      </header>

      <nav role="tablist" className="px-2 flex gap-1 border-b border-slate-200 dark:border-white/10">
        {abaBtn("doc", "Documento")}
        {abaBtn("sugestoes", "Sugestões", sugestoes.length)}
        {abaBtn("historico", "Histórico")}
      </nav>

      {erro && <p role="alert" className="mx-4 mt-3 text-sm text-rose-600 dark:text-rose-300">{erro}</p>}

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 py-4">
        {!tcc && !erro && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>}

        {tcc && aba === "doc" && (
          <div className="flex flex-col gap-5">
            {tcc.papel === "leitor" && <p className="text-xs text-slate-500 dark:text-white/50">Você está lendo este TCC (sem edição).</p>}
            {tcc.secoes.map((s) => (
              <section key={s.id} className={`rounded-lg transition-colors duration-700 ${mudou.has(s.id) ? "bg-cyan-500/10" : ""}`}>
                <div className="flex items-center gap-2">
                  <h3 className="flex-1 text-[13px] font-semibold tracking-wide text-slate-700 dark:text-white/80">{s.titulo}</h3>
                  {pendentesPorSecao.get(s.id) ? (
                    <button type="button" onClick={() => setAba("sugestoes")} className="min-h-[32px] px-2 rounded-full text-[11px] bg-amber-500/15 text-amber-800 dark:text-amber-200">
                      {pendentesPorSecao.get(s.id)} sugestão da Pesquisa
                    </button>
                  ) : null}
                  {podeEscrever && editando?.id !== s.id && (
                    <button type="button" onClick={() => setEditando({ id: s.id, corpo: s.corpo })} aria-label={`Editar ${s.titulo}`}
                      className="min-h-[44px] min-w-[44px] rounded-full inline-flex items-center justify-center text-slate-500 dark:text-white/50 hover:text-cyan-600 dark:hover:text-cyan-300">
                      <Pencil size={15} />
                    </button>
                  )}
                </div>
                {editando?.id === s.id ? (
                  <div className="mt-1 flex flex-col gap-2">
                    <textarea
                      value={editando.corpo} onChange={(e) => setEditando({ id: s.id, corpo: e.target.value })}
                      rows={Math.min(18, Math.max(5, editando.corpo.split("\n").length + 1))} aria-label={`Texto de ${s.titulo}`}
                      className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/[0.04] p-3 text-[15px] leading-relaxed font-serif focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={salvarSecao} disabled={salvando}
                        className="min-h-[44px] px-4 rounded-full text-sm font-medium bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 inline-flex items-center gap-1.5">
                        {salvando && <Loader2 size={14} className="animate-spin" />} Salvar seção
                      </button>
                      <button type="button" onClick={() => setEditando(null)} className="min-h-[44px] px-4 rounded-full text-sm text-slate-600 dark:text-white/70">Cancelar</button>
                    </div>
                  </div>
                ) : s.corpo.trim() ? (
                  <div className="mt-1 font-serif text-[15px] leading-relaxed text-slate-800 dark:text-white/85"><ChatMarkdown text={s.corpo} /></div>
                ) : (
                  <p className="mt-1 text-sm italic text-slate-400 dark:text-white/35">{gerando ? "escrevendo…" : "Seção vazia — peça no chat (\"escreva a metodologia do TCC\") ou escreva aqui."}</p>
                )}
              </section>
            ))}
          </div>
        )}

        {tcc && aba === "sugestoes" && (
          <TccSugestoes workId={workId} sugestoes={sugestoes} podeDecidir={!!podeEscrever} onDecidida={() => void carregar()} />
        )}

        {tcc && aba === "historico" && (
          historico === null ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
          : !historicoPorSecao.length ? <p className="py-6 text-center text-sm text-slate-500 dark:text-white/50">Nada no histórico ainda.</p>
          : (
            <div className="flex flex-col gap-5">
              {historicoPorSecao.map(([secaoId, revs]) => (
                <section key={secaoId}>
                  <h3 className="text-[13px] font-semibold tracking-wide text-slate-700 dark:text-white/80 inline-flex items-center gap-1.5">
                    <History size={14} aria-hidden /> {revs[0].titulo ?? secaoId}
                  </h3>
                  <ol className="mt-2 flex flex-col gap-2 border-l border-slate-200 dark:border-white/10 pl-3">
                    {revs.map((r) => (
                      <li key={r.id} className="text-[13px]">
                        <div className="flex flex-wrap items-center gap-x-2 text-slate-600 dark:text-white/60">
                          <strong className="text-slate-800 dark:text-white/85">{ROTULO_ORIGEM[r.origem] ?? r.origem}</strong>
                          <span>{ROTULO_OP[r.op] ?? r.op}</span>
                          {r.status !== "aplicada" && <span className="px-1.5 rounded-full bg-slate-500/10">{r.status}</span>}
                          <time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time>
                        </div>
                        <p className="mt-0.5 text-slate-500 dark:text-white/45 line-clamp-2 whitespace-pre-wrap">{r.depois || "(seção removida)"}</p>
                        {podeEscrever && r.status === "aplicada" && (
                          <button type="button" onClick={() => desfazer(r)}
                            className="mt-1 min-h-[36px] px-2.5 rounded-full text-[12px] inline-flex items-center gap-1 border border-slate-300 dark:border-white/15 text-slate-600 dark:text-white/70 hover:text-cyan-700 dark:hover:text-cyan-300">
                            <RotateCcw size={12} /> Voltar para antes desta mudança
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )
        )}
      </div>
    </aside>
  );
}
