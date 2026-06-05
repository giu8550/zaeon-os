"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { X, Send, Download, FlaskConical, Sparkles } from "lucide-react";

export interface ChatModalItem {
  id: number | string;
  title: string;
  participants?: { grads: number; masters: number; phds: number };
  progress?: number;
  status?: string;
  details?: { agents: string[]; writing: number; methodology: number; impact: number; clarity: number; rank: string };
}

interface ChatMessage { id: string; role: "user" | "assistant"; content: string; createdAt?: string }
interface Ref { title: string; authors?: string; year?: number | string }

// Realça citações [ref:N] como badges cyan; preserva quebras de linha.
function renderContent(content: string) {
  return content.split(/(\[ref:\d+\])/g).map((seg, i) => {
    const m = seg.match(/^\[ref:(\d+)\]$/);
    if (m) {
      return (
        <span key={i} className="inline-flex items-center text-[9px] font-black text-cyan-300 bg-cyan-500/15 border border-cyan-400/30 rounded px-1 mx-0.5 align-middle">
          ref {m[1]}
        </span>
      );
    }
    return <span key={i}>{seg}</span>;
  });
}

export default function PastResearchChatModal({ item, seedContext, onClose }: { item: ChatModalItem; seedContext?: Record<string, unknown>; onClose: () => void }) {
  const researchId = String(item.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [live, setLive] = useState(""); // assistant draft em streaming
  const scrollRef = useRef<HTMLDivElement>(null);

  // seedContext (ex.: derivado de uma Suggestion) tem prioridade; senão, deriva do item do card.
  const context = seedContext
    ? { references: [] as Ref[], ...seedContext, title: item.title }
    : {
        title: item.title,
        participants: item.participants,
        agents: item.details?.agents ?? [],
        metrics: item.details
          ? { writing: item.details.writing, methodology: item.details.methodology, impact: item.details.impact, clarity: item.details.clarity, rank: item.details.rank }
          : undefined,
        progress: item.progress,
        status: item.status,
        references: [] as Ref[],
      };

  // Carrega histórico ao abrir.
  useEffect(() => {
    let alive = true;
    fetch(`/api/research/chat/${encodeURIComponent(researchId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.exists && Array.isArray(d.messages)) setMessages(d.messages);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [researchId]);

  // Fecha no Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Auto-scroll a cada token/mensagem.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, live]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: text }]);
    setStreaming(true);
    setLive("");
    try {
      const res = await fetch(`/api/research/chat/${encodeURIComponent(researchId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, title: item.title, context }),
      });
      if (!res.ok || !res.body) {
        setMessages((m) => [...m, { id: `e-${Date.now()}`, role: "assistant", content: "⚠ Não consegui responder agora. Tente novamente." }]);
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      const dispatch = (line: string) => {
        if (!line.trim()) return;
        let ev: any;
        try { ev = JSON.parse(line); } catch { return; }
        if (ev.type === "token") { acc += ev.text; setLive(acc); }
        else if (ev.type === "done") {
          setMessages((m) => [...m, ev.message ?? { id: `a-${Date.now()}`, role: "assistant", content: acc }]);
          setLive("");
        } else if (ev.type === "error") {
          setMessages((m) => [...m, { id: `e-${Date.now()}`, role: "assistant", content: `⚠ ${ev.message}` }]);
          setLive("");
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const l of lines) dispatch(l);
      }
      if (buf) dispatch(buf);
    } catch {
      setMessages((m) => [...m, { id: `e-${Date.now()}`, role: "assistant", content: "⚠ Erro de conexão." }]);
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, researchId, item.title]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportMarkdown = () => {
    const md = `# ${item.title}\n\n` + messages.map((m) => `**${m.role === "user" ? "Você" : "Omega Scholar"}:** ${m.content}`).join("\n\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `chat-${researchId}.md`;
    a.click();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Chat sobre ${item.title}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl h-[85vh] rounded-3xl bg-[#0b1020] border border-white/10 shadow-2xl overflow-hidden flex"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: metadata */}
        <aside className="hidden md:flex md:w-1/4 flex-col border-r border-white/10 p-5 overflow-y-auto custom-scrollbar">
          <p className="text-[9px] font-black uppercase tracking-widest text-cyan-400/60 mb-2">Pesquisa</p>
          <h3 className="text-sm font-bold text-white leading-snug">{item.title}</h3>
          {item.participants && (
            <div className="flex gap-3 mt-3 text-[10px] text-white/50">
              {item.participants.phds > 0 && <span><b className="text-white">{item.participants.phds}</b> PhDs</span>}
              {item.participants.masters > 0 && <span><b className="text-white">{item.participants.masters}</b> Mestres</span>}
              <span><b className="text-white">{item.participants.grads}</b> Grad</span>
            </div>
          )}
          {item.details && (
            <>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mt-5 mb-2">Agentes</p>
              <div className="flex flex-wrap gap-1.5">
                {item.details.agents.map((a, i) => (
                  <span key={i} className="text-[9px] px-2 py-0.5 bg-blue-500/10 text-blue-300 rounded border border-blue-500/20">{a}</span>
                ))}
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mt-5 mb-2">Métricas</p>
              <div className="space-y-1.5">
                {([["Escrita", item.details.writing], ["Metodologia", item.details.methodology], ["Impacto", item.details.impact], ["Clareza", item.details.clarity]] as const).map(([l, v]) => (
                  <div key={l} className="flex items-center gap-2">
                    <span className="text-[10px] text-white/40 w-20">{l}</span>
                    <span className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden"><span className="block h-full bg-cyan-400" style={{ width: `${v}%` }} /></span>
                    <span className="text-[9px] text-white/40 tabular-nums">{v}</span>
                  </div>
                ))}
                <p className="text-[10px] text-white/40 pt-1">Rank <b className="text-amber-400">{item.details.rank}</b></p>
              </div>
            </>
          )}
        </aside>

        {/* Center: chat */}
        <section className="flex-1 flex flex-col min-w-0">
          <header className="flex items-center justify-between px-5 py-3 border-b border-white/10">
            <span className="text-xs font-bold text-white/70 inline-flex items-center gap-1.5"><Sparkles size={13} className="text-fuchsia-400" /> Omega Scholar · mini-chat</span>
            <button onClick={onClose} aria-label="Fechar" className="text-white/40 hover:text-white"><X size={18} /></button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3" aria-live="polite">
            {messages.length === 0 && !live && (
              <p className="text-center text-white/30 text-xs py-10">Converse com o Omega Scholar sobre esta pesquisa. Pergunte sobre métodos, lacunas, próximos passos…</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-violet-600 text-white" : "bg-white/[0.06] text-white/80 border border-white/10"}`}>
                  {renderContent(m.content)}
                </div>
              </div>
            ))}
            {live && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap bg-white/[0.06] text-white/80 border border-white/10">
                  {renderContent(live)}<span className="inline-block w-1.5 h-3 bg-cyan-400/70 ml-0.5 animate-pulse motion-reduce:animate-none align-middle" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); send(); } }}
                rows={1}
                placeholder="Pergunte algo… (Ctrl+Enter envia)"
                className="flex-1 resize-none max-h-32 rounded-xl bg-white/[0.05] border border-white/10 text-white/90 text-xs px-3 py-2.5 outline-none focus:border-cyan-400/40 placeholder:text-white/25"
              />
              <button
                onClick={send}
                disabled={streaming || !input.trim()}
                aria-label="Enviar"
                className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500 text-white disabled:opacity-40 hover:bg-cyan-400"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </section>

        {/* Right: refs + actions */}
        <aside className="hidden lg:flex lg:w-1/4 flex-col border-l border-white/10 p-5 overflow-y-auto custom-scrollbar">
          <p className="text-[9px] font-black uppercase tracking-widest text-cyan-400/60 mb-2">Referências</p>
          <p className="text-[11px] text-white/30 italic">Sem referências verificadas anexadas a este projeto.</p>

          <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mt-6 mb-2">Ações</p>
          <button onClick={exportMarkdown} disabled={!messages.length} className="w-full inline-flex items-center gap-2 text-[11px] font-bold text-white/70 border border-white/10 rounded-xl px-3 py-2.5 hover:border-cyan-400/40 disabled:opacity-40 mb-2">
            <Download size={13} /> Exportar conversa (Markdown)
          </button>
          <div className="text-[10px] text-white/25 inline-flex items-center gap-1.5 mt-1">
            <FlaskConical size={11} /> Pesquisa aprofundada em breve
          </div>
        </aside>
      </div>
    </div>
  );
}
