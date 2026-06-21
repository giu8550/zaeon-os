"use client";

/**
 * "Missão" da Zaeon — o que ela está EXECUTANDO agora (handoff p/ uma sala).
 *
 * É o coração do widget reativo: quando a Zaeon despacha um agente (pesquisar,
 * estudar, escrever, programar), abrimos uma missão "running"; a sala-alvo executa
 * e marca "done". O widget reflete isso (cartão de missão + glow ambiente) de
 * qualquer página, porque é um store global.
 *
 * Transporte HOJE: store em memória + sessionStorage (sobrevive à navegação SPA e
 * a reload por ~10min) + evento de sync. Na VPS, dá pra trocar o transporte por
 * Socket.IO/VoiceJob (progresso real do servidor) SEM mudar quem consome este hook.
 */
import { useEffect, useState } from "react";

export type MissionStatus = "running" | "done" | "error";
export type Mission = { id: string; skill: string; topic: string; route?: string; status: MissionStatus; startedAt: number } | null;

const KEY = "zaeon:mission";
const EVT = "zaeon:mission";
let mission: Mission = null;
let loaded = false;
const listeners = new Set<(m: Mission) => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const r = sessionStorage.getItem(KEY);
    if (r) { const m = JSON.parse(r); if (m && Date.now() - m.startedAt < 600000) mission = m; }
  } catch { /* ignore */ }
}

function emit() {
  try {
    if (typeof window !== "undefined") {
      if (mission) sessionStorage.setItem(KEY, JSON.stringify(mission));
      else sessionStorage.removeItem(KEY);
      window.dispatchEvent(new CustomEvent(EVT));
    }
  } catch { /* ignore */ }
  for (const l of listeners) l(mission);
}

export function getMission(): Mission { load(); return mission; }

export function startMission(skill: string, topic: string, route?: string) {
  mission = { id: String(Date.now()), skill, topic, route, status: "running", startedAt: Date.now() };
  emit();
}

export function missionDone(status: MissionStatus = "done") {
  if (!mission) return;
  mission = { ...mission, status };
  emit();
  const id = mission.id;
  setTimeout(() => { if (mission && mission.id === id) { mission = null; emit(); } }, 6000); // some sozinho após avisar
}

export function clearMission() { mission = null; emit(); }

export function useMission(): Mission {
  const [m, setM] = useState<Mission>(getMission());
  useEffect(() => {
    const h = () => setM(getMission());
    listeners.add(setM);
    window.addEventListener(EVT, h);
    return () => { listeners.delete(setM); window.removeEventListener(EVT, h); };
  }, []);
  return m;
}
