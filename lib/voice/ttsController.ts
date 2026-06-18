"use client";

/**
 * Controlador GLOBAL de TTS (singleton) — um único áudio no app inteiro.
 *
 * Resolve o bug do "parar com delay / áudio dobrado": antes cada botão tinha o
 * seu próprio <audio> e a requisição ao engine não era cancelável. Agora:
 *  - speak() PARA qualquer fala anterior (e aborta a requisição em voo) antes de iniciar;
 *  - stop() aborta o fetch em andamento E pausa o áudio → resposta imediata, sem eco;
 *  - todos os botões compartilham o mesmo estado (quem está falando, e qual texto).
 *
 * Caminho neural: POST /api/ai/voice (Kokoro/Piper). Fallback: speechSynthesis do navegador.
 */
export type TTSState = { speaking: boolean; loading: boolean; text: string | null };

let audio: HTMLAudioElement | null = null;
let ctrl: AbortController | null = null;
let state: TTSState = { speaking: false, loading: false, text: null };
const listeners = new Set<(s: TTSState) => void>();

function emit() { for (const l of listeners) l(state); }
function set(p: Partial<TTSState>) { state = { ...state, ...p }; emit(); }

export function subscribe(cb: (s: TTSState) => void) {
  listeners.add(cb);
  cb(state);
  return () => { listeners.delete(cb); };
}
export function getTTSState(): TTSState { return state; }

function pref(key: string): string | undefined {
  try { return localStorage.getItem(key) || undefined; } catch { return undefined; }
}

function browserSpeak(text: string, gender: "f" | "m") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) { set({ speaking: false, loading: false, text: null }); return; }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = synth.getVoices();
  const pt = voices.filter((v) => /pt(-|_)?BR|portug/i.test(`${v.lang} ${v.name}`));
  const fem = /(maria|luciana|francisca|fernanda|female|mulher)/i;
  const masc = /(daniel|felipe|ricardo|male|homem)/i;
  const pick = pt.find((v) => (gender === "f" ? fem : masc).test(v.name)) || pt[0] || voices[0];
  if (pick) { u.voice = pick; u.lang = pick.lang || "pt-BR"; } else u.lang = "pt-BR";
  u.onend = () => set({ speaking: false, loading: false, text: null });
  u.onerror = () => set({ speaking: false, loading: false, text: null });
  synth.speak(u);
}

export function stop() {
  if (ctrl) { ctrl.abort(); ctrl = null; }
  if (audio) { audio.pause(); audio.src = ""; audio = null; }
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  set({ speaking: false, loading: false, text: null });
}

export async function speak(text: string, opts?: { voice?: string; gender?: "f" | "m" }) {
  const clean = (text || "").trim();
  if (!clean) return;
  stop(); // mata fala anterior + aborta requisição em voo (sem eco/double)

  const gender = (opts?.gender || (pref("zaeon.voice.gender") as "f" | "m") || "f");
  const voiceId = opts?.voice || pref("zaeon.voice.id");
  const myCtrl = new AbortController();
  ctrl = myCtrl;
  set({ speaking: true, loading: true, text: clean });

  try {
    const res = await fetch("/api/ai/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean.slice(0, 4000), voice: voiceId }),
      signal: myCtrl.signal,
    });
    if (myCtrl.signal.aborted) return; // parado durante o fetch → não toca nada
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (myCtrl.signal.aborted) return;
      if (data?.audio_base64) {
        const a = new Audio(`data:${data.mime || "audio/wav"};base64,${data.audio_base64}`);
        audio = a;
        a.onended = () => { if (audio === a) { audio = null; set({ speaking: false, loading: false, text: null }); } };
        a.onerror = () => { if (audio === a) { audio = null; browserSpeak(clean, gender); } };
        set({ loading: false });
        await a.play().catch(() => { if (audio === a) { audio = null; browserSpeak(clean, gender); } });
        return;
      }
    }
    set({ loading: false });
    browserSpeak(clean, gender); // engine offline/sem áudio → navegador
  } catch {
    if (myCtrl.signal.aborted) return; // foi um stop(), não um erro real
    set({ loading: false });
    browserSpeak(clean, gender);
  }
}
