"use client";
import { useEffect, useState } from "react";
import { BookMarked, Lightbulb, Sparkles } from "lucide-react";
import { useOmegaScholar } from "./OmegaScholarContext";
import ActivityThread from "./ActivityThread";
import ReferencesModule from "./modules/ReferencesModule";
import InsightsModule from "./modules/InsightsModule";
import SuggestionForgeModule from "./modules/SuggestionForgeModule";
import OmegaSuggestionHighlight from "./OmegaSuggestionHighlight";
import AuthGateNotice from "@/components/research/AuthGateNotice";
import PastResearchChatModal from "@/components/research/PastResearchChatModal";
import type { Suggestion } from "@/lib/scholar/types";

const TABS = [
  { id: "refs", label: "Referências", icon: BookMarked },
  { id: "insights", label: "Insights & Síntese", icon: Lightbulb },
  { id: "suggestions", label: "Sugestão", icon: Sparkles },
];

export default function OmegaScholarWorkspace() {
  const { session, status } = useOmegaScholar();
  const [mod, setMod] = useState("refs");
  const [history, setHistory] = useState<any[]>([]);
  const [chatSuggestion, setChatSuggestion] = useState<Suggestion | null>(null);

  useEffect(() => {
    fetch("/api/ai/scholar/sessions").then((r) => r.json()).then((d) => setHistory(d.sessions ?? [])).catch(() => {});
  }, [status]);

  const s = session;
  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6">
      <ActivityThread />
      {status !== "unauthorized" && <OmegaSuggestionHighlight />}

      {status === "unauthorized" && (
        <AuthGateNotice className="my-10 max-w-md mx-auto" />
      )}

      {status === "idle" && (
        <div className="text-center text-slate-400 dark:text-white/30 text-sm py-16">
          Faça uma pergunta na barra do Omega Scholar acima — os resultados aparecem aqui. 🎓
        </div>
      )}

      {s && (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {TABS.map((t) => {
              const Icon = t.icon; const on = mod === t.id;
              const count = t.id === "refs" ? s.references?.length : undefined;
              return (
                <button key={t.id} onClick={() => setMod(t.id)}
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl border transition ${on ? "bg-violet-600 text-white border-violet-600" : "text-slate-500 dark:text-white/50 border-black/10 dark:border-white/10 hover:border-violet-400/40"}`}>
                  <Icon size={13} /> {t.label}{count != null ? ` (${count})` : ""}
                </button>
              );
            })}
          </div>
          {mod === "refs" && <ReferencesModule references={s.references ?? []} evidence={s.evidence ?? []} />}
          {mod === "insights" && <InsightsModule insights={s.insights} />}
          {mod === "suggestions" && <SuggestionForgeModule onMiniChat={setChatSuggestion} />}
        </>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Pesquisas anteriores</p>
          <div className="flex gap-2 flex-wrap">
            {history.map((h) => (
              <span key={h.id} className="text-[11px] text-slate-500 dark:text-white/50 bg-black/[0.03] dark:bg-white/5 rounded-full px-3 py-1.5">{h.query}</span>
            ))}
          </div>
        </div>
      )}

      {chatSuggestion && (
        <PastResearchChatModal
          item={{ id: chatSuggestion.id, title: chatSuggestion.title }}
          seedContext={chatSuggestion as unknown as Record<string, unknown>}
          onClose={() => setChatSuggestion(null)}
        />
      )}
    </div>
  );
}
