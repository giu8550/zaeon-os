"use client";
/**
 * OctaIDE — a IDE PRÓPRIA do Octa Code (não é a sala Projetos). Layout no estilo do Zed:
 *   explorador de arquivos · abas + editor (Monaco, tema escuro tipo Zed One) · saída · JANELA DO AGENTE ao lado.
 * Tudo que é agêntico passa pela janela do agente: o pedido vai pra /api/octa/agente, que roda o laço com os
 * guardrails do pack (modo revisar/alterar, file-lock, conteúdo de arquivo = dado, trace) no modelo REAL do app;
 * as edições voltam e entram no editor na hora, com "desfazer". Rodar = no navegador (Pyodide / JS / HTML).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Play, Plus, X, FileText, Folder, FolderOpen, Trash2, Undo2, Send, Loader2, ShieldCheck, Pencil, ChevronRight, ChevronDown, Square } from "lucide-react";
import OctaIcon from "./OctaIcon";
import { useCodeRunner, type RunOutput } from "@/app/agentic-modules/codelab/useCodeRunner";
import {
  arvore, aplicarEdicoes, fecharAba, abrir, caminhoValido, linguagem, carregar, salvar, ehSvg, esquecerVerCodigo,
  type EstadoIDE, type NoArvore,
} from "@/lib/octa/ideWorkspace";
import PreviaSvg from "./PreviaSvg";

const Monaco = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => <div className="grid place-items-center h-full text-[12px] text-[#7f848e]"><Loader2 className="w-4 h-4 animate-spin" /></div>,
});

// paleta "One Dark" do Zed (só cores — nenhum código do Zed)
const Z = { bg: "#282c33", painel: "#2f343e", borda: "#363c46", texto: "#dce0e5", fraco: "#a9afbc", apagado: "#878a98", acento: "#74ade8", ok: "#a1c181", erro: "#d07277", aviso: "#dec184", sel: "#3b414d" };

type Msg = {
  id: string; role: "user" | "assistant"; content: string;
  edicoes?: string[]; apagados?: string[]; negados?: { tool: string; motivo: string }[];
  pedeApagar?: boolean; sinais?: { kind: string; detail: string }[]; modelo?: string; erro?: boolean; desfazer?: EstadoIDE;
};
const uid = () => Math.random().toString(36).slice(2, 10);
const CHAVE_CHAT = "zaeon.octa.chat.v1";
const MOTIVO: Record<string, string> = {
  MODE_FORBIDS_MUTATION: "modo Revisar não edita",
  OUTSIDE_FILE_LOCK: "fora dos arquivos liberados",
  needs_approval: "precisa da sua aprovação",
  PATH_NOT_ALLOWED: "caminho inválido",
  MUTATION_WITHOUT_PATH: "escrita sem arquivo",
};
const ATALHOS: { rotulo: string; texto: string; modo: "review" | "change" }[] = [
  { rotulo: "Revisar arquivo", texto: "Revise o arquivo aberto e aponte os problemas com linha e trecho.", modo: "review" },
  { rotulo: "Explicar", texto: "Explique o que o arquivo aberto faz, passo a passo.", modo: "review" },
  { rotulo: "Corrigir bugs", texto: "Encontre e corrija os bugs do arquivo aberto.", modo: "change" },
  { rotulo: "Gerar testes", texto: "Crie testes para o arquivo aberto num arquivo novo.", modo: "change" },
  { rotulo: "Arte generativa", texto: "Gere uma arte generativa com o tema do projeto.", modo: "change" },
];

function Arvore({ nos, ativo, abertasPastas, alternar, onAbrir, onApagar }: {
  nos: NoArvore[]; ativo: string | null; abertasPastas: Set<string>; alternar: (p: string) => void;
  onAbrir: (p: string) => void; onApagar: (p: string) => void;
}) {
  return (
    <ul>
      {nos.map((n) => (
        <li key={n.caminho}>
          {n.pasta ? (
            <>
              <button type="button" onClick={() => alternar(n.caminho)} className="w-full flex items-center gap-1 px-2 py-[3px] text-left hover:bg-white/5" style={{ color: Z.fraco }}>
                {abertasPastas.has(n.caminho) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {abertasPastas.has(n.caminho) ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
                <span className="truncate">{n.nome}</span>
              </button>
              {abertasPastas.has(n.caminho) && <div className="pl-3"><Arvore nos={n.filhos} ativo={ativo} abertasPastas={abertasPastas} alternar={alternar} onAbrir={onAbrir} onApagar={onApagar} /></div>}
            </>
          ) : (
            <div className="group flex items-center" style={{ background: ativo === n.caminho ? Z.sel : undefined }}>
              <button type="button" onClick={() => onAbrir(n.caminho)} className="flex-1 min-w-0 flex items-center gap-1.5 pl-6 pr-1 py-[3px] text-left hover:bg-white/5" style={{ color: ativo === n.caminho ? Z.texto : Z.fraco }}>
                <FileText className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{n.nome}</span>
              </button>
              <button type="button" title={`Apagar ${n.caminho}`} onClick={() => onApagar(n.caminho)} className="opacity-0 group-hover:opacity-100 px-1.5" style={{ color: Z.apagado }}><Trash2 className="w-3 h-3" /></button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function OctaIDE() {
  const [ide, setIde] = useState<EstadoIDE | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [modo, setModo] = useState<"review" | "change">("review");
  const [escopo, setEscopo] = useState<"ativo" | "projeto">("ativo");
  const [enviando, setEnviando] = useState(false);
  const [pastas, setPastas] = useState<Set<string>>(new Set(["arte", "src", "tests"]));
  const [saidaAberta, setSaidaAberta] = useState(false);
  // #421: por arquivo .svg, mostrar o código em vez da imagem? (padrão: imagem)
  const [verCodigo, setVerCodigo] = useState<Record<string, boolean>>({});
  const { run, output, isRunning, isPyodideReady, clearOutput, iframeRef } = useCodeRunner();
  const fimChat = useRef<HTMLDivElement>(null);
  const abortar = useRef<AbortController | null>(null);

  // carregar/salvar no navegador
  useEffect(() => {
    setIde(carregar());
    try { const c = JSON.parse(localStorage.getItem(CHAVE_CHAT) || "[]"); if (Array.isArray(c)) setMsgs(c.map((m: Msg) => ({ ...m, desfazer: undefined }))); } catch { /* */ }
  }, []);
  useEffect(() => { if (ide) salvar(ide); }, [ide]);
  useEffect(() => { try { localStorage.setItem(CHAVE_CHAT, JSON.stringify(msgs.slice(-60).map(({ desfazer: _d, ...m }) => m))); } catch { /* */ } }, [msgs]);
  useEffect(() => { fimChat.current?.scrollIntoView({ block: "end" }); }, [msgs, enviando]);

  const nos = useMemo(() => (ide ? arvore(ide.arquivos) : []), [ide]);
  const ativo = ide?.ativo ?? null;
  const lang = ativo ? linguagem(ativo) : null;

  const novoArquivo = () => {
    const p = caminhoValido(window.prompt("Nome do arquivo (ex.: src/app.ts)") ?? "");
    if (!p || !ide) return;
    setIde(abrir({ ...ide, arquivos: { ...ide.arquivos, [p]: ide.arquivos[p] ?? "" } }, p));
  };
  const apagarArquivo = (p: string) => {
    if (!ide || !window.confirm(`Apagar ${p}?`)) return;
    const arquivos = { ...ide.arquivos }; delete arquivos[p];
    setIde(fecharAba({ ...ide, arquivos }, p));
    setVerCodigo((v) => esquecerVerCodigo(v, [p])); // recriado com o mesmo nome, volta a abrir como imagem
  };
  const rodar = useCallback(async () => {
    if (!ide || !ativo || !lang?.runner) return;
    setSaidaAberta(true); clearOutput();
    await run(ide.arquivos[ativo], lang.runner, Object.entries(ide.arquivos).map(([path, content]) => ({ path, content })));
  }, [ide, ativo, lang, run, clearOutput]);

  const enviar = async (texto = input, modoPedido = modo) => {
    const pedido = texto.trim();
    if (!pedido || enviando || !ide) return;
    setInput(""); setModo(modoPedido);
    const historico = msgs.filter((m) => !m.erro).map((m) => ({ role: m.role, content: m.content })).slice(-12);
    setMsgs((v) => [...v, { id: uid(), role: "user", content: pedido }]);
    setEnviando(true);
    const ac = new AbortController(); abortar.current = ac;
    const liberados = modoPedido === "change" ? (escopo === "projeto" ? ["**"] : ativo ? [ativo, ...testesDe(ativo)] : []) : [];
    try {
      const r = await fetch("/api/octa/agente", {
        method: "POST", signal: ac.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido, historico, workspace: ide.arquivos, modo: modoPedido, liberados, arquivoAtivo: ativo }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const erro = r.status === 503 ? "O gateway de modelo não está ligado neste servidor." : r.status === 402 ? "O orçamento desta sessão acabou. Tenta de novo daqui a pouco." : r.status === 401 ? "Entre na sua conta pra usar o Octa." : r.status === 429 ? "Muitos pedidos seguidos. Espera um instante." : `O Octa não conseguiu responder agora (erro ${r.status}${j.error ? `: ${j.error}` : ""}).`;
        setMsgs((v) => [...v, { id: uid(), role: "assistant", content: erro, erro: true }]);
        return;
      }
      const edicoes: Record<string, string> = j.edicoes ?? {};
      const apagados: string[] = j.apagados ?? [];
      const antes = ide;
      if (Object.keys(edicoes).length || apagados.length) setIde((e) => (e ? aplicarEdicoes(e, edicoes, apagados) : e));
      // arte (re)gravada ou apagada pelo agente: abre como IMAGEM, não herda um "Código" antigo do mesmo caminho
      setVerCodigo((v) => esquecerVerCodigo(v, [...Object.keys(edicoes), ...apagados]));
      const pedeApagar = (j.negados ?? []).some((n: any) => n.tool === "octa_apagar" && n.motivo === "needs_approval");
      setMsgs((v) => [...v, {
        id: uid(), role: "assistant", content: j.resposta ?? "", edicoes: Object.keys(edicoes), apagados, modelo: j.modelo,
        negados: (j.negados ?? []).filter((n: any) => n.tool !== "octa_apagar"), sinais: j.sinais, pedeApagar: pedeApagar || undefined,
        desfazer: Object.keys(edicoes).length || apagados.length ? antes : undefined,
      }]);
    } catch (e: any) {
      if (e?.name !== "AbortError") setMsgs((v) => [...v, { id: uid(), role: "assistant", content: "Falha de rede ao falar com o Octa.", erro: true }]);
    } finally { setEnviando(false); abortar.current = null; }
  };

  if (!ide) return <div className="grid place-items-center h-full" style={{ background: Z.bg }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: Z.acento }} /></div>;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden rounded-2xl text-[13px]" style={{ background: Z.bg, color: Z.texto, border: `1px solid ${Z.borda}`, fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui' }}>
      {/* barra de título */}
      <div className="h-10 shrink-0 flex items-center gap-3 px-3" style={{ background: Z.painel, borderBottom: `1px solid ${Z.borda}` }}>
        <OctaIcon size={20} className="text-[#dce0e5]" />
        <span className="font-semibold">Octa Code</span>
        <span style={{ color: Z.apagado }}>·</span>
        <span style={{ color: Z.fraco }}>{ativo ?? "sem arquivo"}</span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={rodar} disabled={!lang?.runner || isRunning || (lang?.runner === "python" && !isPyodideReady)}
            title={lang?.runner ? (lang.runner === "python" && !isPyodideReady ? "Carregando o Python…" : "Rodar o arquivo aberto") : "Esse tipo de arquivo não roda aqui"}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md disabled:opacity-40 hover:bg-white/5" style={{ border: `1px solid ${Z.borda}` }}>
            {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" style={{ color: Z.ok }} />} Rodar
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* explorador */}
        <aside className="w-52 shrink-0 flex flex-col min-h-0" style={{ background: Z.painel, borderRight: `1px solid ${Z.borda}` }}>
          <div className="h-8 flex items-center px-3 text-[11px] uppercase tracking-wider" style={{ color: Z.apagado }}>
            Projeto
            <button type="button" onClick={novoArquivo} title="Novo arquivo" className="ml-auto p-1 rounded hover:bg-white/10"><Plus className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto pb-2 text-[12.5px]">
            <Arvore nos={nos} ativo={ativo} abertasPastas={pastas} alternar={(p) => setPastas((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; })}
              onAbrir={(p) => setIde((e) => (e ? abrir(e, p) : e))} onApagar={apagarArquivo} />
          </div>
        </aside>

        {/* editor + saída */}
        <section className="flex-1 min-w-0 flex flex-col">
          <div className="h-8 shrink-0 flex items-end overflow-x-auto no-scrollbar" style={{ background: Z.painel, borderBottom: `1px solid ${Z.borda}` }}>
            {ide.abertos.map((p) => (
              <div key={p} className="group h-full flex items-center gap-1.5 pl-3 pr-1.5 shrink-0 cursor-pointer"
                style={{ background: p === ativo ? Z.bg : "transparent", color: p === ativo ? Z.texto : Z.fraco, borderRight: `1px solid ${Z.borda}` }}
                onClick={() => setIde((e) => (e ? { ...e, ativo: p } : e))}>
                <span className="text-[12.5px]">{p.split("/").pop()}</span>
                <button type="button" aria-label={`Fechar ${p}`} onClick={(ev) => { ev.stopPropagation(); setIde((e) => (e ? fecharAba(e, p) : e)); }}
                  className="p-0.5 rounded opacity-50 group-hover:opacity-100 hover:bg-white/10"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
          {/* #421: .svg (a arte do Octa) abre como IMAGEM; "Código" volta pro editor */}
          {ativo && ehSvg(ativo) && (
            <div className="h-8 shrink-0 flex items-center gap-1 px-2" role="tablist" aria-label="Como mostrar o SVG" style={{ background: Z.bg, borderBottom: `1px solid ${Z.borda}` }}>
              {([["visualizar", "Visualizar"], ["codigo", "Código"]] as const).map(([k, rotulo]) => {
                const sel = (k === "codigo") === !!verCodigo[ativo];
                return (
                  <button key={k} type="button" role="tab" aria-selected={sel} onClick={() => setVerCodigo((v) => ({ ...v, [ativo]: k === "codigo" }))}
                    className="px-2.5 py-0.5 rounded text-[11.5px]" style={{ background: sel ? Z.sel : "transparent", color: sel ? Z.texto : Z.fraco }}>{rotulo}</button>
                );
              })}
            </div>
          )}
          <div className="flex-1 min-h-0">
            {ativo && ehSvg(ativo) && !verCodigo[ativo] ? (
              <PreviaSvg conteudo={ide.arquivos[ativo] ?? ""} titulo={ativo} />
            ) : ativo ? (
              <Monaco
                path={ativo}
                language={lang?.monaco}
                value={ide.arquivos[ativo] ?? ""}
                theme="octa-zed"
                beforeMount={(m) => m.editor.defineTheme("octa-zed", {
                  base: "vs-dark", inherit: true,
                  rules: [
                    { token: "comment", foreground: "5d636f", fontStyle: "italic" }, { token: "keyword", foreground: "b477cf" },
                    { token: "string", foreground: "a1c181" }, { token: "number", foreground: "bf956a" }, { token: "type", foreground: "6eb4bf" },
                  ],
                  colors: { "editor.background": Z.bg, "editor.lineHighlightBackground": "#2f343e", "editorLineNumber.foreground": "#4e5a5f", "editorLineNumber.activeForeground": Z.fraco, "editor.selectionBackground": "#74ade840" },
                })}
                onChange={(v) => setIde((e) => (e && e.ativo ? { ...e, arquivos: { ...e.arquivos, [e.ativo]: v ?? "" } } : e))}
                options={{ fontSize: 13.5, fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace', minimap: { enabled: false }, scrollBeyondLastLine: false, renderLineHighlight: "line", padding: { top: 10 }, automaticLayout: true, tabSize: 2 }}
              />
            ) : (
              <div className="grid place-items-center h-full" style={{ color: Z.apagado }}>Abra um arquivo no explorador ou peça ao Octa pra criar um.</div>
            )}
          </div>
          {/* saída */}
          <div className="shrink-0" style={{ borderTop: `1px solid ${Z.borda}`, background: Z.painel }}>
            <button type="button" onClick={() => setSaidaAberta((v) => !v)} className="w-full h-7 flex items-center gap-2 px-3 text-[11px] uppercase tracking-wider" style={{ color: Z.apagado }}>
              {saidaAberta ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} Saída {output.length ? `(${output.length})` : ""}
            </button>
            <div className={saidaAberta ? "h-40 overflow-y-auto px-3 pb-2 font-mono text-[12px]" : "hidden"}>
              <iframe ref={iframeRef} title="Prévia" className={lang?.runner === "html" ? "w-full h-32 bg-white rounded" : "hidden"} sandbox="allow-scripts" />
              {output.map((o: RunOutput, i: number) => (
                <div key={i} style={{ color: o.type === "stderr" ? Z.erro : o.type === "info" ? Z.apagado : Z.texto }} className="whitespace-pre-wrap">{o.text}</div>
              ))}
              {!output.length && lang?.runner !== "html" && <div style={{ color: Z.apagado }}>Clique em Rodar pra executar o arquivo aberto.</div>}
            </div>
          </div>
        </section>

        {/* JANELA DO AGENTE — tudo que é agêntico passa por aqui */}
        <aside className="w-[360px] shrink-0 flex flex-col min-h-0" style={{ background: Z.painel, borderLeft: `1px solid ${Z.borda}` }}>
          <div className="h-8 shrink-0 flex items-center gap-2 px-3 text-[11px] uppercase tracking-wider" style={{ color: Z.apagado, borderBottom: `1px solid ${Z.borda}` }}>
            <OctaIcon size={14} /> Agente
            {msgs.length > 0 && <button type="button" onClick={() => setMsgs([])} className="ml-auto normal-case tracking-normal hover:underline">limpar</button>}
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {!msgs.length && (
              <div className="text-[12.5px] leading-relaxed" style={{ color: Z.fraco }}>
                Peça qualquer coisa sobre o projeto. Em <b style={{ color: Z.texto }}>Revisar</b> eu só leio e aponto; em <b style={{ color: Z.texto }}>Alterar</b> eu edito, mas só os arquivos que você liberar.
              </div>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={m.role === "user" ? "ml-6" : ""}>
                <div className="rounded-lg px-3 py-2 whitespace-pre-wrap leading-relaxed" style={{ background: m.role === "user" ? Z.sel : "transparent", color: m.erro ? Z.erro : Z.texto, border: m.role === "assistant" ? `1px solid ${Z.borda}` : undefined }}>
                  {m.content}
                </div>
                {!!m.edicoes?.length && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                    <Pencil className="w-3 h-3" style={{ color: Z.ok }} />
                    {m.edicoes.map((p) => (
                      <button key={p} type="button" onClick={() => setIde((e) => (e && p in e.arquivos ? abrir(e, p) : e))} className="px-1.5 py-0.5 rounded hover:underline" style={{ background: "#a1c18122", color: Z.ok }}>{p}</button>
                    ))}
                    {m.desfazer && (
                      <button type="button" onClick={() => { const d = m.desfazer!; setIde(d); setMsgs((v) => v.map((x) => (x.id === m.id ? { ...x, desfazer: undefined, content: x.content + "\n\n(desfeito)" } : x))); }}
                        className="ml-auto flex items-center gap-1 hover:underline" style={{ color: Z.fraco }}><Undo2 className="w-3 h-3" /> desfazer</button>
                    )}
                  </div>
                )}
                {/* #421: a arte que o agente gravou aparece aqui mesmo, em miniatura (clique abre em Visualizar) */}
                {!!m.edicoes?.some((p) => ehSvg(p) && p in ide.arquivos) && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {m.edicoes!.filter((p) => ehSvg(p) && p in ide.arquivos).map((p) => (
                      <PreviaSvg key={`mini-${p}`} conteudo={ide.arquivos[p] ?? ""} titulo={p} tamanho="mini"
                        onClick={() => { setVerCodigo((v) => ({ ...v, [p]: false })); setIde((e) => (e && p in e.arquivos ? abrir(e, p) : e)); }} />
                    ))}
                  </div>
                )}
                {!!m.negados?.length && (
                  <div className="mt-1 text-[11.5px] flex items-center gap-1" style={{ color: Z.aviso }}>
                    <ShieldCheck className="w-3 h-3" /> bloqueado: {m.negados.map((n) => MOTIVO[n.motivo] ?? n.motivo).join(", ")}
                  </div>
                )}
                {m.pedeApagar && <div className="mt-1 text-[11.5px]" style={{ color: Z.aviso }}>O Octa quis apagar um arquivo: apagar só com você, pelo explorador.</div>}
                {m.modelo && <div className="mt-1 text-[10.5px]" style={{ color: Z.apagado }}>{m.modelo}</div>}
              </div>
            ))}
            {enviando && <div className="flex items-center gap-2 text-[12px]" style={{ color: Z.fraco }}><Loader2 className="w-3.5 h-3.5 animate-spin" /> o Octa está trabalhando…</div>}
            <div ref={fimChat} />
          </div>
          <div className="shrink-0 p-3 space-y-2" style={{ borderTop: `1px solid ${Z.borda}` }}>
            <div className="flex flex-wrap gap-1.5">
              {ATALHOS.map((a) => (
                <button key={a.rotulo} type="button" disabled={enviando} onClick={() => void enviar(a.texto, a.modo)}
                  className="px-2 py-1 rounded-md text-[11.5px] hover:bg-white/5 disabled:opacity-40" style={{ border: `1px solid ${Z.borda}`, color: Z.fraco }}>{a.rotulo}</button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[11.5px]">
              <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${Z.borda}` }}>
                {(["review", "change"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setModo(v)} aria-pressed={modo === v} className="px-2.5 py-1" style={{ background: modo === v ? Z.sel : "transparent", color: modo === v ? Z.texto : Z.apagado }}>
                    {v === "review" ? "Revisar" : "Alterar"}
                  </button>
                ))}
              </div>
              {modo === "change" && (
                <select value={escopo} onChange={(e) => setEscopo(e.target.value as "ativo" | "projeto")} className="rounded-md px-1.5 py-1 bg-transparent" style={{ border: `1px solid ${Z.borda}`, color: Z.fraco }}
                  title="O que o Octa pode editar neste pedido">
                  <option value="ativo">pode editar: {ativo ?? "nenhum"} (+ testes)</option>
                  <option value="projeto">pode editar: o projeto inteiro</option>
                </select>
              )}
            </div>
            <div className="flex items-end gap-2 rounded-lg px-2 py-1.5" style={{ background: Z.bg, border: `1px solid ${Z.borda}` }}>
              <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder="Peça ao Octa…"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
                className="flex-1 resize-none bg-transparent outline-none text-[13px] placeholder:text-[#5d636f]" style={{ color: Z.texto }} />
              {enviando ? (
                <button type="button" onClick={() => abortar.current?.abort()} title="Parar" className="p-1.5 rounded hover:bg-white/10"><Square className="w-4 h-4" /></button>
              ) : (
                <button type="button" onClick={() => void enviar()} disabled={!input.trim()} title="Enviar" className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30"><Send className="w-4 h-4" style={{ color: Z.acento }} /></button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** "Gerar testes" escreve num arquivo novo: libera os caminhos de teste do arquivo ativo junto. */
function testesDe(p: string): string[] {
  const base = p.replace(/\.[^.]+$/, "");
  const nome = base.split("/").pop() ?? base;
  return [`tests/**`, `${base}.test.*`, `${base}.spec.*`, `test_${nome}.*`, `**/test_${nome}.*`];
}
