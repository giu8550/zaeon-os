"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { BoltIcon } from "@heroicons/react/24/outline";
import { LOUNGE_ROTA } from "@/lib/ui/loungeHub";
const CosmicLounge = dynamic(() => import("@/components/cyber/CosmicLounge"), { ssr: false, loading: () => <div className="h-full w-full bg-[#03030a]" /> });

/**
 * Landing do logado: só a VISTA do cyberespaço (sem menu, sem textos). "Conectar" entra no cyberespaço (tela cheia).
 */
export default function LoungeJanela() {
  const router = useRouter();

  return (
    <section
      aria-label="Cyberespaço"
      className="relative mt-10 self-start w-full max-w-3xl overflow-hidden rounded-2xl border border-cyan-500/25 bg-[#03030a] shadow-[0_0_60px_-20px_rgba(34,211,238,0.45)] aspect-[16/10] min-h-[260px]"
    >
      <div className="absolute inset-0"><CosmicLounge modo="janela" /></div>
      <button
        type="button"
        onClick={() => router.push(LOUNGE_ROTA)}
        className="absolute right-3 top-3 z-40 flex min-h-[44px] items-center gap-2 rounded-full border border-white/20 bg-black/55 px-4 text-xs font-medium uppercase tracking-[0.16em] text-white backdrop-blur transition hover:border-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
      >
        <BoltIcon className="h-4 w-4" aria-hidden="true" />
        Conectar
      </button>
    </section>
  );
}
