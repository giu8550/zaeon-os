"use client";

/**
 * Handoff de execução entre a Zaeon (chat/voz) e as salas.
 *
 * Quando a Zaeon "convoca um agente" (summon), ela guarda aqui {skill, topic},
 * navega para a sala certa, e a sala — ao montar — CONSOME o handoff e EXECUTA
 * de verdade (ex.: roda a pesquisa, escreve o estudo). Sem isso, a navegação
 * acontecia mas nada era executado.
 *
 * Usa sessionStorage (sobrevive à navegação) + expira em 2 min.
 */
export type Handoff = { skill: string; topic: string; ts: number };
const KEY = "zaeon:handoff";

export function setHandoff(skill: string, topic: string) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ skill, topic, ts: Date.now() })); } catch { /* ignore */ }
}

/** Pega e LIMPA o handoff se a skill bater e ainda estiver fresco. */
export function takeHandoff(skills: string[]): Handoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Handoff;
    if (!d?.topic || !d?.skill) return null;
    if (Date.now() - d.ts > 120000) { sessionStorage.removeItem(KEY); return null; }
    if (!skills.includes(d.skill)) return null; // não é pra esta sala
    sessionStorage.removeItem(KEY); // consome uma vez só
    return d;
  } catch { return null; }
}
