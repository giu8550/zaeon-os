// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

// voz do app simulada (o ttsController de verdade toca <audio>)
const tts = vi.hoisted(() => {
  let estado = { speaking: false, loading: false, text: null as string | null };
  let nivel: number | null = null;
  const ouvE = new Set<(s: typeof estado) => void>();
  const ouvN = new Set<() => void>();
  return {
    subscribe: (cb: (s: typeof estado) => void) => { ouvE.add(cb); cb(estado); return () => ouvE.delete(cb); },
    getTTSState: () => estado,
    subscribeNivel: (cb: () => void) => { ouvN.add(cb); return () => ouvN.delete(cb); },
    getNivel: () => nivel,
    mudar(e: Partial<typeof estado>, n?: number | null) { estado = { ...estado, ...e }; if (n !== undefined) nivel = n; ouvE.forEach((f) => f(estado)); ouvN.forEach((f) => f()); },
  };
});
vi.mock("@/lib/voice/ttsController", () => tts);

import { usePublicarPresenca } from "./hooks";
import { lerPresenca } from "@/lib/avatars/presenca";

afterEach(() => { cleanup(); act(() => tts.mudar({ speaking: false, loading: false }, null)); });

describe("modo voz · o rosto fala com a voz do app", () => {
  it("voz tocando → falando com a boca do volume; carregando não conta; parou → volta pro chat", () => {
    const { result } = renderHook(() => usePublicarPresenca("aura", "idle"));
    expect(result.current).toEqual({ sinal: "idle", boca: null });

    act(() => tts.mudar({ speaking: true, loading: true }));        // sintetizando
    expect(result.current.sinal).toBe("idle");

    act(() => tts.mudar({ speaking: true, loading: false }, 0.8));  // tocando, boca aberta
    expect(result.current).toEqual({ sinal: "falando", boca: 0.8 });
    expect(lerPresenca("aura")).toEqual({ sinal: "falando", boca: 0.8 }); // a bolinha da aba também

    act(() => tts.mudar({}, 0));                                     // entre sílabas
    expect(result.current.boca).toBe(0);

    act(() => tts.mudar({ speaking: false }, null));                 // acabou
    expect(result.current).toEqual({ sinal: "idle", boca: null });
    expect(lerPresenca("aura").sinal).toBe("idle");
  });
});
