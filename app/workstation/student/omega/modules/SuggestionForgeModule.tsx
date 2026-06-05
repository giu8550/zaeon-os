"use client";
import { useMemo, useState } from "react";
import { Sparkles, Clock, ChevronDown, RefreshCw, FlaskConical, MessageSquarePlus } from "lucide-react";
import { useOmegaScholar } from "../OmegaScholarContext";
import type { AcademicLevel, GapType, QualityTier, Suggestion } from "@/lib/scholar/types";

// --- palettes (cyan/teal/amber; único desvio: fuchsia para excepcional) ----

const TIER_META: Record<QualityTier, { label: string; cls: string; glow?: string }> = {
  regular: { label: "Regular", cls: "text-slate-300 bg-slate-400/10 border-slate-400/25" },
  muito_bom: { label: "Muito bom", cls: "text-teal-300 bg-teal-400/10 border-teal-400/25" },
  excelente: { label: "Excelente", cls: "text-amber-300 bg-amber-400/10 border-amber-400/30" },
  excepcional: {
    label: "Excepcional",
    cls: "text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-400/30",
    glow: "shadow-[0_0_18px_rgba(232,121,249,0.35)] motion-reduce:shadow-none",
  },
};
const TIER_RANK: Record<QualityTier, number> = { excepcional: 3, excelente: 2, muito_bom: 1, regular: 0 };

const GAP_META: Record<GapType, { label: string; cls: string }> = {
  empirica: { label: "Empírica", cls: "bg-teal-500/8 text-teal-300/80 border-teal-500/15" },
  metodologica: { label: "Metodológica", cls: "bg-cyan-500/8 text-cyan-300/80 border-cyan-400/15" },
  geografica: { label: "Geográfica", cls: "bg-sky-500/8 text-sky-300/80 border-sky-500/15" },
  temporal: { label: "Temporal", cls: "bg-violet-500/8 text-violet-300/80 border-violet-400/15" },
  interdisciplinar: { label: "Interdisciplinar", cls: "bg-amber-500/8 text-amber-300/80 border-amber-400/15" },
};

const LEVEL_ORDER: AcademicLevel[] = ["grad", "msc", "phd", "postdoc"];
const LEVEL_SHORT: Record<AcademicLevel, string> = { grad: "Grad", msc: "Msc", phd: "PhD", postdoc: "Pós" };

const FEATURE_PAST_CHAT = process.env.NEXT_PUBLIC_FEATURE_PAST_RESEARCH_CHAT === "1";

// --- gauges -----------------------------------------------------------------

function TierBadge({ tier }: { tier: QualityTier }) {
  const m = TIER_META[tier];
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border ${m.cls} ${m.glow ?? ""}`}>
      {tier === "excepcional" && <Sparkles size={9} />} {m.label}
    </span>
  );
}

function GapTypeBadge({ type }: { type: GapType }) {
  const m = GAP_META[type];
  return (
    <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${m.cls}`}>
      {m.label}
    </span>
  );
}

function DifficultyGauge({ level }: { level: AcademicLevel }) {
  const idx = LEVEL_ORDER.indexOf(level);
  return (
    <div
      role="meter"
      aria-valuemin={1}
      aria-valuemax={4}
      aria-valuenow={idx + 1}
      aria-valuetext={`Dificuldade ${LEVEL_SHORT[level]}`}
      className="flex items-center gap-1"
    >
      {LEVEL_ORDER.map((l, i) => (
        <span
          key={l}
          className={`h-1.5 w-5 rounded-full ${i <= idx ? "bg-cyan-400" : "bg-white/10"} ${i === idx ? "shadow-[0_0_8px_rgba(34,211,238,0.6)] motion-reduce:shadow-none" : ""}`}
        />
      ))}
      <span className="text-[10px] text-cyan-300/70 ml-1 font-bold">{LEVEL_SHORT[level]}</span>
    </div>
  );
}

function RangeGauge({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={value}
      aria-valuetext={`${label} ${value.toFixed(2)}`}
      title={`${label}: ${value.toFixed(2)}`}
      className="flex items-center gap-2"
    >
      <span className="text-[10px] text-white/40 w-20 shrink-0">{label}</span>
      <span className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
        <span className="block h-full rounded-full bg-gradient-to-r from-teal-400 to-cyan-400" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[10px] text-white/50 w-8 text-right tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}

function TimeRange({ min, max }: { min: number; max: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-200/70 bg-cyan-500/8 border border-cyan-400/15 rounded-full px-2.5 py-1"
      title={`${min} a ${max} meses estimados`}
    >
      <Clock size={10} /> {min}–{max} meses
    </span>
  );
}

// --- card -------------------------------------------------------------------

function Bullet({ label, items }: { label: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <p className="text-[11px] text-slate-600 dark:text-white/60 leading-relaxed">
      <span className="font-bold text-slate-700 dark:text-white/75">{label}:</span> {items.join(" · ")}
    </p>
  );
}

function SuggestionCard({ s, onMiniChat }: { s: Suggestion; onMiniChat?: (s: Suggestion) => void }) {
  const [open, setOpen] = useState(false);
  const d = s.desdobramentos;
  return (
    <div className="rounded-2xl bg-white/70 dark:bg-white/[0.04] border border-black/8 dark:border-white/12 p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <TierBadge tier={s.quality_tier} />
          <GapTypeBadge type={s.gap_type} />
        </div>
        <DifficultyGauge level={s.axes.difficulty} />
      </div>

      <p className="font-bold text-sm text-slate-800 dark:text-white leading-snug">{s.title}</p>
      <p className="text-xs text-slate-500 dark:text-white/50 leading-relaxed" title={s.rationale}>{s.rationale}</p>
      <p className="text-[11px] text-cyan-700/70 dark:text-cyan-300/60 italic">✦ {s.novelty_angle}</p>

      <div className="rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200/60 dark:border-white/8 px-3 py-3 space-y-2">
        <RangeGauge value={s.axes.relevance} label="Relevância" />
        <RangeGauge value={s.axes.innovation} label="Inovação" />
        <div className="flex items-center gap-2 pt-0.5">
          <TimeRange min={s.axes.estimated_months_min} max={s.axes.estimated_months_max} />
          <span className="text-[10px] text-white/30">gap {s.gap_score.toFixed(2)}</span>
        </div>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:underline"
      >
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} /> Ver desdobramentos
      </button>

      {open && (
        <div className="space-y-1.5 border-t border-black/5 dark:border-white/8 pt-3">
          <Bullet label="Publicação alvo" items={d.publication_targets} />
          <Bullet label="Métodos" items={d.required_methods} />
          <Bullet label="Recursos" items={d.material_resources} />
          <Bullet label="Pré-requisitos" items={d.prerequisites} />
          <Bullet label="Riscos" items={d.risks} />
          <Bullet label="Marcos" items={d.milestones} />
          <p className="text-[10px] text-slate-400 dark:text-white/30 pt-1">
            Evidência: refs {d.evidence_refs.map((i) => `#${i}`).join(", ") || "—"}
            {d.cross_link_refs.length > 0 ? ` · cruzamento ${d.cross_link_refs.map((i) => `#${i}`).join(" ↔ ")}` : ""}
          </p>
          {FEATURE_PAST_CHAT && onMiniChat && (
            <button
              onClick={() => onMiniChat(s)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 border border-cyan-400/30 rounded-full px-3 py-1.5 hover:bg-cyan-500/10"
            >
              <MessageSquarePlus size={12} /> Iniciar mini-chat sobre esta sugestão
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// --- module -----------------------------------------------------------------

const ALL_TIERS: QualityTier[] = ["excepcional", "excelente", "muito_bom", "regular"];

export default function SuggestionForgeModule({ onMiniChat }: { onMiniChat?: (s: Suggestion) => void }) {
  const { session, suggestions, suggestionsCoverage, loadingSuggestions, fetchSuggestions } = useOmegaScholar();
  const [tierFilter, setTierFilter] = useState<Set<QualityTier>>(new Set());
  const [diffFilter, setDiffFilter] = useState<Set<AcademicLevel>>(new Set());

  const refCount = session?.references?.length ?? 0;

  const visible = useMemo(() => {
    const list = (suggestions ?? []).filter(
      (s) => (tierFilter.size === 0 || tierFilter.has(s.quality_tier)) && (diffFilter.size === 0 || diffFilter.has(s.axes.difficulty))
    );
    return [...list].sort(
      (a, b) =>
        TIER_RANK[b.quality_tier] - TIER_RANK[a.quality_tier] ||
        b.axes.innovation - a.axes.innovation ||
        b.axes.relevance - a.axes.relevance
    );
  }, [suggestions, tierFilter, diffFilter]);

  const toggle = <T,>(set: Set<T>, setter: (s: Set<T>) => void, v: T) => {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    setter(next);
  };

  if (refCount < 3) {
    return (
      <div className="text-center text-slate-400 dark:text-white/30 text-sm py-12">
        <FlaskConical size={20} className="mx-auto mb-2 opacity-50" />
        Forje sugestões assim que tiver pelo menos 3 referências verificadas.
      </div>
    );
  }

  const titles = (suggestions ?? []).map((s) => s.title);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] font-bold text-slate-500 dark:text-white/50 inline-flex items-center gap-1.5">
          <Sparkles size={13} className="text-fuchsia-400" /> Sugestão · forjada a partir de {refCount} referências
        </p>
        <button
          onClick={() => (suggestions?.length ? fetchSuggestions({ exclude: titles }) : fetchSuggestions())}
          disabled={loadingSuggestions}
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl border border-violet-400/40 text-violet-600 dark:text-violet-300 hover:bg-violet-500/10 disabled:opacity-50"
        >
          <RefreshCw size={13} className={loadingSuggestions ? "animate-spin motion-reduce:animate-none" : ""} />
          {suggestions?.length ? "Forjar mais" : "Forjar"}
        </button>
      </div>

      {/* Filters */}
      {(suggestions?.length ?? 0) > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {ALL_TIERS.map((t) => (
            <button
              key={t}
              onClick={() => toggle(tierFilter, setTierFilter, t)}
              className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border transition ${tierFilter.has(t) ? TIER_META[t].cls : "text-slate-400 dark:text-white/30 border-black/10 dark:border-white/10"}`}
            >
              {TIER_META[t].label}
            </button>
          ))}
          <span className="w-px h-3 bg-white/10 mx-1" />
          {LEVEL_ORDER.map((l) => (
            <button
              key={l}
              onClick={() => toggle(diffFilter, setDiffFilter, l)}
              className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border transition ${diffFilter.has(l) ? "text-cyan-300 bg-cyan-400/10 border-cyan-400/25" : "text-slate-400 dark:text-white/30 border-black/10 dark:border-white/10"}`}
            >
              {LEVEL_SHORT[l]}
            </button>
          ))}
        </div>
      )}

      {/* Coverage summary */}
      {suggestionsCoverage && (
        <p className="text-[11px] italic text-cyan-700/60 dark:text-cyan-300/40 leading-relaxed">{suggestionsCoverage}</p>
      )}

      {/* Loading skeletons */}
      {loadingSuggestions && !suggestions?.length && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-white/40 dark:bg-white/[0.03] border border-black/5 dark:border-white/8 p-5 animate-pulse motion-reduce:animate-none">
              <div className="h-3 w-24 bg-white/10 rounded mb-3" />
              <div className="h-4 w-3/4 bg-white/10 rounded mb-2" />
              <div className="h-3 w-full bg-white/8 rounded mb-1.5" />
              <div className="h-12 w-full bg-white/5 rounded" />
            </div>
          ))}
          <p className="text-center text-[11px] text-fuchsia-400/60">Forjando hipóteses…</p>
        </div>
      )}

      {/* Cards */}
      {visible.map((s) => (
        <SuggestionCard key={s.id} s={s} onMiniChat={onMiniChat} />
      ))}

      {!loadingSuggestions && (suggestions?.length ?? 0) === 0 && (
        <p className="text-center text-slate-400 dark:text-white/30 text-xs py-8">
          Clique em <span className="font-bold">Forjar</span> para gerar propostas derivadas destas referências.
        </p>
      )}
    </div>
  );
}
