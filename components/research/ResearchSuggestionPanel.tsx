// components/research/ResearchSuggestionPanel.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { Termometro } from "@/lib/scholar/termometro";
import AuthGateNotice from "./AuthGateNotice";
import ThinkingStream from "./ThinkingStream";
import GlitchOnce from "./GlitchOnce";

type Level = "grad" | "msc" | "phd" | "postdoc";

interface RefItem {
  source: "PubMed" | "arXiv" | "DOI" | "Scholar";
  title: string;
  authors: string;
  year: string;
  venue: string;
  doi?: string | null;
}

interface Suggestion {
  type: "Exploratória" | "Experimental" | "Pioneira";
  title: string;
  rationale: string;
  novelty_angle: string;
  gap_score: number;
}

interface EngineResponse {
  suggestion: Suggestion;
  references: RefItem[];
  termometro?: Termometro;
  inline_citation?: { quote: string; source: string; doi?: string } | null;
}

interface Props {
  docTitle?: string;
  onSelectTitle?: (title: string) => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

const LEVELS: { id: Level; icon: string; name: string; tag: string; tagClass: string }[] = [
  { id: "grad",    icon: "🎓", name: "Graduando",  tag: "Exploratória", tagClass: "bg-cyan-500/10 text-cyan-400/50" },
  { id: "msc",     icon: "🔬", name: "Mestrando",  tag: "Experimental", tagClass: "bg-teal-500/10 text-teal-400/60" },
  { id: "phd",     icon: "⚗️", name: "Doutorando", tag: "Pioneira",     tagClass: "bg-cyan-500/[0.12] text-cyan-300/70" },
  { id: "postdoc", icon: "🚀", name: "Pós-Doc",    tag: "Ultra",        tagClass: "bg-cyan-400/15 text-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.15)]" },
];

const LEVEL_DESCRIPTIONS: Record<Level, string> = {
  grad:    'Modo <strong class="text-cyan-400">EXPLORATÓRIA</strong> — mapeia o território, organiza literatura existente. Ideal para TCC e Iniciação Científica.',
  msc:     'Modo <strong class="text-cyan-400">EXPERIMENTAL</strong> — hipótese clara, metodologia controlada. Mira Qualis A2/B1 e periódicos Scopus.',
  phd:     'Modo <strong class="text-cyan-400">PIONEIRA</strong> — contribuição original, gap real na literatura. Mira Tese sólida e journals Q1.',
  postdoc: 'Modo <strong class="text-cyan-400">PIONEIRA ULTRA</strong> — cruza disciplinas, identifica lacunas sem precedente, mira Q1 internacional e publicações de alto impacto.',
};

const SOURCE_STYLES: Record<string, string> = {
  PubMed: "bg-teal-500/8 text-teal-400/70 border border-teal-500/15",
  arXiv:  "bg-cyan-500/8 text-cyan-400/60 border border-cyan-400/13",
  DOI:    "bg-sky-500/7 text-sky-400/60 border border-sky-500/13",
  Scholar:"bg-cyan-400/6 text-cyan-300/50 border border-cyan-400/10",
};

const TYPE_LABEL_STYLES: Record<string, string> = {
  Exploratória: "bg-cyan-400/10 text-cyan-300/60 border border-cyan-400/15",
  Experimental: "bg-teal-400/10 text-teal-300/60 border border-teal-400/15",
  Pioneira:     "bg-cyan-400/12 text-cyan-300/70 border border-cyan-400/20",
};

/** Termômetro vertical de nível: pressione e arraste (ou clique num nível) pra mudar a profundidade. */
function LevelThermometer({ value, onChange }: { value: Level; onChange: (l: Level) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const n = LEVELS.length;
  const idx = Math.max(0, LEVELS.findIndex((l) => l.id === value));
  const fillPct = ((idx + 1) / n) * 100; // bulbo sempre cheio; sobe com o nível

  const setFromY = (clientY: number) => {
    const el = trackRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const ratio = 1 - (clientY - r.top) / r.height; // 0 (base) .. 1 (topo)
    let i = Math.round(ratio * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    const next = LEVELS[i].id;
    if (next !== value) onChange(next);
  };

  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-[.18em] text-slate-400 dark:text-white/30 mb-2">Nível da pesquisa · segure e arraste</p>
      <div className="flex items-stretch gap-3">
        {/* coluna do termômetro */}
        <div
          ref={trackRef}
          onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDragging(true); setFromY(e.clientY); }}
          onPointerMove={(e) => { if (dragging) setFromY(e.clientY); }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          className="relative w-9 shrink-0 rounded-full cursor-ns-resize select-none touch-none bg-slate-200 dark:bg-white/[0.06] border border-slate-300/60 dark:border-white/10"
          style={{ height: 168 }}
          role="slider" aria-valuemin={1} aria-valuemax={n} aria-valuenow={idx + 1} aria-label="Nível da pesquisa"
          title="Segure e arraste pra mudar o nível"
        >
          {/* mercúrio */}
          <div className="absolute left-1 right-1 bottom-1 rounded-full transition-[height] duration-200"
            style={{ height: `calc(${fillPct}% - 4px)`, background: "linear-gradient(180deg,#22d3ee,#7c3aed)" }} />
          {/* knob no topo do mercúrio */}
          <div className="absolute left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white shadow-md border-2 border-cyan-400 transition-[bottom] duration-200 flex items-center justify-center text-[11px]"
            style={{ bottom: `calc(${fillPct}% - 14px)` }}>{LEVELS[idx].icon}</div>
        </div>

        {/* níveis clicáveis (de cima = mais avançado) */}
        <div className="flex-1 flex flex-col-reverse justify-between py-0.5">
          {LEVELS.map((l) => {
            const on = l.id === value;
            return (
              <button key={l.id} type="button" onClick={() => onChange(l.id)}
                className={`text-left rounded-lg px-2 py-1 transition-colors ${on ? "bg-cyan-500/10" : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"}`}>
                <span className={`text-[11px] font-black ${on ? "text-cyan-700 dark:text-cyan-300" : "text-slate-500 dark:text-white/40"}`}>{l.icon} {l.name}</span>
                <span className={`block text-[8px] font-bold uppercase tracking-wide ${on ? "text-cyan-600/80 dark:text-cyan-300/70" : "text-slate-400 dark:text-white/25"}`}>{l.tag}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-slate-500 dark:text-white/45" dangerouslySetInnerHTML={{ __html: LEVEL_DESCRIPTIONS[value] }} />
    </div>
  );
}

export default function ResearchSuggestionPanel({ docTitle = "", onSelectTitle, collapsible = false, defaultCollapsed = false }: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [level, setLevel] = useState<Level>("postdoc");
  const [topic, setTopic] = useState(docTitle || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EngineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [excludeTitles, setExcludeTitles] = useState<string[]>([]);

  // Keep topic in sync if docTitle changes from outside
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (docTitle && !topic) setTopic(docTitle);
  }, [docTitle]);

  async function fetchSuggestion(isRefresh = false) {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setAuthRequired(false);

    // Build exclude list from accumulated state + current suggestion (if refreshing)
    const currentTitle = result?.suggestion.title;
    const exclude =
      isRefresh && currentTitle
        ? [...excludeTitles, currentTitle]
        : excludeTitles;

    try {
      const res = await fetch("/api/ai/research-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), level, exclude_titles: exclude }),
      });

      if (res.status === 401) {
        setAuthRequired(true);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Erro ${res.status}`);
      }

      const data = await res.json() as EngineResponse;
      // Persist the title we just excluded so future refreshes keep avoiding it
      if (isRefresh && currentTitle) {
        setExcludeTitles(prev =>
          prev.includes(currentTitle) ? prev : [...prev, currentTitle]
        );
      }
      setResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const currentLevel = LEVELS.find(l => l.id === level)!;

  const brl = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const GRAD = "linear-gradient(135deg,#0ea5e9,#22d3ee)";

  return (
    <div className="w-full rounded-[1.6rem] overflow-hidden border bg-white/70 border-slate-200 dark:bg-white/[0.04] dark:border-white/10 backdrop-blur-2xl">
      {/* ── HEADER ── */}
      <div
        className={`px-5 py-4 border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between ${collapsible ? "cursor-pointer select-none" : ""}`}
        onClick={collapsible ? () => setCollapsed((c) => !c) : undefined}
      >
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-[10px] flex items-center justify-center text-white text-[13px]" style={{ background: GRAD }}>✦</span>
          <span className="text-[13px] font-black tracking-tight text-slate-900 dark:text-white">Sugestão de pesquisa</span>
        </div>
        <span className="text-[8px] font-bold uppercase tracking-[.16em] text-cyan-600 dark:text-cyan-300 border border-cyan-500/20 px-2.5 py-1 rounded-full bg-cyan-500/[0.06]">IA · Gemini</span>
      </div>

      {(!collapsible || !collapsed) && (
      <div className="p-5 flex flex-col gap-4">
        {/* ── TEMA ── */}
        <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchSuggestion(false)} placeholder="Tema da pesquisa…"
          className="w-full rounded-2xl px-4 py-3 text-[12px] focus:outline-none bg-slate-100 text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:border-cyan-500/50 dark:bg-white/5 dark:text-white dark:placeholder:text-white/25 dark:border-white/10 dark:focus:border-cyan-400/40" />

        {/* ── TERMÔMETRO DE NÍVEL (press-and-hold) ── */}
        <LevelThermometer value={level} onChange={setLevel} />

        {/* ── BOTÃO PREMIUM (estilo about-us): Gerar → standby "Usar como título" ── */}
        <div className="flex justify-center pt-0.5">
          {!result || loading ? (
            <button
              onClick={() => fetchSuggestion(false)}
              disabled={loading || !topic.trim()}
              className="group relative inline-block px-9 py-3 rounded-2xl overflow-hidden bg-black/40 border border-cyan-500/30 text-white font-black text-[11px] uppercase tracking-[0.28em] shadow-2xl backdrop-blur-md transition-all duration-500 hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600/40 via-cyan-500/40 to-blue-600/40 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
              <span className="relative z-10 group-hover:text-cyan-100 group-hover:drop-shadow-[0_0_10px_white] transition-all">
                {loading ? "Gerando…" : "Gerar sugestão ✦"}
              </span>
            </button>
          ) : (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("zaeon:research:use-title", { detail: { title: result.suggestion.title } }))}
              className="group relative inline-block px-9 py-3 rounded-2xl overflow-hidden border text-white font-black text-[11px] uppercase tracking-[0.24em] shadow-[0_0_24px_rgba(34,211,238,0.25)] backdrop-blur-md transition-all duration-500 hover:scale-105 animate-pulse hover:animate-none"
              style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.55), rgba(6,182,212,0.55))", borderColor: "rgba(34,211,238,0.45)" }}
              title="Usar esta sugestão como título do trabalho (vai pra aba Pesquisa)"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
              <span className="relative z-10">Usar como título do trabalho →</span>
            </button>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-600 dark:text-rose-300 flex items-center justify-between gap-2">
            <span className="min-w-0">{error}</span>
            <button onClick={() => fetchSuggestion(false)} disabled={loading} className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 font-black uppercase tracking-[.08em] hover:bg-rose-500/25 disabled:opacity-40">↻ de novo</button>
          </div>
        )}

        {authRequired && <AuthGateNotice />}

        {loading && (
          <div className="p-4 rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.05]">
            <ThinkingStream running label="forjando uma proposta relevante" />
          </div>
        )}

        {/* ── SUGGESTION CARD ── */}
        {result && !loading && (
          <div className="p-4 rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.05]">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[8px] font-black uppercase tracking-[.14em] text-white px-2.5 py-0.5 rounded-full" style={{ background: GRAD }}>✦ Sugestão</span>
              <span className="text-[8px] font-bold uppercase tracking-[.08em] px-2 py-0.5 rounded-full text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 border border-cyan-500/20">{currentLevel.icon} {result.suggestion.type}</span>
              <button onClick={() => fetchSuggestion(true)} disabled={loading} className="ml-auto rounded-lg px-2.5 py-1 text-[8px] font-black uppercase tracking-[.1em] text-cyan-600 dark:text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/10 disabled:opacity-40">↻ outra</button>
            </div>
            <p className="text-[13px] font-extrabold leading-[1.4] mb-1.5 text-slate-900 dark:text-white"><GlitchOnce text={result.suggestion.title} /></p>
            <p className="text-[11px] leading-[1.55] text-slate-600 dark:text-white/55">{result.suggestion.rationale}</p>
            {/* confirmar = botão premium abaixo do termômetro (standby) */}
          </div>
        )}

        {/* ── TERMÔMETRO ── */}
        {result?.termometro && !loading && (
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10">
              <p className="text-[8px] font-black uppercase tracking-[.16em] text-slate-400 dark:text-white/30 mb-1">Tempo médio</p>
              <p className="text-[14px] font-extrabold text-cyan-600 dark:text-cyan-300">{result.termometro.researchTime.label}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10">
              <p className="text-[8px] font-black uppercase tracking-[.16em] text-slate-400 dark:text-white/30 mb-1">Bolsa · {result.termometro.scholarship.probability}</p>
              <p className="text-[14px] font-extrabold text-emerald-600 dark:text-emerald-300">{brl(result.termometro.scholarship.monthlyValueBRL)}<span className="text-[8px] font-bold text-slate-400">/mês</span></p>
              <p className="text-[7px] text-slate-400 dark:text-white/30 mt-0.5">até {brl(result.termometro.scholarship.monthlyValueRangeBRL[1])} · {result.termometro.scholarship.agencies.join(" · ")}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10">
              <p className="text-[8px] font-black uppercase tracking-[.16em] text-slate-400 dark:text-white/30 mb-1.5">Originalidade</p>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden"><div className="h-full" style={{ width: `${Math.round(result.termometro.gapScore * 100)}%`, background: GRAD }} /></div>
              <p className="text-[8px] text-slate-500 dark:text-white/40 mt-1">{result.termometro.gapLabel}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10">
              <p className="text-[8px] font-black uppercase tracking-[.16em] text-slate-400 dark:text-white/30 mb-1">Alvo publicação</p>
              <p className="text-[14px] font-extrabold text-violet-600 dark:text-violet-300">{result.termometro.publication.qualis}</p>
              <p className="text-[7px] text-slate-400 dark:text-white/30 mt-0.5">{result.termometro.publication.tier}</p>
            </div>
            <div className="col-span-2 p-2.5 rounded-xl bg-cyan-500/[0.06] border border-cyan-500/15">
              <p className="text-[9px] text-slate-600 dark:text-white/50 leading-snug">💡 {result.termometro.scholarship.note}</p>
            </div>
          </div>
        )}

        {/* ── REFERENCES ── */}
        {result && result.references.length > 0 && (
          <div className="border border-slate-200 dark:border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-white/[0.06]">
              <span className="text-[9px] font-black uppercase tracking-[.14em] text-slate-400 dark:text-white/30">Trabalhos relacionados</span>
              <span className="text-[8px] font-bold text-cyan-600 dark:text-cyan-300 bg-cyan-500/10 border border-cyan-500/15 px-2 py-0.5 rounded-lg">{result.references.length}</span>
            </div>
            {result.references.map((ref, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(i * 0.05, 0.5) }}
                className="px-3.5 py-2.5 border-t border-slate-100 dark:border-white/[0.04] flex items-start gap-2">
                <span className={`text-[7px] font-black uppercase tracking-[.08em] px-2 py-0.5 rounded-lg shrink-0 mt-0.5 ${SOURCE_STYLES[ref.source] ?? SOURCE_STYLES["DOI"]}`}>{ref.source}</span>
                <div>
                  <p className="text-[10.5px] font-semibold text-slate-700 dark:text-white/70 leading-snug">{ref.title}</p>
                  <p className="text-[8px] font-mono text-slate-400 dark:text-white/25 mt-0.5">{ref.authors} · {ref.year} · {ref.venue}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {!result && !loading && !error && !authRequired && (
          <p className="text-center text-[11px] text-slate-400 dark:text-white/30 leading-relaxed py-2">
            Escolha o nível, confirme o tema e clique em <strong className="text-slate-600 dark:text-white/50">Gerar ✦</strong>.
          </p>
        )}
      </div>
      )}
    </div>
  );
}
