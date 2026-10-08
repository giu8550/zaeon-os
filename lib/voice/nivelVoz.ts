"use client";

/**
 * lib/voice/nivelVoz.ts — mede o VOLUME de um áudio tocando (pra boca do avatar seguir a voz).
 *
 * Não desvia o som: analisa uma CÓPIA do sinal (`captureStream`) num AnalyserNode que não vai pros
 * alto-falantes — o <audio> continua tocando normal mesmo se o AudioContext estiver bloqueado.
 * Sem suporte (Safari não tem captureStream no <audio>) ou contexto suspenso → nível null (o avatar
 * fala com a boca sorteada). Usado pela saudação (falar.ts) e pela voz do app (ttsController).
 */

/**
 * Volume → abertura da boca, RELATIVO ao pico recente da própria voz (cada voz/clipe tem um
 * volume): vogal forte ≈ 1, entre sílabas ≈ 0 (a boca fecha).
 */
export function nivelDaBoca(rms: number, pico: number): number {
  const rel = rms / Math.max(pico, 0.05);
  return Math.max(0, Math.min(1, (rel - 0.3) / 0.55));
}

let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state !== "running") void ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}

/**
 * Começa a medir `audio` assim que ele tocar; `aoNivel` recebe 0..1 (~60x/s) ou null (sem medida).
 * Devolve `parar()` (chame no fim/erro/stop). Nunca lança.
 */
export function medirNivel(audio: HTMLAudioElement, aoNivel: (nivel: number | null) => void): () => void {
  let raf = 0;
  let parado = false;
  let fonte: MediaStreamAudioSourceNode | null = null;
  let pico = 0.05;

  const comecar = () => {
    if (parado) return;
    const c = contexto();
    const captura = (audio as HTMLAudioElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream });
    const pegar = captura.captureStream?.bind(audio) ?? captura.mozCaptureStream?.bind(audio);
    if (!c || !pegar) { aoNivel(null); return; }
    try {
      const stream = pegar();
      if (!stream.getAudioTracks().length) { aoNivel(null); return; }
      fonte = c.createMediaStreamSource(stream);
      const analisador = c.createAnalyser();
      analisador.fftSize = 512;
      fonte.connect(analisador); // NÃO conecta no destination: o som segue pelo <audio>
      const buf = new Uint8Array(analisador.fftSize);
      const medir = () => {
        if (parado) return;
        if (c.state !== "running") { aoNivel(null); raf = requestAnimationFrame(medir); return; }
        analisador.getByteTimeDomainData(buf);
        let soma = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; soma += v * v; }
        const rms = Math.sqrt(soma / buf.length);
        aoNivel(nivelDaBoca(rms, pico));
        pico = Math.max(rms, pico * 0.996, 0.05);
        raf = requestAnimationFrame(medir);
      };
      raf = requestAnimationFrame(medir);
    } catch { aoNivel(null); }
  };

  if (!audio.paused && audio.currentTime > 0) comecar();
  else audio.addEventListener("playing", comecar, { once: true });

  return () => {
    if (parado) return;
    parado = true;
    cancelAnimationFrame(raf);
    audio.removeEventListener("playing", comecar);
    try { fonte?.disconnect(); } catch { /* já solto */ }
    aoNivel(null);
  };
}
