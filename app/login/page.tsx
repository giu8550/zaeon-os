"use client";

/**
 * /login — a porta da frente da Zaeon.
 *
 * Mesma linguagem visual do painel do menu (o que abre no ENTRAR da home): painel de vidro
 * arredondado, logo com glow ciano, botão pílula preto/branco invertido. Quem chega aqui pelo
 * "Criar conta" não sente que trocou de produto.
 *
 * Dois caminhos:
 *   1) E-MAIL, sem senha. Não depende de OAuth, de DNS nem de servidor de e-mail — é o
 *      caminho que funciona sempre. Conta nova nasce no mesmo envio.
 *   2) GOOGLE, pra quem prefere. Obrigatório para contas de fundador/admin: entrada por
 *      e-mail é sem senha, e admin por ali seria porta destrancada.
 *
 * Nos dois, a carteira custodial nasce junto (src/lib/auth.ts → provisionarWallet).
 */

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import ZaeonLogo from "@/components/main/ZaeonLogo";

// Mensagens do NextAuth (?error=) em português de gente.
const ERROS: Record<string, string> = {
  OAuthSignin: "Não consegui falar com o Google agora. Tenta de novo.",
  OAuthCallback: "O Google respondeu, mas a volta falhou. Tenta de novo.",
  OAuthCreateAccount: "Não consegui criar sua conta. Tenta de novo em instantes.",
  Callback: "Algo se perdeu no caminho de volta. Tenta de novo.",
  AccessDenied: "Esse acesso foi recusado.",
  Configuration: "A configuração de login está fora do ar. Já estamos olhando.",
  CredentialsSignin:
    "Não consegui entrar com esse e-mail. Confere se está escrito certo — e, se for conta de fundador, entra pelo Google.",
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

  useEffect(() => {
    const e = params.get("error");
    if (e) setErro(ERROS[e] ?? ERROS.default);
  }, [params]);

  useEffect(() => {
    if (status === "authenticated") router.replace(destino);
  }, [status, destino, router]);

  const entrarPorEmail = async (ev: FormEvent) => {
    ev.preventDefault();
    const alvo = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alvo)) {
      setErro("Esse e-mail não parece completo. Exemplo: nome@dominio.com");
      return;
    }
    setErro(null);
    setIndo("email");
    // redirect:false pra mostrar o erro aqui mesmo, sem jogar a pessoa fora da página.
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
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-white dark:bg-[#030014]">
      {/* Halos ambientes — mesma respiração ciano da home, sem roubar a cena. */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -left-32 w-[36rem] h-[36rem] rounded-full bg-cyan-400/10 dark:bg-cyan-500/10 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -right-32 w-[32rem] h-[32rem] rounded-full bg-indigo-400/10 dark:bg-indigo-500/10 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative w-full max-w-md rounded-[32px] overflow-hidden backdrop-blur-2xl bg-white/40 dark:bg-cyan-950/10 border border-slate-200 dark:border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.1)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]"
      >
        <div className="p-8 flex flex-col gap-6">
          <div className="flex flex-col items-center text-center gap-3">
            <span className="inline-flex" style={{ filter: "drop-shadow(0 0 12px rgba(34,211,238,0.45))" }}>
              <ZaeonLogo aiState="idle" className="w-16 h-16" />
            </span>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">Criar conta na Zaeon</h1>
              <p className="text-[13px] text-slate-700 dark:text-white/80 mt-1 leading-relaxed">
                Seu e-mail e pronto. Sem senha, sem formulário, sem espera.
              </p>
            </div>
          </div>

          {erro && (
            <p className="text-[12px] font-bold text-red-600 dark:text-red-300 bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3 leading-relaxed">
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
              className="w-full px-5 py-3.5 rounded-full text-[13px] font-medium outline-none transition-colors
                         text-slate-900 dark:text-white
                         bg-white/60 dark:bg-white/[0.04]
                         border border-slate-200 dark:border-white/10
                         placeholder:text-slate-400 dark:placeholder:text-white/35
                         focus:border-cyan-400/60 dark:focus:border-cyan-400/40"
            />
            <button
              type="submit"
              disabled={ocupado}
              className="w-full bg-black dark:bg-white text-white dark:text-black text-[13px] font-bold py-3.5 rounded-full hover:scale-[1.02] transition-transform shadow-md disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
            >
              {indo === "email" ? "Entrando…" : "Continuar com e-mail"}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <span className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
            <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/50">ou</span>
            <span className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
          </div>

          <button
            onClick={entrarPorGoogle}
            disabled={ocupado}
            className="w-full flex items-center justify-center gap-2.5 rounded-full py-3.5 text-[13px] font-bold transition-colors
                       text-slate-800 dark:text-white
                       bg-white/50 hover:bg-white/80 dark:bg-white/[0.03] dark:hover:bg-white/[0.08]
                       border border-slate-200 dark:border-white/10 hover:border-cyan-400/50 dark:hover:border-cyan-400/30
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Image src="https://authjs.dev/img/providers/google.svg" alt="G" width={16} height={16} />
            {indo === "google" ? "Abrindo o Google…" : "Entrar com Google"}
          </button>

          <p className="text-[11px] text-slate-500 dark:text-white/45 leading-relaxed text-center">
            Ao entrar, sua carteira digital nasce junto — sem senha, sem extensão, sem taxa.
            É nela que ficam as conquistas que você emitir na Zaeon.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams exige Suspense no App Router (senão o build vira CSR bailout).
  return (
    <Suspense fallback={<div className="min-h-screen bg-white dark:bg-[#030014]" />}>
      <LoginInner />
    </Suspense>
  );
}
