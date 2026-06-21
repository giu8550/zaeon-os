"use client";

/**
 * /c/[token] — aceitar um convite de colaboração.
 * Logado → entra no doc (join) e vai pro Lounge com ele aberto.
 * Deslogado → manda pro login e volta pra cá.
 */
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { Loader2, Users, AlertTriangle } from "lucide-react";

export default function JoinCollabPage() {
  const params = useParams();
  const router = useRouter();
  const { status } = useSession();
  const token = String((params as any)?.token || "");
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (status === "loading" || ran.current) return;
    if (status === "unauthenticated") {
      signIn("google", { callbackUrl: typeof window !== "undefined" ? window.location.href : "/" });
      return;
    }
    ran.current = true;
    (async () => {
      try {
        const r = await fetch("/api/collab/join", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.id) {
          router.replace(`/research-lab?tab=lounge&collab=${d.id}`);
        } else {
          setError(d.error || "Não consegui abrir este convite.");
        }
      } catch {
        setError("Erro de conexão ao aceitar o convite.");
      }
    })();
  }, [status, token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-100 dark:bg-[#030014]">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-[26px] border border-cyan-300/40 dark:border-cyan-400/20 bg-white dark:bg-[#0b1220] p-8 text-center shadow-2xl">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg,#0ea5e9,#22d3ee)" }}>
          {error ? <AlertTriangle size={26} className="text-white" /> : <Users size={26} className="text-white" />}
        </div>
        {error ? (
          <>
            <h1 className="text-lg font-black text-slate-900 dark:text-white mb-1">Convite indisponível</h1>
            <p className="text-[12px] text-slate-500 dark:text-white/50 mb-5">{error}</p>
            <button onClick={() => router.replace("/research-lab?tab=lounge")} className="px-6 py-2.5 rounded-full text-white text-[12px] font-black uppercase tracking-widest" style={{ background: "linear-gradient(135deg,#0ea5e9,#22d3ee)" }}>
              Ir pro Lounge
            </button>
          </>
        ) : (
          <>
            <h1 className="text-lg font-black text-slate-900 dark:text-white mb-1">Entrando na colaboração…</h1>
            <p className="text-[12px] text-slate-500 dark:text-white/50 mb-4">Te levando pro Lounge pra vocês co-criarem.</p>
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-cyan-500" />
          </>
        )}
      </motion.div>
    </div>
  );
}
