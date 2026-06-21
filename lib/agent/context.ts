"use client";

/**
 * AgentContext (cliente) — o "world-state" do workspace, reativo e persistente.
 *
 * Espelha o doc do servidor (/api/agent/context). Hidrata do servidor no boot,
 * atualiza local na hora (latência zero, com espelho em sessionStorage) e faz
 * sync DEBOUNCED pro servidor. Quem consome usa o hook useAgentContext().
 *
 * É a camada durável que substitui o papel "de estado" do mission/handoff (que
 * seguem só pro fluxo efêmero de execução). Ver docs/AGENT_CONTEXT_AND_EXECUTION.md.
 */
import { useEffect, useState } from "react";

export type RecentAction = { kind: string; detail?: string; at: number };
export type AgentContext = {
  activeRoom?: string | null;
  activeTab?: string | null;
  currentStudyId?: string | null;
  currentResearchId?: string | null;
  currentProjectId?: string | null;
  currentGoal?: string | null;
  recentActions?: RecentAction[];
  updatedAt?: number | null;
};

const KEY = "zaeon:agent-context";
const EVT = "zaeon:agent-context";
const WRITABLE: (keyof AgentContext)[] = [
  "activeRoom",
  "activeTab",
  "currentStudyId",
  "currentResearchId",
  "currentProjectId",
  "currentGoal",
];

let ctx: AgentContext = {};
let loaded = false;
let hydrated = false;
let syncTimer: any = null;
const listeners = new Set<(c: AgentContext) => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const r = sessionStorage.getItem(KEY);
    if (r) ctx = JSON.parse(r) || {};
  } catch { /* ignore */ }
}

function emit() {
  try {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(KEY, JSON.stringify(ctx));
      window.dispatchEvent(new CustomEvent(EVT));
    }
  } catch { /* ignore */ }
  for (const l of listeners) l(ctx);
}

/** Lê o contexto atual (síncrono, do espelho local). */
export function getAgentContext(): AgentContext {
  load();
  return ctx;
}

/** Hidrata do servidor uma vez (no boot do app). */
export async function hydrateAgentContext(): Promise<void> {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const r = await fetch("/api/agent/context", { cache: "no-store" });
    if (r.ok) {
      const server = await r.json();
      // servidor é a verdade durável; mescla por cima do espelho local
      ctx = { ...ctx, ...server };
      emit();
    }
  } catch { /* offline/sem sessão → segue com o local */ }
}

function scheduleSync(action?: RecentAction) {
  if (typeof window === "undefined") return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    const payload: any = {};
    for (const k of WRITABLE) if (ctx[k] !== undefined) payload[k] = ctx[k] ?? null;
    if (action) payload.action = { kind: action.kind, detail: action.detail };
    fetch("/api/agent/context", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => { /* best-effort */ });
  }, 800);
}

/** Atualiza campos do contexto (merge) + agenda sync. */
export function setAgentContext(patch: Partial<AgentContext>) {
  load();
  ctx = { ...ctx, ...patch, updatedAt: Date.now() };
  emit();
  scheduleSync();
}

/** Registra uma ação recente (local + servidor) — mantém as últimas 15. */
export function pushAgentAction(kind: string, detail?: string) {
  load();
  const action: RecentAction = { kind, detail, at: Date.now() };
  const list = [...(ctx.recentActions || []), action].slice(-15);
  ctx = { ...ctx, recentActions: list, updatedAt: Date.now() };
  emit();
  scheduleSync(action);
}

/** Monta um bloco de texto enxuto do contexto, pronto pra injetar no prompt da IA. */
export function contextForPrompt(c: AgentContext = getAgentContext()): string {
  const bits: string[] = [];
  if (c.activeTab) bits.push(`Sala/aba atual: ${c.activeTab}`);
  if (c.currentGoal) bits.push(`Objetivo atual: ${c.currentGoal}`);
  if (c.currentStudyId) bits.push(`Estudo aberto: ${c.currentStudyId}`);
  if (c.currentResearchId) bits.push(`Pesquisa aberta: ${c.currentResearchId}`);
  if (c.currentProjectId) bits.push(`Projeto aberto: ${c.currentProjectId}`);
  const recent = (c.recentActions || []).slice(-5).map((a) => `${a.kind}${a.detail ? `(${a.detail})` : ""}`);
  if (recent.length) bits.push(`Ações recentes: ${recent.join(", ")}`);
  return bits.join("\n");
}

/** Hook reativo. */
export function useAgentContext(): AgentContext {
  const [c, setC] = useState<AgentContext>(getAgentContext());
  useEffect(() => {
    const h = () => setC({ ...getAgentContext() });
    listeners.add(setC);
    window.addEventListener(EVT, h);
    void hydrateAgentContext();
    return () => { listeners.delete(setC); window.removeEventListener(EVT, h); };
  }, []);
  return c;
}
