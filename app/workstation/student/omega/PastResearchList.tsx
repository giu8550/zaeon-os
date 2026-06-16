"use client";
import { useState } from "react";
import { Clock, Loader2, FlaskConical, X } from "lucide-react";
import { useOmegaScholar } from "./OmegaScholarContext";

interface HistoryItem {
  id: string;
  query: string;
  domain?: string | null;
  status?: string | null;
  createdAt?: string | null;
}

// Data relativa em PT-BR (client; usa Date — não é helper puro testado, por design).
function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} ${d === 1 ? "dia" : "dias"}`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// Lista de "Pesquisas anteriores" — cada item reabre a sessão completa (loadSession),
// buscando os dados via GET /api/ai/scholar/sessions?id=. Bloqueada durante uma busca.
export default function PastResearchList({ items, activeId, onOpened }: {
  items: HistoryItem[];
  activeId?: string | null;
  onOpened?: () => void;
}) {
  const { loadSession, status } = useOmegaScholar();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const running = status === "running";

  async function del(id: string) {
    setRemoved((prev) => new Set(prev).add(id)); // some na hora
    try { await fetch(`/api/ai/scholar/sessions?id=${encodeURIComponent(id)}`, { method: "DELETE" }); } catch { /* ignore */ }
  }

  async function open(id: string) {
    if (running || loadingId) return;
    setLoadingId(id);
    try {
      const res = await fetch(`/api/ai/scholar/sessions?id=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (data?.session) {
        loadSession(data.session);
        onOpened?.();
      }
    } catch {
      // silencioso — mantém o estado atual
    } finally {
      setLoadingId(null);
    }
  }

  if (!items.length) return null;

  return (
    <div className="mt-8">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5">Pesquisas anteriores</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.filter((h) => !removed.has(h.id)).map((h) => {
          const isActive = !!activeId && h.id === activeId;
          const isLoading = loadingId === h.id;
          const meta = [h.domain, timeAgo(h.createdAt)].filter(Boolean).join(" · ");
          return (
            <div
              key={h.id}
              onClick={() => { if (!running && !loadingId) open(h.id); }}
              aria-current={isActive ? "true" : undefined}
              title={running ? "Aguarde a busca atual terminar" : "Reabrir esta pesquisa"}
              className={`group relative text-left rounded-2xl p-3.5 border transition-colors backdrop-blur-xl motion-reduce:transition-none
                ${isActive
                  ? "bg-violet-500/10 border-violet-400/50 dark:border-violet-400/40 shadow-[0_0_0_1px_rgba(139,92,246,0.35)]"
                  : "bg-white/50 dark:bg-white/[0.04] border-black/8 dark:border-white/10 hover:border-violet-400/40 hover:bg-white/70 dark:hover:bg-white/[0.07]"}
                ${running || loadingId ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {/* apagar pesquisa */}
              <button
                onClick={(e) => { e.stopPropagation(); del(h.id); }}
                title="Apagar esta pesquisa"
                className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
              >
                <X size={13} />
              </button>
              <div className="flex items-start gap-2.5">
                <span className={`shrink-0 mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center ${isActive ? "bg-violet-500/20 text-violet-600 dark:text-violet-300" : "bg-black/[0.04] dark:bg-white/[0.06] text-slate-400 dark:text-white/40"}`}>
                  {isLoading ? <Loader2 size={12} className="animate-spin" /> : <FlaskConical size={12} />}
                </span>
                <div className="min-w-0 flex-1">
                  {/* Texto simples no histórico; o glitch acontece ao SELECIONAR (na área de cima) */}
                  <p className="text-[12.5px] font-semibold text-slate-800 dark:text-white/85 leading-snug line-clamp-2 pr-5">{h.query}</p>
                  {meta && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-white/35">
                      <Clock size={9} /> {meta}
                      {isActive ? <span className="ml-1 text-violet-500 dark:text-violet-300 font-bold uppercase tracking-wide">· aberta</span> : null}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
