"use client";
/**
 * lib/lounge3d/pontos.ts — a PONTE chat → canvas (client-safe, localStorage).
 * A Sala de Pesquisa empurra "pontos importantes" (conceitos/próximos passos de uma resposta
 * estruturada) numa fila local; o Lounge 3D oferece "Puxar ponto do chat" → nota sugerida
 * (aceitar/editar/remover). É projeção opcional — a memória continua sendo o cérebro.
 */
import type { PontoDoChat } from "@/lib/lounge3d/sala";

export const CHAVE_PONTOS = "zaeon.lounge3d.pontos.v1";
export const MAX_PONTOS = 30;

export function lerPontos(a: Pick<Storage, "getItem"> | null = typeof localStorage !== "undefined" ? localStorage : null): PontoDoChat[] {
  try { const raw = a?.getItem(CHAVE_PONTOS); const p = raw ? JSON.parse(raw) : []; return Array.isArray(p) ? p.filter((x) => x && typeof x.texto === "string" && typeof x.id === "string") : []; } catch { return []; }
}

export function gravarPontos(ps: PontoDoChat[], a: Pick<Storage, "setItem"> | null = typeof localStorage !== "undefined" ? localStorage : null): void {
  try { a?.setItem(CHAVE_PONTOS, JSON.stringify(ps.slice(-MAX_PONTOS))); } catch { /* aba anônima */ }
}

/** Empurra pontos (dedupe por id), mantendo os mais recentes. Devolve a fila resultante. */
export function empurrarPontos(novos: PontoDoChat[], a: (Pick<Storage, "getItem"> & Pick<Storage, "setItem">) | null = typeof localStorage !== "undefined" ? localStorage : null): PontoDoChat[] {
  const atual = lerPontos(a);
  const ids = new Set(atual.map((p) => p.id));
  const fila = [...atual, ...novos.filter((p) => !ids.has(p.id))].slice(-MAX_PONTOS);
  gravarPontos(fila, a);
  return fila;
}

export function removerPonto(id: string, a: (Pick<Storage, "getItem"> & Pick<Storage, "setItem">) | null = typeof localStorage !== "undefined" ? localStorage : null): PontoDoChat[] {
  const fila = lerPontos(a).filter((p) => p.id !== id);
  gravarPontos(fila, a);
  return fila;
}

/** De uma resposta estruturada: conceitos e próximos passos viram pontos (até 4 por turno). */
export function pontosDaResposta(scopeId: string, msgId: string, a: { nucleo?: string; conceitos?: string[]; proximos_passos?: string[] }, ts = Date.now()): PontoDoChat[] {
  const out: PontoDoChat[] = [];
  const nucleo = (a.nucleo || "").replace(/\s+/g, " ").trim().slice(0, 240);
  for (const c of (a.conceitos ?? []).slice(0, 2)) { const t = (c || "").trim(); if (t) out.push({ id: `${msgId}:k:${out.length}`, scopeId, titulo: t, texto: nucleo || t, ts }); }
  for (const p of (a.proximos_passos ?? []).slice(0, 2)) { const t = (p || "").trim(); if (t) out.push({ id: `${msgId}:p:${out.length}`, scopeId, titulo: "Próximo passo", texto: t, ts }); }
  return out.slice(0, 4);
}
