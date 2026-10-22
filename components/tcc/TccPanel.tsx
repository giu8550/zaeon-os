"use client";

/**
 * O EDITOR do trabalho (TCC, artigo, relatório) — com cara de processador de texto (Word): barra de título,
 * faixa de abas (Página inicial · Sugestões · Histórico), barra de formatação (estilo do parágrafo, negrito,
 * itálico, listas, alinhamento, inserir citação/tabela/quadro, nova seção), régua com as margens, a FOLHA A4
 * com sombra no meio da mesa cinza e a barra de status embaixo. A folha segue o ABNT (NBR 14724): margens
 * 3/2 cm, Times 12, entrelinha 1,5, recuo 1,25 cm, justificado, seções numeradas — o mesmo desenho da prévia
 * (components/research/AbntPreview) e do motor de exportação (abnt-service).
 *
 * Abre POR CIMA da conversa (no chat único, ocupa a sala como uma pasta do topo). O aluno vê o trabalho
 * crescendo ao vivo (poll), clica numa seção pra editar ali mesmo na folha, aceita/rejeita sugestões e volta
 * qualquer seção no histórico. O texto continua sendo o markdown que o motor entende — a barra só escreve nele.
 *
 * Poll: 2,5 s enquanto a geração em background está rodando; 6 s depois. Para quando a aba do navegador está escondida.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  X, Loader2, History, Download, FlaskConical, RotateCcw, Bold, Italic, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Quote, Table2, LayoutGrid, Plus, FileText, Check,
} from "lucide-react";
import TccSugestoes from "@/components/tcc/TccSugestoes";
import { Bloco, Inline, cqw, PT } from "@/components/research/AbntPreview";
import { parseAbntMarkers } from "@/lib/abntTemplate";
import { BLOCOS, insertBlock } from "@/lib/abntBlocks";
import {
  ESTILOS, alternarEnfase, alternarLista, aplicarEstilo, estiloNoCursor, montarPagina, palavrasDaPagina,
  type Edicao, type EstiloParagrafo, type SecaoPagina,
} from "@/lib/tcc/pagina";
import { EVT_TCC_MUDOU, ROTULO_OP, ROTULO_ORIGEM, avisarTccMudou, tccApi, type Revisao, type TccDoc } from "@/lib/tcc/client";
import { chatUnicoOn } from "@/lib/chat/chatUnico";

type Aba = "doc" | "sugestoes" | "historico";
const CHAT_UNICO = chatUnicoOn();

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
  const [estilo, setEstilo] = useState<EstiloParagrafo>("normal");
  const corposRef = useRef<Map<string, string>>(new Map());
  const onTituloRef = useRef(onTitulo);
  onTituloRef.current = onTitulo;
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  const podeEscrever = tcc?.papel === "dono" || tcc?.papel === "editor";
  const tipo = tcc?.workType || "TCC";

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
      setErro(e?.status === 404 ? "Este trabalho não existe ou você não tem acesso." : "Não consegui carregar o trabalho.");
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
      setErro(e?.status === 409 ? "Outra tela salvou ao mesmo tempo — tente de novo." : e?.status === 403 ? "Você só pode ler este trabalho." : "Não deu pra salvar.");
    } finally { setSalvando(false); }
  };

  const novaSecao = async () => {
    if (!tcc || !podeEscrever) return;
    const titulo = window.prompt("Título da nova seção (ex.: REFERENCIAL TEÓRICO)")?.trim();
    if (!titulo) return;
    // antes das REFERÊNCIAS (pós-textual fica no fim), senão depois da última
    const refs = tcc.secoes.findIndex((s) => /^refer/i.test(s.titulo.normalize("NFD").replace(/[̀-ͯ]/g, "")));
    const apos = refs > 0 ? tcc.secoes[refs - 1].id : refs === 0 ? undefined : tcc.secoes.at(-1)?.id;
    try {
      const r = await tccApi.editar(workId, { op: "inserir", titulo: titulo.toUpperCase(), corpo: "", ...(apos ? { aposId: apos } : {}), origem: "aluno" });
      setTcc(r.tcc); avisarTccMudou(workId);
      const nova = r.tcc.secoes.find((s) => !tcc.secoes.some((x) => x.id === s.id));
      if (nova) setEditando({ id: nova.id, corpo: "" });
    } catch { setErro("Não deu pra criar a seção."); }
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
          title: tcc.titulo, content: tcc.content, workType: tipo, citations: [],
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
      a.href = url; a.download = `${tcc.titulo.replace(/\s+/g, "_").replace(/[^\w-]/g, "") || tipo}_ABNT.docx`; a.click();
      URL.revokeObjectURL(url);
    } catch { setErro("Não consegui exportar."); } finally { setExportando(false); }
  };

  // ── a barra: cada botão reescreve o texto da seção em edição e devolve a seleção ──
  const aplicar = (f: (e: Edicao) => Edicao) => {
    const el = areaRef.current;
    if (!editando || !el) return;
    const r = f({ value: editando.corpo, start: el.selectionStart, end: el.selectionEnd });
    setEditando({ ...editando, corpo: r.value });
    setEstilo(estiloNoCursor(r.value, r.start));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.start, r.end); });
  };
  const inserir = (b: keyof typeof BLOCOS) => aplicar((e) => {
    const r = insertBlock(e.value, e.end, BLOCOS[b].block, BLOCOS[b].select);
    return { value: r.value, start: r.start, end: r.end };
  });
  const lerEstilo = () => { const el = areaRef.current; if (el && editando) setEstilo(estiloNoCursor(editando.corpo, el.selectionStart)); };

  const pagina = useMemo(() => (tcc ? montarPagina(tcc.secoes) : []), [tcc]);
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

  const semEdicao = !editando;
  const dicaSemEdicao = "Clique numa seção da folha para escrever nela";

  return (
    <aside
      aria-label={`${tipo} desta conversa`}
      className="h-full w-full flex flex-col bg-[#e9ebee] dark:bg-[#15171c] text-slate-900 dark:text-white border-l border-slate-300 dark:border-white/10"
    >
      {/* ── BARRA DE TÍTULO (como a do Word): ícone, nome do documento, status e as ações ── */}
      <header className="shrink-0 flex items-center gap-2 px-3 h-11 bg-[#2b579a] text-white">
        <FileText size={17} aria-hidden className="shrink-0 opacity-90" />
        <div className="min-w-0 flex-1 flex items-baseline gap-2">
          <h2 className="truncate text-[13.5px] font-semibold" title={tcc?.titulo}>{tcc?.titulo ?? "Carregando…"}</h2>
          <span className="shrink-0 text-[11px] text-white/70">{tipo} · ABNT</span>
          <span className="shrink-0 text-[11px] text-white/70" aria-live="polite">
            {gerando ? <span className="inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> A Aura está escrevendo…</span>
              : tcc?.status === "erro" ? "a geração parou — peça no chat pra continuar"
              : salvando ? "Salvando…" : tcc ? "Salvo" : ""}
          </span>
        </div>
        <button type="button" onClick={exportar} disabled={!tcc || exportando} title="Exportar no padrão ABNT (.docx)" aria-label="Exportar no padrão ABNT"
          className="h-8 px-3 rounded-md inline-flex items-center gap-1.5 text-[12px] font-semibold bg-white/15 hover:bg-white/25 disabled:opacity-40">
          {exportando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Exportar ABNT
        </button>
        {!CHAT_UNICO && (
          <Link href={`/research-lab?work=${workId}`} title="Lapidar com rigor na Sala de Pesquisa" aria-label="Abrir na Sala de Pesquisa"
            className="h-8 w-8 rounded-md inline-flex items-center justify-center hover:bg-white/15">
            <FlaskConical size={16} />
          </Link>
        )}
        <button type="button" onClick={onFechar} aria-label="Fechar o trabalho e voltar à conversa"
          className="h-8 w-8 rounded-md inline-flex items-center justify-center hover:bg-white/15">
          <X size={18} />
        </button>
      </header>

      {/* ── FAIXA DE ABAS ── */}
      <nav role="tablist" className="shrink-0 flex gap-0.5 px-2 bg-[#2b579a] text-white/85">
        {([["doc", "Página inicial"], ["sugestoes", "Sugestões"], ["historico", "Histórico"]] as [Aba, string][]).map(([id, rotulo]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
            className={`h-8 px-3 text-[12px] rounded-t-md transition-colors ${aba === id ? "bg-[#f8f9fa] dark:bg-[#23262d] text-[#2b579a] dark:text-white font-semibold" : "hover:bg-white/10"}`}>
            {rotulo}{id === "sugestoes" && sugestoes.length ? <span className="ml-1.5 px-1.5 rounded-full text-[10px] bg-amber-400 text-black">{sugestoes.length}</span> : null}
          </button>
        ))}
      </nav>

      {/* ── BARRA DE FORMATAÇÃO (Página inicial) ── */}
      {aba === "doc" && (
        <div role="toolbar" aria-label="Formatação" className="shrink-0 flex items-center gap-1 px-3 py-1.5 overflow-x-auto no-scrollbar bg-[#f8f9fa] dark:bg-[#23262d] border-b border-slate-300 dark:border-white/10">
          <label className="sr-only" htmlFor={`estilo-${workId}`}>Estilo do parágrafo</label>
          <select
            id={`estilo-${workId}`} value={estilo} disabled={semEdicao} title={semEdicao ? dicaSemEdicao : ESTILOS.find((e) => e.id === estilo)?.dica}
            onChange={(e) => { const v = e.target.value as EstiloParagrafo; setEstilo(v); aplicar((x) => aplicarEstilo(x, v)); }}
            className="h-8 w-[150px] shrink-0 rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#1b1d22] px-2 text-[12px] disabled:opacity-50"
          >
            {ESTILOS.map((e) => <option key={e.id} value={e.id}>{e.rotulo}</option>)}
          </select>
          <span className="shrink-0 h-8 px-2 grid place-items-center rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#1b1d22] text-[12px] text-slate-600 dark:text-white/70" title="Fonte do corpo (ABNT): Times New Roman 12">Times New Roman · 12</span>
          <Sep />
          <Btn rotulo="Negrito" atalho="⌘B" disabled={semEdicao} onClick={() => aplicar((e) => alternarEnfase(e, "**"))}><Bold size={15} /></Btn>
          <Btn rotulo="Itálico (termos estrangeiros, títulos de obras)" atalho="⌘I" disabled={semEdicao} onClick={() => aplicar((e) => alternarEnfase(e, "*"))}><Italic size={15} /></Btn>
          <Sep />
          <Btn rotulo="Lista com marcadores (vira alíneas a), b), c) no ABNT)" disabled={semEdicao} onClick={() => aplicar((e) => alternarLista(e, "marcadores"))}><List size={15} /></Btn>
          <Btn rotulo="Lista numerada" disabled={semEdicao} onClick={() => aplicar((e) => alternarLista(e, "numerada"))}><ListOrdered size={15} /></Btn>
          <Sep />
          {/* ABNT: o corpo do texto é SEMPRE justificado — os outros alinhamentos ficam à mostra, mas travados */}
          <Btn rotulo="Alinhar à esquerda — no ABNT o corpo é justificado" disabled onClick={() => {}}><AlignLeft size={15} /></Btn>
          <Btn rotulo="Centralizar — títulos pré/pós-textuais já saem centralizados" disabled onClick={() => {}}><AlignCenter size={15} /></Btn>
          <Btn rotulo="Alinhar à direita — no ABNT o corpo é justificado" disabled onClick={() => {}}><AlignRight size={15} /></Btn>
          <Btn rotulo="Justificado (padrão ABNT NBR 14724)" ativo onClick={() => {}}><AlignJustify size={15} /></Btn>
          <Sep />
          <Btn rotulo="Citação longa (recuo 4 cm, fonte 10)" disabled={semEdicao} onClick={() => inserir("citacaoLonga")}><Quote size={15} /></Btn>
          <Btn rotulo="Tabela (padrão IBGE)" disabled={semEdicao} onClick={() => inserir("tabela")}><Table2 size={15} /></Btn>
          <Btn rotulo="Quadro" disabled={semEdicao} onClick={() => inserir("quadro")}><LayoutGrid size={15} /></Btn>
          <Sep />
          <button type="button" onClick={novaSecao} disabled={!podeEscrever} title="Nova seção (entra antes das referências)"
            className="shrink-0 h-8 px-2.5 rounded inline-flex items-center gap-1 text-[12px] font-semibold text-slate-700 dark:text-white/80 hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-40">
            <Plus size={14} /> Seção
          </button>
        </div>
      )}

      {erro && <p role="alert" className="shrink-0 px-4 py-2 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10">{erro}</p>}

      {/* ── A MESA: régua + folha A4 (Página inicial) ou os painéis de revisão ── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {!tcc && !erro && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" /></div>}

        {tcc && aba === "doc" && (
          <div className="mx-auto w-full max-w-[816px] px-3 sm:px-6 py-4 [container-type:inline-size]">
            <Regua />
            <article
              aria-label="Folha do trabalho"
              className="bg-white text-black shadow-[0_1px_3px_rgba(0,0,0,0.18),0_8px_28px_-10px_rgba(0,0,0,0.35)]"
              style={{
                minHeight: "141.4cqw", // A4: 29,7 / 21
                padding: `${cqw(3)} ${cqw(2)} ${cqw(2)} ${cqw(3)}`,
                fontFamily: '"Times New Roman", Times, serif',
                fontSize: cqw(12 * PT),
                lineHeight: 1.5,
              }}
            >
              <p style={{ textAlign: "center", fontWeight: 700, textTransform: "uppercase", margin: `0 0 ${cqw(1)}` }}>{tcc.titulo}</p>
              {tcc.papel === "leitor" && <p className="font-sans text-[11px] text-slate-500 mb-2">Você está lendo este trabalho (sem edição).</p>}
              {pagina.map((s) => (
                <SecaoNaFolha
                  key={s.id}
                  s={s}
                  realce={mudou.has(s.id)}
                  gerando={gerando}
                  pendentes={pendentesPorSecao.get(s.id) ?? 0}
                  onVerSugestoes={() => setAba("sugestoes")}
                  podeEscrever={!!podeEscrever}
                  editando={editando?.id === s.id ? editando.corpo : null}
                  onEditar={() => { if (!editando) { setEditando({ id: s.id, corpo: s.corpo }); setEstilo("normal"); } }}
                  onMudar={(corpo) => setEditando({ id: s.id, corpo })}
                  onSalvar={salvarSecao}
                  onCancelar={() => setEditando(null)}
                  salvando={salvando}
                  areaRef={areaRef}
                  onCursor={lerEstilo}
                  onAtalho={(m) => aplicar((e) => alternarEnfase(e, m))}
                />
              ))}
            </article>
          </div>
        )}

        {tcc && aba === "sugestoes" && (
          <div className="mx-auto max-w-[760px] px-4 py-4">
            <TccSugestoes workId={workId} sugestoes={sugestoes} podeDecidir={!!podeEscrever} onDecidida={() => void carregar()} />
          </div>
        )}

        {tcc && aba === "historico" && (
          <div className="mx-auto max-w-[760px] px-4 py-4">
            {historico === null ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
              : !historicoPorSecao.length ? <p className="py-6 text-center text-sm text-slate-500 dark:text-white/50">Nada no histórico ainda.</p>
              : (
                <div className="flex flex-col gap-5">
                  {historicoPorSecao.map(([secaoId, revs]) => (
                    <section key={secaoId}>
                      <h3 className="text-[13px] font-semibold tracking-wide text-slate-700 dark:text-white/80 inline-flex items-center gap-1.5">
                        <History size={14} aria-hidden /> {revs[0].titulo ?? secaoId}
                      </h3>
                      <ol className="mt-2 flex flex-col gap-2 border-l border-slate-300 dark:border-white/10 pl-3">
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
              )}
          </div>
        )}
      </div>

      {/* ── BARRA DE STATUS ── */}
      <footer className="shrink-0 flex items-center gap-3 px-3 h-7 text-[11px] bg-[#f3f3f3] dark:bg-[#1b1d22] text-slate-600 dark:text-white/55 border-t border-slate-300 dark:border-white/10">
        <span>{tcc ? `${tcc.secoes.length} seções` : "—"}</span>
        <span>{tcc ? `${palavrasDaPagina(tcc.secoes)} palavras` : ""}</span>
        <span className="hidden sm:inline">Português (Brasil)</span>
        <span className="ml-auto truncate">A4 · ABNT NBR 14724 · margens 3/2 cm · entrelinha 1,5</span>
      </footer>
    </aside>
  );
}

function Sep() { return <span aria-hidden className="shrink-0 mx-0.5 h-5 w-px bg-slate-300 dark:bg-white/15" />; }

function Btn({ rotulo, atalho, ativo, disabled, onClick, children }: { rotulo: string; atalho?: string; ativo?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button" aria-label={rotulo} title={atalho ? `${rotulo} (${atalho})` : rotulo} aria-pressed={ativo || undefined}
      disabled={disabled} onMouseDown={(e) => e.preventDefault() /* não tira o foco (nem a seleção) do texto */} onClick={onClick}
      className={`shrink-0 h-8 w-8 grid place-items-center rounded transition-colors disabled:opacity-35 disabled:cursor-not-allowed
        ${ativo ? "bg-[#c7dbf5] text-[#1d4a87] dark:bg-[#2b579a]/50 dark:text-white" : "text-slate-700 dark:text-white/80 hover:bg-slate-200 dark:hover:bg-white/10"}`}
    >{children}</button>
  );
}

/** A régua: 21 cm com marcas a cada 1 cm (meio cm menor) e as margens ABNT (3 cm à esquerda, 2 cm à direita) sombreadas. */
function Regua() {
  return (
    <div aria-hidden className="relative h-5 mb-2 bg-white text-[8px] text-slate-500 border border-slate-300 select-none" style={{ fontFamily: "system-ui" }}>
      <span className="absolute inset-y-0 left-0 bg-slate-200" style={{ width: cqw(3) }} />
      <span className="absolute inset-y-0 right-0 bg-slate-200" style={{ width: cqw(2) }} />
      {Array.from({ length: 41 }, (_, i) => i / 2).map((cm) => (
        <span key={cm} className="absolute bottom-0 w-px bg-slate-400" style={{ left: cqw(cm), height: Number.isInteger(cm) ? 6 : 3 }} />
      ))}
      {Array.from({ length: 19 }, (_, i) => i + 1).map((cm) => (
        <span key={cm} className="absolute top-0 -translate-x-1/2 leading-[11px]" style={{ left: cqw(cm) }}>{Math.abs(cm - 3) || ""}</span>
      ))}
      {/* recuo de primeira linha (1,25 cm depois da margem) e as margens, como os marcadores do Word */}
      <span className="absolute top-0 -translate-x-1/2 w-0 h-0 border-x-[4px] border-x-transparent border-t-[5px] border-t-[#2b579a]" style={{ left: cqw(4.25) }} title="Recuo de primeira linha: 1,25 cm" />
      <span className="absolute bottom-0 -translate-x-1/2 w-0 h-0 border-x-[4px] border-x-transparent border-b-[5px] border-b-[#2b579a]" style={{ left: cqw(3) }} />
      <span className="absolute bottom-0 -translate-x-1/2 w-0 h-0 border-x-[4px] border-x-transparent border-b-[5px] border-b-[#2b579a]" style={{ left: cqw(19) }} />
    </div>
  );
}

/** Uma seção na folha: título ABNT + o corpo como o motor desenha; clicar edita ali mesmo (texto em Times, sem sair da folha). */
function SecaoNaFolha({ s, realce, gerando, pendentes, onVerSugestoes, podeEscrever, editando, onEditar, onMudar, onSalvar, onCancelar, salvando, areaRef, onCursor, onAtalho }: {
  s: SecaoPagina; realce: boolean; gerando: boolean; pendentes: number; onVerSugestoes: () => void;
  podeEscrever: boolean; editando: string | null; onEditar: () => void; onMudar: (corpo: string) => void;
  onSalvar: () => void; onCancelar: () => void; salvando: boolean;
  areaRef: React.MutableRefObject<HTMLTextAreaElement | null>; onCursor: () => void; onAtalho: (m: "**" | "*") => void;
}) {
  const titulo = { fontSize: "inherit", textTransform: "uppercase" as const, margin: `${cqw(12 * PT)} 0`, fontWeight: 700 };
  const vazia = !s.corpo.trim();
  // o textarea cresce com o texto (sem barra própria: a folha é que rola)
  const crescer = (el: HTMLTextAreaElement | null) => { if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight + 2}px`; } };
  useEffect(() => { crescer(areaRef.current); }, [editando, areaRef]);

  return (
    <section className={`relative rounded-[2px] transition-colors duration-700 ${realce ? "bg-sky-100" : ""}`}>
      <h2 style={{ ...titulo, textAlign: s.centralizada ? "center" : "left" }} className="flex items-center gap-2" >
        <span className="flex-1" style={{ textAlign: s.centralizada ? "center" : "left" }}>{s.numero ? `${s.numero} ` : ""}{s.titulo}</span>
        {pendentes > 0 && (
          <button type="button" onClick={onVerSugestoes} className="font-sans normal-case text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
            {pendentes} sugestão{pendentes > 1 ? "ões" : ""}
          </button>
        )}
      </h2>
      {editando !== null ? (
        <div className="relative">
          <textarea
            ref={(el) => { areaRef.current = el; crescer(el); }}
            autoFocus
            value={editando}
            aria-label={`Texto de ${s.titulo}`}
            onChange={(e) => { onMudar(e.target.value); crescer(e.currentTarget); }}
            onSelect={onCursor} onKeyUp={onCursor} onClick={onCursor}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); onCancelar(); }
              if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); onSalvar(); }
              if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") { e.preventDefault(); onAtalho("**"); }
              if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") { e.preventDefault(); onAtalho("*"); }
            }}
            className="block w-full resize-none bg-[#fbfdff] outline outline-1 outline-[#2b579a]/40 focus:outline-2 focus:outline-[#2b579a]/60 p-1"
            style={{ font: "inherit", lineHeight: 1.5, textAlign: "justify", minHeight: cqw(4) }}
          />
          <div className="mt-1 flex items-center justify-end gap-1.5 font-sans">
            <span className="mr-auto text-[10.5px] text-slate-500">Esc cancela · ⌘S salva · **negrito** *itálico* · “aspas” = citação longa</span>
            <button type="button" onClick={onCancelar} className="h-7 px-3 rounded text-[12px] text-slate-600 hover:bg-slate-100">Cancelar</button>
            <button type="button" onClick={onSalvar} disabled={salvando} className="h-7 px-3 rounded text-[12px] font-semibold bg-[#2b579a] text-white hover:bg-[#244a85] disabled:opacity-50 inline-flex items-center gap-1">
              {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Salvar
            </button>
          </div>
        </div>
      ) : (
        <div
          role={podeEscrever ? "button" : undefined}
          tabIndex={podeEscrever ? 0 : undefined}
          aria-label={podeEscrever ? `Editar ${s.titulo}` : undefined}
          onClick={podeEscrever ? onEditar : undefined}
          onKeyDown={podeEscrever ? (e) => { if (e.key === "Enter") { e.preventDefault(); onEditar(); } } : undefined}
          className={podeEscrever ? "cursor-text rounded-[2px] hover:bg-slate-50 hover:outline hover:outline-1 hover:outline-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2b579a]/50" : ""}
        >
          {vazia ? (
            <p className="font-sans text-[12px] italic text-slate-400 py-1" style={{ textIndent: cqw(1.25) }}>
              {gerando ? "escrevendo…" : podeEscrever ? "Seção vazia — clique para escrever, ou peça no chat (\"escreva esta seção\")." : "Seção vazia."}
            </p>
          ) : s.referencias ? (
            s.blocos.map((b, j) => <p key={j} style={{ textAlign: "left", lineHeight: 1.15, margin: `0 0 ${cqw(12 * PT)}` }}><Inline texto={b.texto} /></p>)
          ) : (
            <>
              {s.blocos.map((b, j) => <Bloco key={j} texto={b.texto} n={b.n} />)}
              {s.subs.map((sub, j) => (
                <div key={j}>
                  <h3 style={{ fontSize: "inherit", textTransform: "uppercase", margin: `${cqw(12 * PT)} 0`, fontWeight: 400 }}>{sub.numero ? `${sub.numero} ` : ""}{sub.titulo}</h3>
                  {sub.blocos.map((b, k) => <Bloco key={k} texto={b.texto} n={b.n} />)}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}
