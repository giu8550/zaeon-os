"use client";

import { useState } from "react";
import { validarNome, NOME_MAX } from "@/lib/ui/nomeUsuario";

/** Passo único antes do cyberespaço: como você quer ser chamado. Pré-preenchido com o nome da conta. */
export default function NomeUsuarioForm({ inicial, aoConcluir }: { inicial: string; aoConcluir: () => void }) {
  const [nome, setNome] = useState(inicial);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const v = validarNome(nome);
    if (!v.ok) { setErro(v.erro); return; }
    setErro(""); setSalvando(true);
    try {
      const r = await fetch("/api/user/nome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: v.nome }),
      });
      if (!r.ok) { setErro(((await r.json().catch(() => null)) as { error?: string } | null)?.error || "Não foi possível salvar agora."); return; }
      aoConcluir();
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#03030a] px-4">
      <form onSubmit={enviar} className="w-full max-w-sm rounded-2xl border border-cyan-500/25 bg-white/[0.04] p-6 text-left backdrop-blur">
        <h1 className="text-xl font-semibold text-white">Como você quer ser chamado?</h1>
        <p className="mt-1 text-sm text-white/60">Esse é o nome que aparece para os outros no cyberespaço.</p>
        <label htmlFor="nome-usuario" className="sr-only">Nome de usuário</label>
        <input
          id="nome-usuario"
          autoFocus
          value={nome}
          maxLength={NOME_MAX}
          onChange={(e) => setNome(e.target.value)}
          aria-invalid={!!erro}
          aria-describedby={erro ? "nome-erro" : undefined}
          className="mt-5 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-cyan-400"
          placeholder="Seu nome"
        />
        {erro && <p id="nome-erro" role="alert" className="mt-2 text-sm text-rose-300">{erro}</p>}
        <button
          type="submit"
          disabled={salvando}
          className="mt-5 min-h-[44px] w-full rounded-full bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Entrar no cyberespaço"}
        </button>
      </form>
    </div>
  );
}
