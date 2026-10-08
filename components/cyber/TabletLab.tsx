"use client";
/**
 * TabletLab — o MODO ESTUDO por cima do cyberespaço: quando o tablet termina de se materializar nas mãos do avatar
 * (lib/cyber/descanso, components/cyber/AvatarLuz), o LABORATÓRIO abre aqui, numa moldura de tablet sobre a cena — o
 * cyberespaço continua vivo atrás (o avatar fica sentado/deitado/em pé estudando, e os outros veem). Fecha pelo botão,
 * pelo Esc (fora do lab) ou pelo "Voltar" do próprio lab (`?tablet=1` → postMessage MSG_FECHAR_TABLET).
 */
import { useEffect, useRef, useState } from "react";
import { LAB_TABLET, ehMsgFecharTablet } from "@/lib/ui/loungeHub";

export default function TabletLab({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [carregou, setCarregou] = useState(false);
  const fechar = useRef(onFechar); fechar.current = onFechar;
  useEffect(() => { if (!aberto) setCarregou(false); }, [aberto]);
  useEffect(() => {
    if (!aberto) return;
    const onMsg = (e: MessageEvent) => { if (ehMsgFecharTablet(e.data, e.origin, window.location.origin)) fechar.current(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); fechar.current(); } };
    window.addEventListener("message", onMsg); window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("message", onMsg); window.removeEventListener("keydown", onKey); };
  }, [aberto]);
  if (!aberto) return null;
  return (
    <div className="absolute inset-0 z-[40] flex items-center justify-center bg-[#02040c]/35 p-3 backdrop-blur-[1.5px] sm:p-6" role="dialog" aria-modal="true" aria-label="Laboratório no tablet">
      <div className="tablet-lab relative flex h-full max-h-[920px] w-full max-w-[1320px] flex-col overflow-hidden rounded-[30px] border border-cyan-300/45 bg-[#050a18] p-2 shadow-[0_0_0_1px_rgba(102,230,255,.12),0_0_60px_rgba(70,190,255,.35),inset_0_0_30px_rgba(70,190,255,.12)]">
        {/* a barra do tablet: câmera, o que é, e guardar */}
        <div className="flex h-9 shrink-0 items-center justify-between px-3 text-[11px] text-cyan-100/80">
          <span className="flex items-center gap-2"><span aria-hidden className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(102,230,255,.9)]" />Tablet · Laboratório <span className="hidden text-white/40 sm:inline">— o seu avatar continua no cyberespaço</span></span>
          <button type="button" onClick={() => fechar.current()} className="min-h-[32px] rounded-full border border-white/15 bg-white/5 px-3 font-semibold text-white/85 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">Guardar tablet <span className="text-white/40">(Esc)</span></button>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[22px] bg-black">
          {!carregou && <div className="absolute inset-0 flex items-center justify-center text-sm text-cyan-100/70"><span className="animate-pulse">Abrindo o laboratório…</span></div>}
          <iframe src={LAB_TABLET} title="Laboratório" onLoad={() => setCarregou(true)} className={`h-full w-full border-0 transition-opacity duration-300 ${carregou ? "opacity-100" : "opacity-0"}`} allow="clipboard-read; clipboard-write; microphone; fullscreen" />
        </div>
      </div>
      <style>{`
        .tablet-lab { animation: tablet-surge .45s cubic-bezier(.2,.9,.3,1.15) both; }
        @keyframes tablet-surge { 0% { opacity: 0; transform: translateY(28px) scale(.9); filter: blur(8px) brightness(1.8); } 100% { opacity: 1; transform: none; filter: none; } }
        @media (prefers-reduced-motion: reduce) { .tablet-lab { animation: none; } }
      `}</style>
    </div>
  );
}
