"use client";

// Hook de voz — fala (TTS) e dá o status. STT já existe inline na research-lab; aqui
// focamos no TTS, que faltava. Respeita o modo dual (lib/runtime/mode):
//   - Vercel  → speechSynthesis do navegador (grátis, pt-BR, sem servidor)
//   - Container → POST /api/voice/tts (HQ; stub por ora, com fallback pro navegador)

import { useState, useEffect, useRef, useCallback } from "react";
import { capabilities } from "@/lib/runtime/mode";

interface UseVoiceOpts {
    lang?: string;
    rate?: number;
}

export function useVoice(opts: UseVoiceOpts = {}) {
    const lang = opts.lang || "pt-BR";
    const rate = opts.rate ?? 1.0;
    const [speaking, setSpeaking] = useState(false);
    const [supported, setSupported] = useState(false);
    const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // seleciona a melhor voz pt-BR disponível no aparelho
    useEffect(() => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
        setSupported(true);
        const pick = () => {
            const voices = window.speechSynthesis.getVoices();
            voiceRef.current =
                voices.find((v) => /pt.?BR/i.test(v.lang) && /google|luciana|natural|premium/i.test(v.name)) ||
                voices.find((v) => /pt.?BR/i.test(v.lang)) ||
                voices.find((v) => /^pt/i.test(v.lang)) ||
                null;
        };
        pick();
        window.speechSynthesis.onvoiceschanged = pick;
        return () => { try { window.speechSynthesis.onvoiceschanged = null; } catch {} };
    }, []);

    const speakBrowser = useCallback((text: string) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        if (voiceRef.current) u.voice = voiceRef.current;
        u.rate = rate;
        u.onstart = () => setSpeaking(true);
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(u);
    }, [lang, rate]);

    const speak = useCallback(async (text: string) => {
        if (!text?.trim()) return;
        const cap = capabilities();
        if (cap.voiceTts === "server") {
            // Modo container: TTS de alta qualidade. Stub — cai pro navegador se a API não existir.
            try {
                const r = await fetch("/api/voice/tts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text, lang }),
                });
                if (r.ok) {
                    const blob = new Blob([await r.arrayBuffer()], { type: "audio/mpeg" });
                    const audio = new Audio(URL.createObjectURL(blob));
                    audioRef.current = audio;
                    setSpeaking(true);
                    audio.onended = () => setSpeaking(false);
                    await audio.play();
                    return;
                }
            } catch { /* fallback abaixo */ }
        }
        speakBrowser(text);
    }, [lang, speakBrowser]);

    const stop = useCallback(() => {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        setSpeaking(false);
    }, []);

    return { speak, stop, speaking, supported };
}
