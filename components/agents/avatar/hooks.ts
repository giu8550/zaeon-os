"use client";

/**
 * Hooks do avatar vivo: manifestos (1 fetch por página), ambiente (reduced-motion / celular),
 * vaga no orçamento de vida, visibilidade (lazy-load) e o "sorriso rápido ao concluir".
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { normalizarManifest, type AvatarManifest, type SinalAvatar } from "@/lib/avatars/estados";
import { criarOrcamento } from "@/lib/avatars/vida";
import { assinarPresenca, definirPresenca, lerPresenca, type Presenca } from "@/lib/avatars/presenca";

// ─── manifestos ─────────────────────────────────────────────────────────────

type Mapa = Record<string, AvatarManifest>;
let promessa: Promise<Mapa> | null = null;
let cache: Mapa | null = null;

function parseMapa(j: unknown): Mapa {
  const out: Mapa = {};
  const agentes = (j as { agentes?: Record<string, unknown> } | null)?.agentes;
  if (!agentes || typeof agentes !== "object") return out;
  for (const raw of Object.values(agentes)) {
    const m = normalizarManifest(raw);
    if (m) out[m.agentId] = m;
  }
  return out;
}

/** API (estáticos + gerados no admin) → se cair, o index estático. Nunca rejeita. */
export function carregarManifestos(): Promise<Mapa> {
  if (!promessa) {
    const pegar = (u: string) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
    promessa = pegar("/api/agents/avatars")
      .catch(() => pegar("/avatars/index.json"))
      .then(parseMapa)
      .catch(() => ({}))
      .then((m) => (cache = m));
  }
  return promessa;
}

/** Depois de salvar um avatar no admin: a próxima leitura busca de novo. */
export function invalidarManifestos(): void { promessa = null; cache = null; }

export function useManifesto(agentId: string | undefined | null): AvatarManifest | null {
  const id = agentId?.toLowerCase() ?? "";
  const [m, setM] = useState<AvatarManifest | null>(() => (id && cache?.[id]) || null);
  useEffect(() => {
    if (!id) { setM(null); return; }
    let vivo = true;
    void carregarManifestos().then((mapa) => { if (vivo) setM(mapa[id] ?? null); });
    return () => { vivo = false; };
  }, [id]);
  return m;
}

// ─── ambiente ───────────────────────────────────────────────────────────────

const Q_REDUZIDO = "(prefers-reduced-motion: reduce)";
const Q_LITE = "(max-width: 767px), (pointer: coarse)";

/** `reduzido` = prefers-reduced-motion; `lite` = celular/toque/economia de dados. SSR → ambos false. */
export function useAmbienteAvatar(): { reduzido: boolean; lite: boolean } {
  const [amb, setAmb] = useState({ reduzido: false, lite: false });
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const r = window.matchMedia(Q_REDUZIDO);
    const l = window.matchMedia(Q_LITE);
    const saveData = !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const sync = () => setAmb({ reduzido: r.matches, lite: l.matches || saveData });
    sync();
    r.addEventListener("change", sync);
    l.addEventListener("change", sync);
    return () => { r.removeEventListener("change", sync); l.removeEventListener("change", sync); };
  }, []);
  return amb;
}

// ─── orçamento de vida (singleton da página) ────────────────────────────────

const orcamento = criarOrcamento(2);
let seqId = 0;

/** Pede vaga com `prioridade` (0 = não pede). Devolve se ESTE avatar está vivo agora. */
export function useVaga(prioridade: number, lite: boolean): boolean {
  const idRef = useRef<string>("");
  if (!idRef.current) idRef.current = `av${++seqId}`;
  const [vivo, setVivo] = useState(false);
  useEffect(() => { orcamento.setMax(lite ? 1 : 2); }, [lite]);
  useEffect(() => {
    const id = idRef.current;
    if (prioridade <= 0) { orcamento.soltar(id); setVivo(false); return; }
    orcamento.pedir(id, prioridade, setVivo);
  }, [prioridade]);
  useEffect(() => () => orcamento.soltar(idRef.current), []);
  return vivo;
}

// ─── visibilidade ───────────────────────────────────────────────────────────

/** Entrou (ou está a 120px de entrar) na viewport. Sem IntersectionObserver → true. */
export function useNaTela(ref: RefObject<Element | null>): boolean {
  const [na, setNa] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setNa(true); return; }
    const io = new IntersectionObserver(([e]) => setNa(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return na;
}

// ─── sorriso ao concluir ────────────────────────────────────────────────────

export const SORRISO_MS = 1600;

/**
 * O consumidor só diz pensando/falando/idle; quando sai de pensando/falando direto pra idle
 * (= terminou bem), o avatar sorri por SORRISO_MS. Erro não sorri.
 */
export function useSinalComSorriso(sinal: SinalAvatar): SinalAvatar {
  const anterior = useRef<SinalAvatar>(sinal);
  const [sorrindo, setSorrindo] = useState(false);
  useEffect(() => {
    const antes = anterior.current;
    anterior.current = sinal;
    if (sinal === "idle" && (antes === "falando" || antes === "pensando")) {
      setSorrindo(true);
      const t = setTimeout(() => setSorrindo(false), SORRISO_MS);
      return () => clearTimeout(t);
    }
    setSorrindo(false);
  }, [sinal]);
  return sorrindo ? "feliz" : sinal;
}

// ─── presença (o rosto espelha o chat) ──────────────────────────────────────

const SEM_PRESENCA: Presenca = { sinal: "idle", boca: null };

/** Estado compartilhado do agente (lib/avatars/presenca.ts). Sem id → idle. */
export function usePresenca(agentId: string | null | undefined): Presenca {
  const id = agentId ?? "";
  const assinar = useCallback((f: () => void) => (id ? assinarPresenca(id, f) : () => {}), [id]);
  const ler = useCallback(() => (id ? lerPresenca(id) : SEM_PRESENCA), [id]);
  return useSyncExternalStore(assinar, ler, () => SEM_PRESENCA);
}

/**
 * O chat publica o que está fazendo; todos os rostos do agente seguem. Ao desmontar (saiu da
 * sala) volta pro idle — rosto nenhum fica "falando" sozinho.
 */
export function usePublicarPresenca(agentId: string, sinal: SinalAvatar): void {
  useEffect(() => { definirPresenca(agentId, { sinal }); }, [agentId, sinal]);
  useEffect(() => () => definirPresenca(agentId, { sinal: "idle", boca: null }), [agentId]);
}
