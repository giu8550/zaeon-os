"use client";
/**
 * PlayerVideoDoc — o VÍDEO do documento tocando AO VIVO (pedido do dono: "o importante é assistir"; nada de MP4): à
 * esquerda o SLIDE (estética blueprint; os tópicos aparecem frase a frase; o DESTAQUE acende o tópico de que a Zaeon está
 * falando — o "cursor" do Paper2Video, sem modelo; legenda embaixo), à direita a ZAEON HOLOGRAMA com a boca pelo volume
 * da narração. Tudo sincronizado pelos tempos das frases (lib/videodoc/roteiro `posicaoNoVideo`).
 * Play/pausa (espaço), slide anterior/próximo (← →), legenda liga/desliga, Esc fecha.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { posicaoNoVideo } from "@/lib/videodoc/roteiro";
import { MOTIVO_ERRO, duracaoTexto, useVideoDoc } from "./useVideoDoc";

const HoloZaeonCena = dynamic(() => import("./HoloZaeonCena"), { ssr: false });
const CIANO = "#7fe0ff", AMARELO = "#ffd36b";

export default function PlayerVideoDoc({ videoId, onFechar, tela }: { videoId: string; onFechar: () => void; /** por cima da tela inteira (no chat) em vez de por cima da prancha */ tela?: boolean }) {
  const { video, falhou } = useVideoDoc(videoId);
  const audio = useRef<HTMLAudioElement>(null);
  const analisador = useRef<AnalyserNode | null>(null), dados = useRef<Uint8Array | null>(null);
  const [t, setT] = useState(0), [tocando, setTocando] = useState(false), [legenda, setLegenda] = useState(true);
  const pronto = video?.status === "done" && !!video.roteiro && !!video.tempos;
  const pos = useMemo(() => (pronto ? posicaoNoVideo(video!.roteiro!, video!.tempos!, t) : null), [pronto, video, t]);

  // o volume da voz → a boca do holograma (o AnalyserNode nasce no 1º play: o navegador exige um gesto)
  const ligarAnalisador = useCallback(() => {
    if (analisador.current || !audio.current) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx(), src = ctx.createMediaElementSource(audio.current), an = ctx.createAnalyser();
      an.fftSize = 512; src.connect(an); an.connect(ctx.destination);
      analisador.current = an; dados.current = new Uint8Array(an.fftSize);
    } catch { /* sem WebAudio: a boca cai no sorteio do holograma */ }
  }, []);
  const nivel = useCallback((): number | null => {
    const an = analisador.current, d = dados.current; if (!an || !d) return null;
    an.getByteTimeDomainData(d as Uint8Array<ArrayBuffer>);
    let s = 0; for (let i = 0; i < d.length; i++) { const v = (d[i]! - 128) / 128; s += v * v; }
    return Math.min(1, Math.sqrt(s / d.length) * 4.5);
  }, []);

  const tocar = useCallback(() => { const a = audio.current; if (!a) return; ligarAnalisador(); if (a.paused) void a.play(); else a.pause(); }, [ligarAnalisador]);
  const irSlide = useCallback((d: number) => {
    const a = audio.current; if (!a || !pos) return;
    const alvo = Math.max(0, Math.min(pos.inicioSlide.length - 1, pos.slide + d));
    a.currentTime = (pos.inicioSlide[alvo] ?? 0) + 0.01; setT(a.currentTime);
  }, [pos]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
      else if (e.key === " ") { e.preventDefault(); tocar(); }
      else if (e.key === "ArrowRight") irSlide(1);
      else if (e.key === "ArrowLeft") irSlide(-1);
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onFechar, tocar, irSlide]);

  const slide = pronto && pos ? video!.roteiro!.slides[pos.slide]! : null;
  const total = video?.duracao ?? 0;
  return (
    <div className={`${tela ? "fixed z-[1000]" : "absolute z-[120]"} inset-0 flex items-center justify-center bg-[#020c18]/80 p-3 backdrop-blur-sm md:p-6`} onPointerDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onFechar(); }}>
      <div className="relative flex h-full max-h-[720px] w-full max-w-[1180px] flex-col overflow-hidden rounded-[4px] border" style={{ borderColor: CIANO, background: "#0b2c4d", boxShadow: "0 0 40px rgba(127,224,255,.18)" }}>
        {/* o cabeçalho de prancha */}
        <div className="flex flex-none items-center gap-3 border-b px-4 py-2 font-mono text-[11px] tracking-[0.16em]" style={{ borderColor: "rgba(127,224,255,.3)", color: CIANO }}>
          <span>VÍDEO · ZAEON</span><span className="h-px flex-1" style={{ background: `${CIANO}55` }} />
          <span className="max-w-[50%] truncate normal-case tracking-normal text-sky-100/80">{video?.documento?.titulo ?? video?.titulo ?? ""}</span>
          <button type="button" onClick={onFechar} className="text-sky-100/70 hover:text-white" aria-label="Fechar">✕</button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* o SLIDE */}
          <div className="relative min-h-0 flex-1 p-6 md:p-10" style={{ backgroundImage: "linear-gradient(rgba(150,205,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(150,205,255,.1) 1px,transparent 1px)", backgroundSize: "40px 40px" }}>
            {!video && !falhou && <Aviso>carregando…</Aviso>}
            {falhou && <Aviso>não consegui abrir este vídeo</Aviso>}
            {video && (video.status === "queued" || video.status === "running") && <Aviso><span className="animate-pulse">▮</span> a Zaeon está preparando o vídeo deste documento — lendo, roteirizando e gravando a voz…</Aviso>}
            {video?.status === "error" && <Aviso>{MOTIVO_ERRO[video.erro ?? ""] ?? `não deu pra gerar: ${video.erro ?? "erro"}`}</Aviso>}
            {slide && pos && (
              <div className="flex h-full flex-col">
                <div className="font-mono text-[10px] tracking-[0.2em]" style={{ color: AMARELO }}>SLIDE {String(pos.slide + 1).padStart(2, "0")} / {String(video!.roteiro!.slides.length).padStart(2, "0")}</div>
                <h2 className="mt-2 font-mono text-[22px] font-semibold leading-tight md:text-[28px]" style={{ color: pos.alvo === "titulo" ? "#fff" : "#e8f6ff", textShadow: pos.alvo === "titulo" ? `0 0 18px ${CIANO}88` : undefined }}>{slide.titulo}</h2>
                <ul className="mt-6 space-y-3">
                  {slide.topicos.map((tp) => {
                    const aceso = pos.alvo === tp.id, visto = pos.revelados.has(tp.id);
                    return (
                      <li key={tp.id} className="flex items-start gap-3 rounded-[3px] border px-3 py-2 text-[15px] leading-snug transition-all duration-500 md:text-[17px]"
                        style={{ opacity: visto ? 1 : 0.18, borderColor: aceso ? CIANO : "transparent", background: aceso ? "rgba(127,224,255,.09)" : "transparent", boxShadow: aceso ? `0 0 16px ${CIANO}33` : undefined, color: "#e8f6ff" }}>
                        <span className="mt-1 font-mono text-[11px]" style={{ color: aceso ? CIANO : "rgba(186,230,253,.5)" }}>{aceso ? "▶" : "•"}</span><span>{tp.texto}</span>
                      </li>
                    );
                  })}
                </ul>
                {legenda && <div className="mt-auto rounded-[3px] bg-black/35 px-3 py-2 text-center text-[14px] text-sky-50/95">{pos.legenda}</div>}
              </div>
            )}
          </div>
          {/* a ZAEON holograma */}
          <div className="relative h-[220px] flex-none border-t md:h-auto md:w-[36%] md:border-l md:border-t-0" style={{ borderColor: "rgba(127,224,255,.25)", background: "radial-gradient(ellipse at 50% 70%, rgba(40,140,255,.18), transparent 70%)" }}>
            <HoloZaeonCena nivel={nivel} falando={tocando} />
          </div>
        </div>
        {/* os CONTROLES */}
        <div className="flex flex-none items-center gap-3 border-t px-4 py-2 font-mono text-[11px] text-sky-100" style={{ borderColor: "rgba(127,224,255,.3)" }}>
          <Botao onClick={() => irSlide(-1)} desab={!pronto} titulo="Slide anterior (←)">⏮</Botao>
          <Botao onClick={tocar} desab={!pronto} titulo="Tocar/pausar (espaço)">{tocando ? "❚❚ pausar" : "▶ assistir"}</Botao>
          <Botao onClick={() => irSlide(1)} desab={!pronto} titulo="Próximo slide (→)">⏭</Botao>
          <div className="relative h-1.5 flex-1 cursor-pointer overflow-hidden rounded bg-sky-950/70" onClick={(e) => { const a = audio.current; if (!a || !total) return; const r = e.currentTarget.getBoundingClientRect(); a.currentTime = ((e.clientX - r.left) / r.width) * total; setT(a.currentTime); }}>
            <div className="h-full" style={{ width: `${total ? (t / total) * 100 : 0}%`, background: `linear-gradient(90deg, ${CIANO}, #7dffb0)` }} />
            {pos?.inicioSlide.map((s, i) => <span key={i} className="absolute top-0 h-full w-px bg-white/30" style={{ left: `${total ? (s / total) * 100 : 0}%` }} />)}
          </div>
          <span className="w-20 text-right text-sky-200/70">{duracaoTexto(t || 0.001)} / {duracaoTexto(total)}</span>
          <Botao onClick={() => setLegenda((v) => !v)} titulo="Legenda">{legenda ? "CC ✓" : "CC"}</Botao>
        </div>
        {pronto && <audio ref={audio} src={`/api/videodoc/${videoId}/audio`} preload="auto" onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onPlay={() => setTocando(true)} onPause={() => setTocando(false)} onEnded={() => setTocando(false)} />}
      </div>
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center text-center font-mono text-[13px] leading-relaxed text-sky-100/75">{children}</div>;
}
function Botao({ children, onClick, desab, titulo }: { children: React.ReactNode; onClick: () => void; desab?: boolean; titulo?: string }) {
  return <button type="button" title={titulo} disabled={desab} onClick={onClick} className="rounded-sm border px-2 py-1 transition hover:bg-white/10 disabled:opacity-40" style={{ borderColor: `${CIANO}88`, color: CIANO }}>{children}</button>;
}
