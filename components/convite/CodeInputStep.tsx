"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface Props {
  initialCode?: string;
  onValidated: (sessionToken: string, inviteCode: string) => void;
}

export default function CodeInputStep({ initialCode = "", onValidated }: Props) {
  const [code, setCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/convite/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao validar código.");
        return;
      }
      onValidated(data.sessionToken, data.inviteCode);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030014] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-cyan-500/20 rounded-[2rem] p-10 shadow-2xl"
      >
        <h1 className="text-3xl font-black text-white tracking-tighter mb-2">
          Zaeon
        </h1>
        <p className="text-sm text-cyan-400/80 mb-8 font-medium">
          Insira seu código de convite para começar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX"
            maxLength={9}
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-center text-xl font-mono tracking-[0.3em] placeholder:text-white/20 focus:outline-none focus:border-cyan-500 transition-colors"
          />

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-red-400 text-center font-medium"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading || code.length < 9}
            className="w-full py-4 rounded-2xl bg-cyan-500 text-black font-black uppercase tracking-widest text-sm hover:bg-cyan-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
          >
            {loading ? "Verificando…" : "Entrar"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
