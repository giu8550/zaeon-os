"use client";

/**
 * /login — a porta da frente. Dois caminhos, um clique cada.
 *
 * 1) E-MAIL: um campo, sem senha. Não depende de DNS, de OAuth nem de servidor de
 *    e-mail — funciona em qualquer endereço em que o app esteja no ar, então é por
 *    aqui que se testa produção. Conta nova nasce no mesmo envio.
 * 2) GOOGLE: para quem prefere, e obrigatório para contas de fundador/admin (o caminho
 *    por e-mail é sem senha: admin por ali seria porta destrancada).
 *
 * Nos dois, a carteira custodial nasce junto (src/lib/auth.ts → provisionarWallet).
 */

import { Suspense, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

// Mensagens do NextAuth (?error=) em português de gente.
const ERROS: Record<string, string> = {
  OAuthSignin: "Não consegui falar com o Google agora. Tenta de novo.",
  OAuthCallback: "O Google respondeu, mas a volta falhou. Tenta de novo.",
  OAuthCreateAccount: "Não consegui criar sua conta. Tenta de novo em instantes.",
  Callback: "Algo se perdeu no caminho de volta. Tenta de novo.",
  AccessDenied: "Esse acesso foi recusado.",
  Configuration: "A configuração de login está fora do ar. Já estamos olhando.",
  CredentialsSignin:
    "Não consegui entrar com esse e-mail. Confere se está escrito certo — e, se for conta de fundador, entra pelo Google ali embaixo.",
  default: "Deu ruim no login. Tenta de novo.",
};

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useSession();

  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState<"email" | "google" | null>(null);

  const destino = params.get("callbackUrl") || "/workstation";

  // Erro vindo do redirect do NextAuth (?error=) aparece já na primeira pintura.
  useEffect(() => {
    const e = params.get("error");
    if (e) setErro(ERROS[e] ?? ERROS.default);
  }, [params]);

  useEffect(() => {
    if (status === "authenticated") router.replace(destino);
  }, [status, destino, router]);

  const entrarPorEmail = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const alvo = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alvo)) {
      setErro("Esse e-mail não parece completo. Exemplo: nome@dominio.com");
      return;
    }
    setErro(null);
    setIndo("email");
    // redirect:false pra poder mostrar o erro aqui mesmo, sem jogar o usuário fora.
    const r = await signIn("credentials", { email: alvo, redirect: false });
    if (r?.error) {
      setErro(ERROS.CredentialsSignin);
      setIndo(null);
      return;
    }
    router.replace(destino);
  };

  const entrarPorGoogle = async () => {
    setIndo("google");
    await signIn("google", { callbackUrl: destino });
  };

  const ocupado = indo !== null || status === "loading";

  return (
    <div className="min-h-screen bg-white dark:bg-[#080808] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md flex flex-col gap-6 p-8 bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/8 rounded-3xl"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-black dark:text-white leading-tight">Entrar na Zaeon</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold">
            Seu e-mail e pronto. Sem senha, sem formulário, sem espera.
          </p>
        </div>

        {erro && (
          <p className="text-sm font-bold text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {erro}
          </p>
        )}

        <form onSubmit={entrarPorEmail} className="flex flex-col gap-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@universidade.edu.br"
            aria-label="Seu e-mail"
            className="w-full px-5 py-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-black dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 font-bold outline-none focus:border-slate-400 dark:focus:border-white/30 transition"
          />
          <button
            type="submit"
            disabled={ocupado}
            className="w-full px-6 py-4 rounded-2xl bg-black dark:bg-white text-white dark:text-black font-black text-base transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {indo === "email" ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">ou</span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        </div>

        <button
          onClick={entrarPorGoogle}
          disabled={ocupado}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-black dark:text-white font-black text-base transition hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.7 1.22 9.2 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.27-3.15.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.88.93 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          {indo === "google" ? "Abrindo o Google…" : "Entrar com Google"}
        </button>

        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
          Ao entrar, sua carteira digital é criada automaticamente — sem senha, sem extensão,
          sem taxa. Ela guarda as conquistas que você emitir na Zaeon.
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams exige Suspense no App Router (senão o build vira CSR bailout).
  return (
    <Suspense fallback={<div className="min-h-screen bg-white dark:bg-[#080808]" />}>
      <LoginInner />
    </Suspense>
  );
}
