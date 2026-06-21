"use client";

/**
 * Seletor de voz da Zaeon — vive em Options (menu inicial) e em /settings.
 * Grava a escolha no localStorage (zaeon.voice.id / zaeon.voice.gender), que é
 * exatamente o que o ttsController (lib/voice/ttsController.ts) lê em toda fala.
 * Um botão de "ouvir" sintetiza uma amostra na voz escolhida (Kokoro via /api/ai/voice).
 */
import { useEffect, useState, useCallback } from "react";
import { Volume2, Loader2, Check, Crown } from "lucide-react";
import * as tts from "@/lib/voice/ttsController";

interface Voice {
  id: string;
  label: string;
  gender: "f" | "m";
  lang: string;
  tier: "free" | "premium";
}

const SAMPLE = "Olá, nós todos somos Zaeon. É assim que você vai ouvir a nossa voz.";

export default function VoicePicker({ compact = false }: { compact?: boolean }) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState<string | null>(null);

  useEffect(() => {
    try { setSelected(localStorage.getItem("zaeon.voice.id") || ""); } catch { /* ignore */ }
    let alive = true;
    fetch("/api/ai/voices")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.voices) return;
        setVoices(d.voices);
        // se nada salvo ainda, adota o default do engine
        setSelected((cur) => cur || d.default || d.voices[0]?.id || "");
      })
      .catch(() => { /* offline */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const pick = useCallback((v: Voice) => {
    setSelected(v.id);
    try {
      localStorage.setItem("zaeon.voice.id", v.id);
      localStorage.setItem("zaeon.voice.gender", v.gender);
    } catch { /* ignore */ }
  }, []);

  const preview = useCallback(async (v: Voice) => {
    setPreviewing(v.id);
    try { await tts.speak(SAMPLE, { voice: v.id, gender: v.gender }); }
    finally { setPreviewing((cur) => (cur === v.id ? null : cur)); }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-white/40 px-1 py-2">
        <Loader2 size={13} className="animate-spin" /> Carregando vozes…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {!compact && (
        <span className="text-[9px] uppercase font-bold tracking-tighter text-slate-500 dark:text-white/40 pl-1">
          Voz da Zaeon
        </span>
      )}
      {voices.map((v) => {
        const active = selected === v.id;
        return (
          <div
            key={v.id}
            onClick={() => pick(v)}
            className={`group flex items-center justify-between rounded-xl px-3 py-2 cursor-pointer border transition-all ${
              active
                ? "bg-cyan-50 border-cyan-400/60 dark:bg-cyan-400/10 dark:border-cyan-400/40"
                : "bg-white/50 border-slate-200 hover:border-cyan-300 dark:bg-white/[0.03] dark:border-white/5 dark:hover:border-cyan-400/30"
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${active ? "bg-cyan-500 text-white" : "border border-slate-300 dark:border-white/15"}`}>
                {active && <Check size={11} />}
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-[12px] font-medium text-slate-800 dark:text-white truncate flex items-center gap-1">
                  {v.label}
                  {v.tier === "premium" && <Crown size={11} className="text-amber-500 shrink-0" />}
                </span>
                <span className="text-[9px] text-slate-400 dark:text-white/30 uppercase tracking-wide">
                  {v.gender === "f" ? "feminina" : "masculina"} · {v.lang}
                </span>
              </span>
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); preview(v); }}
              title="Ouvir amostra"
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/50 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-colors"
            >
              {previewing === v.id ? <Loader2 size={13} className="animate-spin" /> : <Volume2 size={13} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
