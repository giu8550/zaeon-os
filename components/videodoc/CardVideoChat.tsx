"use client";
/**
 * CardVideoChat — o vídeo do documento pedido no chat (answer.videoDoc — lib/videodoc/chat-server): o card com o estado
 * da geração e o ▶ que abre o MESMO player da Sala de Estudos (slides + Zaeon holograma), por cima da tela.
 */
import dynamic from "next/dynamic";
import { useState } from "react";
import { createPortal } from "react-dom";
import { MOTIVO_ERRO, duracaoTexto, useVideoDoc } from "./useVideoDoc";

const PlayerVideoDoc = dynamic(() => import("./PlayerVideoDoc"), { ssr: false });

export default function CardVideoChat({ videoId, titulo }: { videoId?: string; titulo: string }) {
  const { video } = useVideoDoc(videoId);
  const [aberto, setAberto] = useState(false);
  if (!videoId) return null;
  const pronto = video?.status === "done", erro = video?.status === "error";
  return (
    <>
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-cyan-400/30 bg-[#0b2c4d]/90 px-3 py-2.5 text-sky-50 shadow-[0_0_18px_rgba(127,224,255,.12)]">
        <button type="button" disabled={!pronto} onClick={() => setAberto(true)} aria-label="Assistir o vídeo"
          className="grid h-11 w-11 flex-none place-items-center rounded-full border border-cyan-300/70 text-cyan-200 transition hover:bg-white/10 disabled:opacity-40">▶</button>
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-[0.18em] text-cyan-300/90">VÍDEO · ZAEON</div>
          <div className="truncate text-[13.5px] font-semibold">{titulo}</div>
          <div className={`text-[11.5px] ${erro ? "text-rose-300" : "text-sky-200/70"}`}>
            {pronto ? `a Zaeon explica · ${duracaoTexto(video!.duracao)}` : erro ? (MOTIVO_ERRO[video?.erro ?? ""] ?? "não deu pra gerar") : <><span className="animate-pulse">▮</span> a Zaeon está preparando o vídeo…</>}
          </div>
        </div>
      </div>
      {/* num portal no <body>: a bolha do chat tem transform/blur, que prende o `fixed` dentro dela */}
      {aberto && typeof document !== "undefined" && createPortal(<PlayerVideoDoc videoId={videoId} tela onFechar={() => setAberto(false)} />, document.body)}
    </>
  );
}
