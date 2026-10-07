"use client";

/**
 * ConfigMenu — a engrenagem da navbar (ao lado do tema): as mesmas opções do "Opções" do menu
 * principal, de qualquer página. Voz da Zaeon · idioma · acessar convite · MODO CEO (o admin
 * escondido: só founder/super-admin vê — mesma regra do menu principal) · sair · deletar conta.
 * Deslogado: só voz e idioma.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { Cog6ToothIcon, ChevronDownIcon, ChevronRightIcon, ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { Crown, Mic, Trash2, Loader2, Ticket } from "lucide-react";
import VoicePicker from "@/components/settings/VoicePicker";
import LanguageFlagToggle from "@/components/ui/LanguageFlagToggle";
import { isSuperAdmin } from "@/lib/auth/roles";

const item = "group relative flex items-center gap-3 w-full min-h-[48px] px-3 rounded-2xl text-left text-sm font-medium text-slate-800 dark:text-white border border-slate-200/80 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.03] hover:bg-white/80 dark:hover:bg-white/[0.08] hover:border-cyan-400/50 dark:hover:border-cyan-400/30 transition-colors";
const rotulo = "text-[9px] uppercase font-bold tracking-tighter text-slate-500 dark:text-white/50";

export default function ConfigMenu() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [aberto, setAberto] = useState(false);
  const [vozAberta, setVozAberta] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [convite, setConvite] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);

  const logado = status === "authenticated";
  const ceo = isSuperAdmin({ email: session?.user?.email, role: (session?.user as { role?: string } | undefined)?.role });

  useEffect(() => {
    if (!aberto) return;
    try { setConvite(localStorage.getItem("zaeon.inviteAccessed") === "1"); } catch { /* sem storage */ }
    const fora = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setAberto(false); botao.current?.focus(); } };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);

  const ir = (href: string) => { setAberto(false); router.push(href); };

  const apagarConta = async () => {
    if (apagando) return;
    if (!window.confirm("Apagar sua conta? Isso remove TODOS os seus dados e libera o e-mail pra começar do zero. Não dá pra desfazer.")) return;
    setApagando(true);
    try {
      const r = await fetch("/api/account", { method: "DELETE" });
      if (!r.ok) { setApagando(false); window.alert("Não consegui apagar a conta agora. Tente de novo."); return; }
      await signOut({ callbackUrl: "/" });
    } catch { setApagando(false); window.alert("Erro de conexão."); }
  };

  return (
    <div ref={raiz} className="relative">
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label="Configurações"
        title="Configurações"
        className="relative p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
      >
        <Cog6ToothIcon className={`w-6 h-6 text-slate-700 dark:text-slate-200 transition-transform duration-500 ${aberto ? "rotate-90" : ""}`} />
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Configurações"
          className="absolute right-0 top-full mt-2 w-[min(92vw,330px)] max-h-[min(78vh,620px)] overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2 rounded-[24px]
            backdrop-blur-2xl backdrop-saturate-[1.6] border border-white/60 dark:border-white/[0.12]
            bg-white/90 dark:bg-[#0b1020]/95 shadow-[0_18px_50px_-20px_rgba(37,99,235,0.45)] dark:shadow-[0_18px_50px_-20px_rgba(0,0,0,0.8)]"
        >
          <p className="px-2 pt-1 pb-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">Configurações</p>

          {/* VOZ — retraída; abre pra escolher */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.03] overflow-hidden">
            <button type="button" onClick={() => setVozAberta((v) => !v)} aria-expanded={vozAberta} className="w-full flex items-center gap-3 px-3 min-h-[48px] text-left">
              <Mic size={16} className="text-cyan-600 dark:text-cyan-300 shrink-0" />
              <span className="text-sm font-medium text-slate-800 dark:text-white flex-1">Voz da Zaeon</span>
              <ChevronDownIcon className={`h-4 w-4 opacity-40 transition-transform ${vozAberta ? "rotate-180" : ""}`} />
            </button>
            {vozAberta && <div className="px-3 pb-3"><VoicePicker /></div>}
          </div>

          {/* IDIOMA */}
          <div className={`${item} cursor-default`}>
            <span className="flex flex-col flex-1">
              <span className={rotulo}>{t("options.language", "Idioma")}</span>
              <span>{(i18n.language || "pt").toUpperCase()}</span>
            </span>
            <LanguageFlagToggle size={30} />
          </div>

          {logado && convite && (
            <button type="button" onClick={() => ir("/convite")} className={item}>
              <Ticket size={16} className="text-cyan-600 dark:text-cyan-300 shrink-0" />
              <span className="flex-1 truncate">Acessar convite</span>
              <ChevronRightIcon className="h-4 w-4 opacity-30 group-hover:opacity-100" />
            </button>
          )}

          {/* MODO CEO — o admin escondido: só founder/super-admin */}
          {ceo && (
            <button type="button" onClick={() => ir("/workstation/admin")} className={`${item} hover:!border-amber-400/60`}>
              <span aria-hidden className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-full bg-amber-400" />
              <Crown size={16} className="text-amber-500 dark:text-amber-300 shrink-0" />
              <span className="flex-1 truncate">Modo CEO</span>
              <ChevronRightIcon className="h-4 w-4 opacity-30 group-hover:opacity-100" />
            </button>
          )}

          {logado && (
            <>
              <button type="button" onClick={() => void signOut()} className={`${item} hover:!bg-red-50 hover:!border-red-300 dark:hover:!bg-red-500/20 dark:hover:!border-red-500/40`}>
                <span className="flex flex-col flex-1">
                  <span className={rotulo}>Sessão</span>
                  <span>{t("menu.logout", "Sair")}</span>
                </span>
                <ArrowRightStartOnRectangleIcon className="h-4 w-4 opacity-40" />
              </button>
              <button type="button" onClick={() => void apagarConta()} disabled={apagando}
                className="flex items-center gap-3 w-full min-h-[48px] px-3 rounded-2xl text-left text-sm font-medium border bg-red-50/60 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30 dark:hover:bg-red-500/20 transition-colors">
                <span className="flex flex-col flex-1">
                  <span className="text-[9px] uppercase font-bold tracking-tighter opacity-60">Zona de risco</span>
                  <span>{apagando ? "Apagando…" : "Deletar minha conta"}</span>
                </span>
                {apagando ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} className="opacity-70" />}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
