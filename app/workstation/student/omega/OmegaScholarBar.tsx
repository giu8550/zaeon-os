"use client";
import { useState, useEffect } from "react";
import { ArrowUp, Loader2, CheckCircle2, AlertCircle, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOmegaScholar } from "./OmegaScholarContext";
import VoiceModeSwitch from "@/components/voice/VoiceModeSwitch";

interface OmegaScholarBarProps {
  flushTop?: boolean;
  onOpenResults?: () => void;
  /** Modo minimalista: vira só o ícone ⟁ (roxo); clicar abre a barra de input. */
  collapsible?: boolean;
}

export default function OmegaScholarBar({ flushTop = false, collapsible = false }: OmegaScholarBarProps) {
  const { runQuery, status, error, draft, setDraft, startedAt } = useOmegaScholar();
  const busy = status === "running";
  const [expanded, setExpanded] = useState(false);

  // enquanto pesquisa, a barra some do campo de visão (fica só o ⟁ girando)
  useEffect(() => { if (busy) setExpanded(false); }, [busy]);

  // ── Elapsed timer ──────────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (status === "running") {
      const base = startedAt ?? Date.now();
      setElapsed(Math.floor((Date.now() - base) / 1000));
      const id = setInterval(() => setElapsed(Math.floor((Date.now() - base) / 1000)), 1000);
      return () => clearInterval(id);
    }
  }, [status, startedAt]);

  const [tokens, setTokens] = useState(0);
  useEffect(() => {
    if (status !== "running") return;
    setTokens(0);
    const id = setInterval(() => setTokens((t) => t + 28 + Math.floor(Math.random() * 34)), 90);
    return () => clearInterval(id);
  }, [status]);

  const PHRASES = [
    "Vasculhando a literatura", "Lendo os papers", "Conectando as ideias",
    "Separando o que importa", "Cruzando as fontes", "Sintetizando",
    "Conferindo as evidências", "Montando sua resposta",
  ];
  const [phrase, setPhrase] = useState(0);
  useEffect(() => {
    if (status !== "running") return;
    setPhrase(0);
    const id = setInterval(() => setPhrase((p) => (p + 1) % PHRASES.length), 2600);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const [deep, setDeep] = useState(false);
  const [canDeep, setCanDeep] = useState(false);
  useEffect(() => {
    fetch("/api/ai/capabilities").then((r) => r.json()).then((d) => setCanDeep(!!d?.deepThink)).catch(() => setCanDeep(false));
  }, []);

  const submit = () => {
    if (draft.trim() && !busy) {
      runQuery(draft, canDeep && deep);
      setDraft("");
      if (collapsible) setExpanded(false); // Enter → fecha a barra (e o ⟁ gira)
    }
  };

  // Linha de input (compartilhada pelos dois modos)
  const inputRow = (
    <div className="relative z-10 flex items-center gap-2.5">
      {!collapsible && (
        <span className="relative inline-flex items-center justify-center w-5 h-5 shrink-0 ml-0.5" aria-hidden>
          {busy && <span className="absolute inset-0 rounded-full border border-cyan-400/40 animate-ping motion-reduce:animate-none" />}
          <span className={`text-cyan-500 dark:text-cyan-400 text-sm leading-none motion-reduce:animate-none ${busy ? "animate-[spin_4s_linear_infinite]" : "animate-[spin_14s_linear_infinite]"}`} style={{ filter: "drop-shadow(0 0 3px rgba(34,211,238,0.5))" }}>⟁</span>
        </span>
      )}
      <input
        data-academic-input="true"
        autoFocus={collapsible}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape" && collapsible) setExpanded(false); }}
        disabled={busy}
        placeholder="Pesquise o assunto do estudo…"
        className="flex-1 min-w-0 bg-transparent border-none px-1 py-1.5 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-white/30 outline-none disabled:opacity-60"
      />
      <VoiceModeSwitch onTranscript={(t) => setDraft(t)} title="Falar a pesquisa" />
      {canDeep && (
        <button onClick={() => setDeep((v) => !v)} disabled={busy} aria-pressed={deep}
          title={deep ? "Pensamento profundo ligado" : "Pensamento profundo"}
          className={`shrink-0 inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-[10px] font-bold transition-all disabled:opacity-60 ${deep ? "text-white" : "text-slate-500 dark:text-white/45 bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10"}`}
          style={deep ? { background: "linear-gradient(135deg,#7c3aed,#06b6d4)" } : undefined}>
          <Brain size={13} /> {deep ? "Profundo" : "Rápido"}
        </button>
      )}
      <button onClick={submit} disabled={busy} aria-label="Pesquisar"
        className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center shadow-md shadow-violet-600/30 disabled:opacity-60 transition-transform hover:scale-105">
        {busy ? <Loader2 className="animate-spin" size={15} /> : <ArrowUp size={15} />}
      </button>
    </div>
  );

  // ── MODO MINIMALISTA: só o ⟁ roxo; clicar abre a barra (dropdown) ──
  if (collapsible) {
    return (
      <div className={`${flushTop ? "" : "mt-2 ml-2"} relative shrink-0`}>
        <button
          onClick={() => { if (!busy) setExpanded((v) => !v); }}
          disabled={busy}
          aria-expanded={expanded}
          title={busy ? "Pesquisando…" : "Pesquisar com a Zaeon"}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-violet-500/15 border border-violet-400/40 text-violet-600 dark:text-violet-300 disabled:cursor-not-allowed transition-transform hover:scale-105 disabled:hover:scale-100"
        >
          <span className={`text-[17px] leading-none ${busy ? "animate-[spin_3s_linear_infinite]" : ""} motion-reduce:animate-none`} style={{ filter: "drop-shadow(0 0 5px rgba(124,58,237,0.55))" }}>⟁</span>
        </button>
        <AnimatePresence>
          {expanded && !busy && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="absolute top-full left-0 mt-2 z-50 w-[min(540px,86vw)] px-3.5 py-2.5 rounded-[1.4rem] bg-white/95 dark:bg-[#0a1020]/95 backdrop-blur-xl border border-violet-400/30 shadow-2xl"
            >
              {inputRow}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── MODO COMPLETO (barra inteira) ──
  return (
    <div className={`${flushTop ? "mt-0 mx-0" : "mt-6 mx-6"} px-3.5 py-2.5 rounded-[1.6rem] bg-gradient-to-r from-violet-500/15 to-purple-500/5 border border-white/30 dark:border-white/10 relative overflow-hidden`}>
      <div className="absolute -top-8 -right-8 w-40 h-40 bg-violet-400/10 rounded-full blur-[50px] pointer-events-none" />
      {inputRow}

      <AnimatePresence mode="wait">
        {status === "running" && (
          <motion.div key="running" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="flex items-center gap-2 pl-8 pt-1.5">
              <span className="text-xs font-medium text-violet-600 dark:text-violet-300 inline-flex items-center gap-1">
                <AnimatePresence mode="wait">
                  <motion.span key={phrase} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}>
                    {PHRASES[phrase]}
                  </motion.span>
                </AnimatePresence>
                <span className="inline-flex gap-0.5 ml-0.5">
                  <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" />
                  <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </span>
              <span className="text-xs text-slate-400 dark:text-white/40 tabular-nums ml-auto">{tokens.toLocaleString("pt-BR")} · {elapsed}s</span>
            </div>
          </motion.div>
        )}
        {status === "done" && (
          <motion.div key="done" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="flex items-center gap-2 pl-8 pt-1.5">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span className="text-xs text-slate-500 dark:text-white/50 tabular-nums">Pesquisa feita em {elapsed}s · {tokens.toLocaleString("pt-BR")} tokens</span>
            </div>
          </motion.div>
        )}
        {status === "error" && error && (
          <motion.div key="error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="flex items-center gap-2 pl-8 pt-1.5">
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <span className="text-xs text-red-400 truncate">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
