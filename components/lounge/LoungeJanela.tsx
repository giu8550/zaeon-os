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
 */
export default function LoungeJanela({ className = "" }: { className?: string }) {
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
      className={`relative mt-10 self-start w-full max-w-3xl ${className} overflow-hidden rounded-2xl border border-cyan-500/25 bg-[#03030a] shadow-[0_0_60px_-20px_rgba(34,211,238,0.45)] aspect-[16/10] min-h-[260px]`}
    >
      <div className="absolute inset-0">{perto ? <CosmicLounge modo="janela" /> : <div className="h-full w-full bg-[#03030a]" />}</div>
      <div className="absolute left-1/2 top-3 z-40 -translate-x-1/2 w-[min(92%,300px)]">
        <CyberCta logado={status === "authenticated"} onLogin={() => window.dispatchEvent(new Event(EVENTO_ABRIR_LOGIN))} className="!w-full bg-black/60 backdrop-blur" />
      </div>
    </section>
  );
}
