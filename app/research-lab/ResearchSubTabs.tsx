"use client";
/**
 * ResearchSubTabs — barra horizontal da Sala de Pesquisa UNIFICADA: Chat · Estudos · Pesquisas.
 * Mesma roupagem do ResearchShell/WindowSwitcher (vidro escuro, pill ativa com brilho violeta),
 * pra parecer parte da sala e não um menu à parte. Só existe com NEXT_PUBLIC_UNIFIED_RESEARCH_ROOM.
 */
import type { ResearchSubTab } from "@/lib/research/unifiedRoom";

const TABS: { id: ResearchSubTab; label: string; icon: string }[] = [
  { id: "chat", label: "Chat", icon: "⟁" },
  { id: "estudos", label: "Estudos", icon: "📚" },
  { id: "pesquisas", label: "Pesquisas", icon: "🗂" },
];

export default function ResearchSubTabs({
  value,
  onChange,
}: {
  value: ResearchSubTab;
  onChange: (t: ResearchSubTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Sala de Pesquisa"
      className="shrink-0 flex items-center gap-1.5 p-1.5 rounded-[16px] w-fit max-w-full overflow-x-auto no-scrollbar -mb-3"
      style={{
        background: "rgba(22,22,34,0.55)",
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
      }}
    >
      {TABS.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            data-tour={`sub-${t.id}`}
            onClick={() => onChange(t.id)}
            className="shrink-0 flex items-center gap-1.5 h-9 px-4 rounded-[11px] text-[11px] font-black uppercase tracking-wide whitespace-nowrap transition-all duration-150"
            style={
              active
                ? {
                    color: "#fff",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06))",
                    border: "1px solid rgba(255,255,255,0.28)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), 0 8px 20px -8px rgba(139,92,246,0.85)",
                  }
                : { color: "#b8b8d0", background: "transparent", border: "1px solid transparent" }
            }
          >
            <span
              aria-hidden
              style={t.id === "chat" ? { filter: "drop-shadow(0 0 4px rgba(34,211,238,0.6))" } : undefined}
            >
              {t.icon}
            </span>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
