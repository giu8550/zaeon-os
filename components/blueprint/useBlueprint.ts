"use client";
/**
 * useBlueprint — os dados da Sala de Estudos como BLUEPRINT (lib/blueprint): a lista pro seletor do topo e o blueprint
 * aberto. A Zaeon recompõe no servidor a cada turno do chat, então relemos ao voltar pra aba e a cada 20 s com a página
 * visível (o chat e a sala são abas da mesma tela). Arrastar e "reorganizar" são otimistas (PATCH em seguida).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { BlueprintView, ResumoBlueprint } from "@/lib/blueprint/server";
import type { Avaliacao, DocBlueprint } from "@/lib/blueprint/tipos";

export type BlueprintCliente = Omit<BlueprintView, "updatedAt"> & { updatedAt: string };
const RELER_MS = 20_000;

async function json<T>(url: string, init?: RequestInit): Promise<T | null> {
  try { const r = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } }); return r.ok ? ((await r.json()) as T) : null; } catch { return null; }
}

export function useBlueprint(inicialId?: string | null) {
  const [lista, setLista] = useState<ResumoBlueprint[] | null>(null);
  const [atual, setAtual] = useState<BlueprintCliente | null>(null);
  const [recompondo, setRecompondo] = useState(false);
  const idAtual = useRef<string | null>(inicialId ?? null);
  const ocupado = useRef<Record<string, number>>({});   // escritas em voo POR blueprint: não sobrescreve o otimista com uma leitura velha
  const emVoo = (id: string) => (ocupado.current[id] ?? 0) > 0;
  const voo = (id: string, d: number) => { ocupado.current[id] = (ocupado.current[id] ?? 0) + d; };

  const abrir = useCallback(async (id: string) => {
    idAtual.current = id;
    const r = await json<{ blueprint: BlueprintCliente }>(`/api/blueprint/${id}`);
    if (r?.blueprint && idAtual.current === id && !emVoo(id)) setAtual(r.blueprint);
  }, []);

  const recarregar = useCallback(async () => {
    const r = await json<{ blueprints: ResumoBlueprint[] }>("/api/blueprint");
    if (!r) { setLista((l) => l ?? []); return; }
    setLista(r.blueprints);
    const alvo = idAtual.current && r.blueprints.some((b) => b.id === idAtual.current) ? idAtual.current : r.blueprints[0]?.id;
    if (alvo) await abrir(alvo); else setAtual(null);
  }, [abrir]);

  useEffect(() => {
    void recarregar();
    const t = setInterval(() => { if (document.visibilityState === "visible") void recarregar(); }, RELER_MS);
    const vis = () => { if (document.visibilityState === "visible") void recarregar(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [recarregar]);

  const patch = useCallback(async (corpo: unknown, otimista: (d: DocBlueprint) => DocBlueprint) => {
    const id = idAtual.current; if (!id) return;
    setAtual((a) => (a && a.id === id ? { ...a, doc: otimista(a.doc) } : a));
    voo(id, 1);
    const r = await json<{ blueprint: BlueprintCliente }>(`/api/blueprint/${id}`, { method: "PATCH", body: JSON.stringify(corpo) });
    voo(id, -1);
    // com outra escrita ainda em voo, a resposta desta é velha pra ela: mantém o otimista
    if (r?.blueprint && idAtual.current === id && !emVoo(id)) setAtual(r.blueprint);
  }, []);

  const fixar = useCallback((modulo: string, x: number, y: number) =>
    patch({ fixos: { set: { [modulo]: { x: Math.round(x), y: Math.round(y) } } } }, (d) => ({ ...d, fixos: { ...d.fixos, [modulo]: { x: Math.round(x), y: Math.round(y) } } })), [patch]);
  const reorganizar = useCallback(() => patch({ reorganizar: true }, (d) => ({ ...d, fixos: {} })), [patch]);

  const recompor = useCallback(async () => {
    const a = atual; if (!a || recompondo) return;
    setRecompondo(true);
    const r = await json<{ blueprint: BlueprintCliente | null }>(`/api/blueprint/${a.id}/recompor`, { method: "POST" });
    setRecompondo(false);
    if (r?.blueprint && idAtual.current === a.id) setAtual(r.blueprint);
  }, [atual, recompondo]);

  /** a PROVA de um crítico: o servidor confere; a última da fase dispara a avaliação da Zaeon. Devolve o motivo da recusa.
   *  Sem crítico (null) = "pedir a avaliação de novo" (a anterior falhou) */
  const enviarProva = useCallback(async (criticoId: string | null, url: string): Promise<{ ok: boolean; motivo?: string; avaliacao?: Avaliacao | null }> => {
    const a = atual; if (!a) return { ok: false };
    voo(a.id, 1);
    const corpo = criticoId ? { criticoId, url } : { reavaliar: true };
    const r = await json<{ ok: boolean; motivo?: string; blueprint: BlueprintCliente | null; avaliacao: Avaliacao | null }>(`/api/blueprint/${a.id}/prova`, { method: "POST", body: JSON.stringify(corpo) });
    voo(a.id, -1);
    if (!r) return { ok: false, motivo: "não deu pra enviar agora — tente de novo" };
    if (r.blueprint && idAtual.current === a.id) setAtual(r.blueprint);
    if (r.ok) void recarregar();
    return { ok: r.ok, motivo: r.motivo, avaliacao: r.avaliacao };
  }, [atual, recarregar]);

  return { lista, atual, abrir, recarregar, fixar, reorganizar, recompor, recompondo, enviarProva, setAtual };
}
