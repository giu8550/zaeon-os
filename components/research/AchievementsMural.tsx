"use client";

/**
 * Mural de Conquistas — credenciais soulbound do aluno (liquid glass, selo Solana discreto).
 * Sem linguagem cripto na cara do aluno: "conquista", "certificado", "prova". A Solana está por baixo.
 * Lê GET /api/credentials (Mongo + Helius DAS) e faz polling leve enquanto houver "cunhando".
 */
import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Award, BookOpen, GraduationCap, Sparkles, ShieldCheck, ExternalLink, RefreshCw, Wallet, Clock, AlertCircle } from "lucide-react";

type Credential = {
  id: string;
  type: "skill" | "work" | "course" | "mentor-cert" | string;
  title: string;
  status: "pending" | "minting" | "issued" | "error" | string;
  standard: string;
  network: string;
  assetId: string | null;
  explorerUrl: string | null;
  verified: boolean | null;
  issuedAt: string | null;
  createdAt: string;
  error?: string | null;
};

type Payload = {
  credentials: Credential[];
  verification: "helius" | "unavailable";
  wallet: string | null;
  network: string;
  claimUrl: string;
  configured: boolean;
};

const TYPE: Record<string, { label: string; icon: React.ReactNode; ring: string }> = {
  skill: { label: "Habilidade", icon: <Sparkles size={14} />, ring: "from-cyan-400/40 to-blue-500/10" },
  work: { label: "Trabalho", icon: <BookOpen size={14} />, ring: "from-violet-400/40 to-fuchsia-500/10" },
  course: { label: "Aula", icon: <GraduationCap size={14} />, ring: "from-emerald-400/40 to-teal-500/10" },
  "mentor-cert": { label: "Mentor", icon: <Award size={14} />, ring: "from-amber-400/50 to-orange-500/10" },
};

/** Selo Solana: gradiente da marca (roxo→verde), discreto, só um "S" estilizado. */
const SolanaSeal = ({ title }: { title: string }) => (
  <span title={title} className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[9px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-[#9945FF] to-[#14F195] shadow-[0_0_10px_rgba(20,241,149,0.35)]">
    <ShieldCheck size={10} /> Solana
  </span>
);

const StatusPill = ({ c }: { c: Credential }) => {
  if (c.status === "issued" && c.verified) return <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-500"><ShieldCheck size={10} /> verificada</span>;
  if (c.status === "issued") return <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-sky-500"><ShieldCheck size={10} /> emitida</span>;
  if (c.status === "minting" || c.status === "pending") return <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-amber-500"><Clock size={10} className="animate-pulse" /> registrando…</span>;
  return <span title={c.error || undefined} className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-rose-500"><AlertCircle size={10} /> pendente</span>;
};

export default function AchievementsMural({ className }: { className?: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/credentials", { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch { /* degrada: mural vazio */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Polling leve enquanto houver credencial cunhando (o mint acontece atrás, sem o aluno esperar).
  const hasMinting = Boolean(data?.credentials.some((c) => c.status === "minting" || c.status === "pending"));
  useEffect(() => {
    if (!hasMinting) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [hasMinting, load]);

  const refresh = async () => {
    setRefreshing(true);
    try { await fetch("/api/credentials/refresh", { method: "POST" }); } catch { /* ignore */ }
    await load();
    setRefreshing(false);
  };

  const creds = data?.credentials ?? [];
  const issued = creds.filter((c) => c.status === "issued").length;

  return (
    <div className={`w-full rounded-[2rem] bg-white/80 dark:bg-white/[0.02] border border-slate-300 dark:border-white/10 shadow-xl backdrop-blur-3xl p-6 ${className ?? ""}`}>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <Award size={16} className="text-amber-500" />
          <span className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">Mural de Conquistas</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {issued} {issued === 1 ? "prova emitida" : "provas emitidas"}
          </span>
          <button onClick={refresh} disabled={refreshing} title="Atualizar" className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors disabled:opacity-40">
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-[11px] text-slate-400">Carregando suas conquistas…</div>
      ) : creds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-5 text-center">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Cada conquista sua — nó de habilidade dominado, aula ou trabalho concluído — vira um certificado seu, permanente e verificável. Aparece aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <AnimatePresence>
            {creds.map((c) => {
              const t = TYPE[c.type] ?? { label: "Conquista", icon: <Award size={14} />, ring: "from-slate-400/30 to-slate-500/10" };
              return (
                <motion.div key={c.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className={`relative overflow-hidden rounded-2xl border border-white/60 dark:border-white/10 bg-gradient-to-br ${t.ring} p-4 backdrop-blur-xl shadow-lg`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">{t.icon} {t.label}</span>
                    {c.status === "issued" && <SolanaSeal title={c.assetId ? `Registro: ${c.assetId}` : "Registrada na Solana"} />}
                  </div>
                  <p className="text-[13px] font-bold text-slate-900 dark:text-white leading-snug line-clamp-2" title={c.title}>{c.title}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <StatusPill c={c} />
                    {c.explorerUrl && (
                      <a href={c.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                        ver prova <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  {c.issuedAt && <div className="mt-1 text-[9px] text-slate-400">{new Date(c.issuedAt).toLocaleDateString("pt-BR")}</div>}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Botão discreto: quem quiser exportar/auto-custodiar depois. Zero seed phrase até lá. */}
      {data && (issued > 0 || data.wallet) && (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200/70 dark:border-white/10 pt-3">
          <span className="text-[9px] text-slate-400 uppercase tracking-widest">
            {data.verification === "helius" ? "verificação on-chain ativa" : "verificação on-chain indisponível"} · {data.network}
          </span>
          <a href={data.claimUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">
            <Wallet size={10} /> reivindicar minha carteira
          </a>
        </div>
      )}
    </div>
  );
}
