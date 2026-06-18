"use client";

/**
 * useSTT — ditado por voz (fala → texto), com degradação graciosa.
 *
 * Hoje: Web Speech API do navegador (SpeechRecognition / webkitSpeechRecognition).
 * Futuro (premium/VPS): faster-whisper via /api/ai/stt (mesma interface deste hook).
 *
 * Uso:
 *   const { toggle, listening, supported } = useSTT({ onResult: (t, final) => setText(t) });
 */
import { useCallback, useRef, useState } from "react";

type Opts = { lang?: string; continuous?: boolean; onResult?: (text: string, final: boolean) => void };

export function useSTT(opts?: Opts) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const optsRef = useRef<Opts | undefined>(opts);
  optsRef.current = opts;

  const supported = typeof window !== "undefined"
    && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    try { recRef.current?.stop(); } catch { /* ignore */ }
    const rec = new SR();
    rec.lang = optsRef.current?.lang || "pt-BR";
    rec.continuous = !!optsRef.current?.continuous;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let txt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      const final = !!e.results[e.results.length - 1]?.isFinal;
      optsRef.current?.onResult?.(txt.trim(), final);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  }, []);

  const toggle = useCallback(() => { listening ? stop() : start(); }, [listening, start, stop]);

  return { start, stop, toggle, listening, supported };
}

export default useSTT;
