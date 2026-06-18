"use client";

/**
 * Modo de voz da Zaeon — duas personalidades:
 *
 *  - "passive": recebe o comando e EXECUTA com o mínimo de conversa. Breve e direto,
 *    aciona o agente certo sem rodeios. (default)
 *  - "active": pode conversar com leveza e personalidade sobre o assunto enquanto
 *    despacha os agentes para executar — sem narrar tarefas técnicas. Mais "falante".
 *
 * Persistido em localStorage + evento de sync (vale desktop e mobile).
 */
import { useCallback, useEffect, useState } from "react";

export type VoiceMode = "passive" | "active";
const KEY = "zaeon.voice.mode";
const EVT = "zaeon:voicemode";

export function getVoiceMode(): VoiceMode {
  if (typeof window === "undefined") return "passive";
  return (localStorage.getItem(KEY) as VoiceMode) || "passive";
}

export function setVoiceMode(m: VoiceMode) {
  try {
    localStorage.setItem(KEY, m);
    window.dispatchEvent(new CustomEvent(EVT, { detail: m }));
  } catch { /* ignore */ }
}

export function useVoiceMode(): [VoiceMode, (m: VoiceMode) => void] {
  const [mode, setMode] = useState<VoiceMode>("passive");
  useEffect(() => {
    setMode(getVoiceMode());
    const h = () => setMode(getVoiceMode());
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);
  const update = useCallback((m: VoiceMode) => { setVoiceMode(m); setMode(m); }, []);
  return [mode, update];
}

// Diretiva injetada no system prompt do agente conforme o modo.
export function voiceModeDirective(mode: VoiceMode): string {
  return mode === "active"
    ? `MODO VOZ ATIVO: você tem permissão para conversar com leveza, calor e personalidade sobre o assunto — comente brevemente, traga uma faísca de opinião ou curiosidade — e, AO MESMO TEMPO, acione o agente certo (use a ferramenta de convocação) para executar. NÃO narre tarefas técnicas ("estou abrindo", "vou pesquisar agora"); apenas converse com naturalidade enquanto age. Seja humana e concisa.`
    : `MODO VOZ PASSIVO: receba o comando e EXECUTE com o mínimo de conversa. Seja breve e direto, acione o agente certo (use a ferramenta de convocação) sem rodeios nem narração.`;
}
