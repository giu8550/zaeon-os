"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BoltIcon } from "@heroicons/react/24/outline";
import { musica } from "@/lib/audio/musica";
import { LOUNGE_ROTA } from "@/lib/ui/loungeHub";
const CosmicLounge = dynamic(() => import("@/components/cyber/CosmicLounge"), { ssr: false, loading: () => <div className="h-full w-full bg-[#03030a]" /> });

/**
 * Landing: só a VISTA do cyberespaço (o avatar meditando no menu, sem textos). "Conectar" entra no cyberespaço (tela
 * cheia). A cena 3D só monta PERTO da tela (e desmonta longe): a landing pode ter mais de uma janela e uma cena
 * WebGL fora da vista é só custo.
 */
export default function LoungeJanela({ className = "" }: { className?: string }) {
  const router = useRouter();
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
      <button
        type="button"
        onClick={() => { musica().destravar(); router.push(LOUNGE_ROTA); }}   // o "Conectar" é o gesto que LIBERA o som (o cyberespaço já entra com áudio)
        className="absolute right-3 top-3 z-40 flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 bg-black/55 px-4 text-xs font-medium uppercase tracking-[0.16em] text-white backdrop-blur transition hover:border-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
      >
        <BoltIcon className="h-4 w-4" aria-hidden="true" />
        Conectar
      </button>
    </section>
  );
}
