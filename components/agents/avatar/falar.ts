"use client";

/**
 * falar.ts — o avatar FALA com a voz de verdade: toca um clipe e a boca segue o volume
 * (lib/voice/nivelVoz.ts — mede uma cópia do sinal, sem desviar o som). Usado pela saudação e pelo
 * "ouvir saudação" do estúdio. A voz do app (ttsController) usa a mesma medição.
 * Um clipe por vez: começar outro (ou o TTS global) corta o anterior.
 */
import { stop as pararTTS } from "@/lib/voice/ttsController";
import { medirNivel } from "@/lib/voice/nivelVoz";

export { nivelDaBoca } from "@/lib/voice/nivelVoz";

let atual: { parar: () => void } | null = null;

export type Fala = { parar: () => void; fim: Promise<void> };

/**
 * Toca `url`. `aoMudar(falando, nivel)`: falando = o clipe está tocando; nivel = boca 0..1 medida
 * (null = sem medida → o avatar fala com a boca sorteada). No fim: (false, null).
 * `fim` rejeita se o navegador bloquear o autoplay.
 */
export function falarClipe(url: string, aoMudar: (falando: boolean, nivel: number | null) => void): Fala {
  atual?.parar();
  pararTTS();
  const audio = new Audio(url);
  let acabou = false;
  let resolver!: () => void;
  let rejeitar!: (e: unknown) => void;
  const fim = new Promise<void>((ok, falha) => { resolver = ok; rejeitar = falha; });
  const pararMedida = medirNivel(audio, (n) => { if (!acabou) aoMudar(true, n); });
  const encerrar = () => {
    if (acabou) return;
    acabou = true;
    pararMedida();
    audio.pause();
    aoMudar(false, null);
    if (atual === fala) atual = null;
    resolver();
  };
  const fala: Fala = { parar: encerrar, fim };
  atual = fala;

  audio.onplaying = () => { if (!acabou) aoMudar(true, null); };
  audio.onended = encerrar;
  audio.onerror = encerrar;
  audio.play().catch((e) => { acabou = true; pararMedida(); aoMudar(false, null); if (atual === fala) atual = null; rejeitar(e); });
  return fala;
}
