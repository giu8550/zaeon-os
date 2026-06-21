"use client";
import { useState, useEffect } from "react";
import { ArrowUp, Loader2, CheckCircle2, AlertCircle, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOmegaScholar } from "./OmegaScholarContext";
import VoiceModeSwitch from "@/components/voice/VoiceModeSwitch";
import GlitchTerm from "@/components/research/GlitchTerm";

interface OmegaScholarBarProps {
  flushTop?: boolean;
  onOpenResults?: () => void;
  /** Modo minimalista: vira só o ícone ⟁ (roxo); clicar abre a barra de input. */
  collapsible?: boolean;
}

export default function OmegaScholarBar({ flushTop = false, collapsible = false }: OmegaScholarBarProps) {
  const { runQuery, stopQuery, status, error, draft, setDraft, startedAt, session, query } = useOmegaScholar();
  const busy = status === "running";
  const hasResult = !!session;
  const [expanded, setExpanded] = useState(!session);

  // Sem estudo → barra aberta (ícone + input). Estudo gerado (ou pesquisando) → fecha (só o ⟁).
  useEffect(() => { setExpanded(!hasResult && !busy); }, [hasResult, busy]);

  // Onboarding: a Zaeon pré-preenche a barra com um tema sugerido (ex.: "história do Brasil").
  useEffect(() => {
    const onPrefill = (e: any) => { const t = e?.detail; if (typeof t === "string" && t) { setDraft(t); if (collapsible) setExpanded(true); } };
    window.addEventListener("zaeon:tour:prefill", onPrefill);
    return () => window.removeEventListener("zaeon:tour:prefill", onPrefill);
  }, [collapsible, setDraft]);

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

  // ── MODO MINIMALISTA: ⟁ roxo + (na MESMA linha) a barra de input OU o último estudo.
  //    Clica no ⟁ → mostra a barra; clica de novo → some a barra e volta o último estudo. ──
  if (collapsible) {
    const lastStudy = (query || (session as any)?.query || "").trim();
    return (
      <div className={`${flushTop ? "" : "mt-2"} flex items-center gap-2 mb-4`}>
        <button
          onClick={() => { if (busy) stopQuery(); else setExpanded((v) => !v); }}
          aria-expanded={expanded}
          title={busy ? "Parar pesquisa" : expanded ? "Esconder a busca" : "Pesquisar o assunto do estudo"}
          className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full border bg-violet-500/15 border-violet-400/40 text-violet-600 dark:text-violet-300 transition-transform hover:scale-105"
        >
          <span className={`text-[17px] leading-none ${busy ? "animate-[spin_3s_linear_infinite]" : ""} motion-reduce:animate-none`} style={{ filter: "drop-shadow(0 0 5px rgba(124,58,237,0.55))" }}>⟁</span>
        </button>
        <AnimatePresence initial={false} mode="wait">
          {expanded && !busy ? (
            <motion.div key="bar"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}
              className="flex-1 min-w-0 px-3.5 py-1.5 rounded-[1.4rem] bg-gradient-to-r from-violet-500/12 to-purple-500/5 border border-violet-300/30 dark:border-white/10"
            >
              {inputRow}
            </motion.div>
          ) : (
            <motion.div key="last"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}
              className="flex-1 min-w-0 flex items-center overflow-hidden"
            >
              {lastStudy ? (
                // o assunto aparece AO LADO do ⟁ com o glitch latim↔chinês (sem lupa — o ⟁ já é o ícone)
                <GlitchTerm term={lastStudy.length > 80 ? lastStudy.slice(0, 80) + "…" : lastStudy} done={!busy} hideIcon oneLine />
              ) : (
                <span className="text-sm text-slate-400 dark:text-white/40">Pesquise o assunto do estudo</span>
              )}
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
