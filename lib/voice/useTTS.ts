"use client";

/**
 * useTTS — leitura em voz alta da Zaeon, com degradação graciosa.
 *
 * Caminho premium: POST /api/ai/voice (engine na VPS: Kokoro/Piper) → toca o WAV.
 * Caminho free / fallback: speechSynthesis nativo do navegador (Web Speech API).
 *
 * O hook NÃO decide gating sozinho — ele tenta o engine; se vier 401/403/503 (sem
 * acesso ou engine offline), cai na voz do navegador. Assim a Pesquisa já "fala"
 * hoje, e quando o engine subir na VPS a voz fica neural sem trocar a UI.
 *
 * Preferência de voz/gênero persistida em localStorage (zaeon.voice.*).
 */
import { useCallback, useEffect, useRef, useState } from "react";

type Gender = "f" | "m";

const PREF_VOICE = "zaeon.voice.id";
const PREF_GENDER = "zaeon.voice.gender";

export function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; audioRef.current = null; }
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    } catch { /* ignore */ }
    setSpeaking(false);
  }, []);

  // Voz do navegador (fallback): tenta uma voz pt-BR do gênero preferido.
  const speakBrowser = useCallback((text: string, gender: Gender) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const pt = voices.filter((v) => /pt(-|_)?BR|português|portugues/i.test(`${v.lang} ${v.name}`));
    const femaleHint = /(maria|luciana|francisca|fernanda|female|mulher|f\b)/i;
    const maleHint = /(daniel|felipe|ricardo|male|homem|m\b)/i;
    const pick = pt.find((v) => (gender === "f" ? femaleHint : maleHint).test(v.name)) || pt[0] || voices[0];
    if (pick) u.voice = pick;
    u.lang = pick?.lang || "pt-BR";
    u.rate = 1.0; u.pitch = 1.0;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
    return true;
  }, []);

  const speak = useCallback(async (text: string, opts?: { voice?: string; gender?: Gender }) => {
    const clean = (text || "").trim();
    if (!clean) return;
    stop();
    const gender: Gender = opts?.gender
      || ((typeof window !== "undefined" && (localStorage.getItem(PREF_GENDER) as Gender)) || "f");
    const voiceId = opts?.voice
      || (typeof window !== "undefined" ? localStorage.getItem(PREF_VOICE) || undefined : undefined);

    // 1) tenta o engine neural (premium / VPS)
    try {
      const res = await fetch("/api/ai/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean.slice(0, 4000), voice: voiceId }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.audio_base64) {
          const audio = new Audio(`data:${data.mime || "audio/wav"};base64,${data.audio_base64}`);
          audioRef.current = audio;
          audio.onended = () => setSpeaking(false);
          audio.onerror = () => { setSpeaking(false); speakBrowser(clean, gender); };
          setSpeaking(true);
          await audio.play().catch(() => { setSpeaking(false); speakBrowser(clean, gender); });
          return;
        }
      }
    } catch { /* engine offline → fallback */ }

    // 2) fallback: voz do navegador
    speakBrowser(clean, gender);
  }, [stop, speakBrowser]);

  useEffect(() => () => stop(), [stop]);

  return { speak, stop, speaking };
}

export default useTTS;
