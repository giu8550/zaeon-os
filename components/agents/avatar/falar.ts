"use client";

/**
 * falar.ts — o avatar FALA com a voz de verdade: toca um clipe e mede o volume a cada frame
 * (Web Audio, AnalyserNode) → nível 0..1 da boca. Base do modo voz: qualquer áudio do agente
 * (saudação hoje; TTS das respostas depois) passa por aqui e a boca segue a voz.
 * Um clipe por vez: começar outro (ou o TTS global) corta o anterior.
 */
import { stop as pararTTS } from "@/lib/voice/ttsController";

let atual: { parar: () => void } | null = null;
let ctx: AudioContext | null = null;

export type Fala = { parar: () => void; fim: Promise<void> };

/**
 * Volume → abertura da boca, RELATIVO ao pico recente da própria voz (cada voz/clipe tem um
 * volume): vogal forte ≈ 1, entre sílabas ≈ 0 (a boca fecha). Escala fixa saturava (boca sempre
 * aberta) em voz alta e não abria em voz baixa.
 */
export function nivelDaBoca(rms: number, pico: number): number {
  const rel = rms / Math.max(pico, 0.05);
  return Math.max(0, Math.min(1, (rel - 0.3) / 0.55));
}

/** Toca `url`; `aoNivel` recebe o nível da boca (~60x/s) e null no fim. Rejeita se o navegador bloquear o autoplay. */
export function falarClipe(url: string, aoNivel: (nivel: number | null) => void): Fala {
  atual?.parar();
  pararTTS();
  const audio = new Audio(url);
  audio.crossOrigin = "anonymous";
  let raf = 0;
  let acabou = false;
  let resolver!: () => void;
  let rejeitar!: (e: unknown) => void;
  const fim = new Promise<void>((ok, falha) => { resolver = ok; rejeitar = falha; });
  const encerrar = () => {
    if (acabou) return;
    acabou = true;
    cancelAnimationFrame(raf);
    audio.pause();
    aoNivel(null);
    if (atual === fala) atual = null;
    resolver();
  };
  const fala: Fala = { parar: encerrar, fim };
  atual = fala;

  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new AC();
    const fonte = ctx.createMediaElementSource(audio);
    const analisador = ctx.createAnalyser();
    analisador.fftSize = 512;
    fonte.connect(analisador);
    analisador.connect(ctx.destination);
    const buf = new Uint8Array(analisador.fftSize);
    let pico = 0.05;
    const medir = () => {
      analisador.getByteTimeDomainData(buf);
      let soma = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; soma += v * v; }
      aoNivel(nivelDaBoca(Math.sqrt(soma / buf.length), pico));
      pico = Math.max(Math.sqrt(soma / buf.length), pico * 0.996, 0.05);
      raf = requestAnimationFrame(medir);
    };
    void ctx.resume().then(() => { raf = requestAnimationFrame(medir); });
  } catch { /* sem Web Audio: toca sem boca sincronizada */ }

  audio.onended = encerrar;
  audio.onerror = encerrar;
  audio.play().catch((e) => { acabou = true; aoNivel(null); if (atual === fala) atual = null; rejeitar(e); });
  return fala;
}
