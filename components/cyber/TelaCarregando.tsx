"use client";
/**
 * TelaCarregando — o loading do cyberespaço: uma PANORÂMICA do próprio cyberespaço ao fundo (fotos tiradas no mundo:
 * a mandala do lounge, o olho com os sigilos, a tempestade no templo…), escurecida e num zoom lento, com o cérebro azul
 * e a barra clássica por cima (components/ui/CerebroCarregando). A barra segue o progresso REAL das etapas do engine
 * (lib/cyber/carregamento); fica por cima até o mundo inteiro estar pronto e sai com um fade.
 */
import { useEffect, useState } from "react";
import CerebroCarregando from "@/components/ui/CerebroCarregando";
import type { Carregando } from "@/lib/cyber/carregamento";

/** as panorâmicas (public/assets/cyber/loading, 1920×1080): uma sorteada a cada entrada */
export const PANORAMAS = ["mandala-serpentes", "merkaba", "olho-sigilos", "templo-tempestade", "lounge-de-baixo", "olho-zaeon", "dj-fitas"] as const;
export const urlDaPanoramica = (nome: (typeof PANORAMAS)[number]) => `/assets/cyber/loading/${nome}.jpg`;

export default function TelaCarregando({ carga, saindo = false }: { carga: Carregando | null; saindo?: boolean }) {
  const [foto, setFoto] = useState<string | null>(null);   // (sorteada só no cliente: sem diferença de hidratação)
  useEffect(() => { setFoto(urlDaPanoramica(PANORAMAS[Math.floor(Math.random() * PANORAMAS.length)]!)); }, []);
  return (
    <CerebroCarregando progresso={carga?.progresso ?? 0} saindo={saindo}>
      {foto && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto} alt="" className="h-full w-full animate-[pano-zoom_28s_ease-out_both] object-cover opacity-0 motion-reduce:animate-none motion-reduce:opacity-60" draggable={false} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,.35)_0%,rgba(0,0,0,.72)_70%,#000_100%)]" />
          <style>{`@keyframes pano-zoom { 0% { opacity: 0; transform: scale(1.04) } 12% { opacity: .75 } 100% { opacity: .75; transform: scale(1.16) } }`}</style>
        </div>
      )}
    </CerebroCarregando>
  );
}
