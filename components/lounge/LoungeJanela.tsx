"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import CyberCta from "@/components/main/CyberCta";
import { EVENTO_ABRIR_LOGIN } from "@/components/sub/hero-content";
const CosmicLounge = dynamic(() => import("@/components/cyber/CosmicLounge"), { ssr: false, loading: () => <div className="h-full w-full bg-[#03030a]" /> });

/**
 * Landing: só a VISTA do cyberespaço (o avatar meditando no menu, sem textos). A entrada é o CyberCta (botão com a
 * barra da pré-carga), CENTRALIZADO em cima do módulo — ele libera quando a pré-carga acaba; deslogado, pede o login
 * do hero (EVENTO_ABRIR_LOGIN). A cena 3D só monta PERTO da tela (e desmonta longe): a landing pode ter mais de uma
 * janela e uma cena WebGL fora da vista é só custo.
 * `destaque` = o painel do Figma ("Um lugar para estudar junto", out/2026): a largura toda, panorâmico, o botão no
 * CENTRO e os anéis de luz roxo/rosa no pé — a mesma vista ao vivo dentro.
 */
export default function LoungeJanela({ className = "", destaque = false }: { className?: string; destaque?: boolean }) {
  const { status } = useSession();
  const ref = useRef<HTMLElement>(null);
  const [perto, setPerto] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || typeof IntersectionObserver === "undefined") { setPerto(true); return; }
    const io = new IntersectionObserver(([e]) => setPerto(!!e?.isIntersecting), { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      aria-label="Cyberespaço"
      className={destaque
        ? `relative mt-10 w-full ${className} overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#07061a] shadow-[0_30px_90px_-30px_rgba(139,92,246,0.55)] aspect-[16/10] md:aspect-[21/8] min-h-[300px]`
        : `relative mt-10 self-start w-full max-w-3xl ${className} overflow-hidden rounded-2xl border border-cyan-500/25 bg-[#03030a] shadow-[0_0_60px_-20px_rgba(34,211,238,0.45)] aspect-[16/10] min-h-[260px]`}
    >
      <div className="absolute inset-0">{perto ? <CosmicLounge modo="janela" /> : <div className="h-full w-full bg-[#03030a]" />}</div>
      {destaque && (
        // o palco do Figma: o brilho roxo no alto e os anéis (rosa por fora, ciano por dentro) no pé — por cima da vista, sem pegar clique
        <div aria-hidden className="pointer-events-none absolute inset-0 z-30">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(139,92,246,0.22),transparent_55%)]" />
          <div className="absolute bottom-[6%] left-1/2 h-[26%] w-[62%] -translate-x-1/2 rounded-[50%] border-2 border-fuchsia-400/60 shadow-[0_0_40px_rgba(236,72,153,0.45),inset_0_0_30px_rgba(236,72,153,0.25)]" />
          <div className="absolute bottom-[10%] left-1/2 h-[17%] w-[46%] -translate-x-1/2 rounded-[50%] border border-cyan-300/45" />
        </div>
      )}
      <div className={destaque ? "absolute left-1/2 top-1/2 z-40 w-[min(92%,300px)] -translate-x-1/2 -translate-y-1/2" : "absolute left-1/2 top-3 z-40 -translate-x-1/2 w-[min(92%,300px)]"}>
        <CyberCta logado={status === "authenticated"} onLogin={() => window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_LOGIN, { detail: { jogo: true } }))} className="!w-full bg-black/60 backdrop-blur" />
      </div>
    </section>
  );
}
