"use client";
/**
 * TabletLab — o MODO ESTUDO por cima do cyberespaço: quando o tablet termina de se materializar nas mãos do avatar
 * (lib/cyber/descanso, components/cyber/AvatarLuz), o LABORATÓRIO abre aqui, numa moldura de tablet sobre a cena — o
 * cyberespaço continua vivo atrás (o avatar fica parado estudando, e os outros veem). Fecha pelo botão, pelo Esc ou
 * pelo "Voltar" do próprio lab (`?tablet=1` → postMessage MSG_FECHAR_TABLET).
 *
 * A CONCORRÊNCIA (a feature mais importante do tablet, pedido do dono): guardar o tablet NÃO fecha o laboratório. Depois
 * da 1ª abertura o iframe fica montado (só some da tela), então uma pesquisa/resposta que estava rodando continua
 * rodando enquanto a pessoa brinca no cyberespaço; o laboratório avisa o trabalho de IA (lib/ui/monitorIA → MSG_IA) e
 * isso vai pra barra de IA do HUD (`onIA`). Reabrir o tablet volta exatamente onde estava.
 * A 1ª vez de todas abre na Sala de Estudos, no chat; depois, onde a pessoa deixou (lib/ui/loungeHub `urlDoLabNoTablet`).
 * A moldura segue o tema da navbar (claro/escuro — next-themes, a mesma classe `dark` do site); o laboratório dentro
 * do iframe é da mesma origem e lê o mesmo tema.
 */
import { useEffect, useRef, useState } from "react";
import { CHAVE_TABLET_JA_ABRIU, ehMsgFecharTablet, ehMsgIA, ehMsgPesquisaSalva, urlDoLabNoTablet, urlDoLabNoTutorial, type EstadoIALab, type PesquisaSalva } from "@/lib/ui/loungeHub";

export default function TabletLab({ aberto, onFechar, onIA, tutorial, onPesquisaSalva }: { aberto: boolean; onFechar: () => void; onIA?: (e: EstadoIALab) => void; /** a 1ª abertura é a do TUTORIAL do novato: o lab roda o tour da 1ª missão */ tutorial?: boolean; onPesquisaSalva?: (p: PesquisaSalva) => void }) {
  const salva = useRef(onPesquisaSalva); salva.current = onPesquisaSalva;
  const [src, setSrc] = useState<string | null>(null), [carregou, setCarregou] = useState(false);
  const fechar = useRef(onFechar); fechar.current = onFechar;
  const ia = useRef(onIA); ia.current = onIA;
  const abertoRef = useRef(aberto); abertoRef.current = aberto;
  // monta o laboratório na 1ª abertura e NUNCA mais desmonta (a concorrência)
  useEffect(() => {
    if (!aberto || src) return;
    let ja = false; try { ja = localStorage.getItem(CHAVE_TABLET_JA_ABRIU) === "1"; localStorage.setItem(CHAVE_TABLET_JA_ABRIU, "1"); } catch { /* sem storage: abre no chat */ }
    setSrc(tutorial ? urlDoLabNoTutorial() : urlDoLabNoTablet(ja));
  }, [aberto, src, tutorial]);
  // as mensagens do laboratório: guardar o tablet e o trabalho de IA (este, mesmo com o tablet guardado)
  useEffect(() => {
    if (!src) return;
    const onMsg = (e: MessageEvent) => {
      if (ehMsgIA(e.data, e.origin, window.location.origin)) { ia.current?.(e.data.estado); return; }
      if (ehMsgPesquisaSalva(e.data, e.origin, window.location.origin)) { salva.current?.(e.data.pesquisa); return; }
      if (abertoRef.current && ehMsgFecharTablet(e.data, e.origin, window.location.origin)) fechar.current();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [src]);
  // guardou o tablet: o foco do teclado sai do iframe (senão o WASD continuava indo pro laboratório invisível)
  useEffect(() => {
    if (aberto) return;
    const a = document.activeElement as HTMLElement | null; if (a?.tagName === "IFRAME") { a.blur(); window.focus(); }
  }, [aberto]);
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); fechar.current(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto]);
  if (!src) return null;
  return (
    <div className={`absolute inset-0 z-[40] flex items-center justify-center p-3 sm:p-6 ${aberto ? "bg-[#02040c]/35 backdrop-blur-[1.5px]" : "pointer-events-none invisible"}`}
      role="dialog" aria-modal={aberto} aria-hidden={!aberto} aria-label="Laboratório no tablet">
      <div className={`tablet-lab relative flex h-full max-h-[920px] w-full max-w-[1320px] flex-col overflow-hidden rounded-[30px] border p-2
        border-sky-400/50 bg-white/95 shadow-[0_0_0_1px_rgba(56,140,255,.12),0_0_60px_rgba(70,150,255,.28)]
        dark:border-cyan-300/45 dark:bg-[#050a18] dark:shadow-[0_0_0_1px_rgba(102,230,255,.12),0_0_60px_rgba(70,190,255,.35),inset_0_0_30px_rgba(70,190,255,.12)]
        ${aberto ? "tablet-lab-entra" : ""}`}>
        {/* a barra do tablet: o que é, e guardar */}
        <div className="flex h-9 shrink-0 items-center justify-between px-3 text-[11px] text-sky-900/80 dark:text-cyan-100/80">
          <span className="flex items-center gap-2"><span aria-hidden className="h-2 w-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(56,140,255,.8)] dark:bg-cyan-300 dark:shadow-[0_0_8px_rgba(102,230,255,.9)]" />Tablet · Laboratório <span className="hidden text-sky-900/45 dark:text-white/40 sm:inline">— guarde quando quiser: o que estiver rodando continua</span></span>
          <button type="button" tabIndex={aberto ? 0 : -1} onClick={() => fechar.current()} className="min-h-[32px] rounded-full border border-sky-900/15 bg-sky-900/5 px-3 font-semibold text-sky-950/85 hover:bg-sky-900/10 dark:border-white/15 dark:bg-white/5 dark:text-white/85 dark:hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">Guardar tablet <span className="text-sky-900/40 dark:text-white/40">(Esc)</span></button>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[22px] bg-slate-50 dark:bg-black">
          {!carregou && <div className="absolute inset-0 flex items-center justify-center text-sm text-sky-900/60 dark:text-cyan-100/70"><span className="animate-pulse">Abrindo o laboratório…</span></div>}
          <iframe src={src} title="Laboratório" tabIndex={aberto ? 0 : -1} onLoad={() => setCarregou(true)} className={`h-full w-full border-0 transition-opacity duration-300 ${carregou ? "opacity-100" : "opacity-0"}`} allow="clipboard-read; clipboard-write; microphone; fullscreen" />
        </div>
      </div>
      <style>{`
        .tablet-lab-entra { animation: tablet-surge .45s cubic-bezier(.2,.9,.3,1.15) both; }
        @keyframes tablet-surge { 0% { opacity: 0; transform: translateY(28px) scale(.9); filter: blur(8px) brightness(1.8); } 100% { opacity: 1; transform: none; filter: none; } }
        @media (prefers-reduced-motion: reduce) { .tablet-lab-entra { animation: none; } }
      `}</style>
    </div>
  );
}
