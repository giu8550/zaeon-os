"use client";

/**
 * useTTS — hook fino sobre o controlador GLOBAL de voz (lib/voice/ttsController).
 *
 * Por que global: garante UM único áudio no app inteiro e que "parar" cancele
 * na hora (inclusive a requisição em voo). Sem isso dava delay e áudio dobrado.
 *
 * Retorna: speak, stop, speaking (algo tocando), loading, activeText (qual texto).
 */
import { useEffect, useState } from "react";
import { speak, stop, subscribe, getTTSState, type TTSState } from "./ttsController";

export function useTTS() {
  const [s, setS] = useState<TTSState>(getTTSState());
  useEffect(() => subscribe(setS), []);
  return { speak, stop, speaking: s.speaking, loading: s.loading, activeText: s.text };
}

export default useTTS;
