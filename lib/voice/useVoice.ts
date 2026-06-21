"use client";

// Hook de voz (TTS) — SEMPRE a voz premium (engine HQ via /api/ai/voice).
// A "voz do Google" (speechSynthesis do navegador) foi removida de vez: se o engine
// estiver indisponível, fica em silêncio em vez de cair numa voz robótica.

import { useState, useEffect, useRef, useCallback } from "react";

interface UseVoiceOpts {
    lang?: string;
    rate?: number;
}

export function useVoice(_opts: UseVoiceOpts = {}) {
    const [speaking, setSpeaking] = useState(false);
    const [supported, setSupported] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => { setSupported(true); }, []);

    const speak = useCallback(async (text: string) => {
        if (!text?.trim()) return;
        try {
            const voiceId = (() => { try { return localStorage.getItem("zaeon.voice.id") || undefined; } catch { return undefined; } })();
            const r = await fetch("/api/ai/voice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: text.slice(0, 4000), voice: voiceId }),
            });
            if (r.ok) {
                const data = await r.json().catch(() => null);
                if (data?.audio_base64) {
                    audioRef.current?.pause();
                    const audio = new Audio(`data:${data.mime || "audio/wav"};base64,${data.audio_base64}`);
                    audioRef.current = audio;
                    setSpeaking(true);
                    audio.onended = () => setSpeaking(false);
                    audio.onerror = () => setSpeaking(false);
                    await audio.play().catch(() => setSpeaking(false));
                    return;
                }
            }
        } catch { /* engine indisponível → silêncio (sem voz do navegador) */ }
        setSpeaking(false);
    }, []);

    const stop = useCallback(() => {
        try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        setSpeaking(false);
    }, []);

    return { speak, stop, speaking, supported };
}
