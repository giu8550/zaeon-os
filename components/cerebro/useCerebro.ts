"use client";
/**
 * useCerebro — o cérebro da CONVERSA ATIVA (scopeId) no cliente (HANDOFF_CEREBRO_AURA §3).
 *   - GET /api/map?scopeId= → mapa + estado da bolinha;
 *   - Pusher `private-cerebro-<mapaId>` (turno/gerado/erro) → refetch ao vivo;
 *   - fallback: poll leve (3s) enquanto gera, ou enquanto o painel está aberto sem Pusher;
 *   - gerar() → POST /api/map/generate (estado "gerando" até o evento/poll trazer o backbone).
 * Trocar de conversa = outro scopeId = outro grafo (mesmo hook).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type PusherClient from "pusher-js";
import { estadoDaBolinha, type EstadoBolinha } from "@/lib/map/bolinha";
import { mensagemDeErro } from "@/lib/canal/conexao";
import { canalCerebro, EV_ERRO, EV_GERADO, EV_TURNO } from "@/lib/map/realtime";
import type { MapaView } from "@/lib/map/tipos";

export const mapPanelOn = (): boolean => process.env.NEXT_PUBLIC_MAP_HARNESS === "1";

export type MapaCliente = Omit<MapaView, "updatedAt"> & { updatedAt: string };
export type CerebroState = {
  mapa: MapaCliente | null;
  estado: EstadoBolinha;
  tituloSugerido: string | null;
  gerando: boolean;
  erro: string | null;
  /** ids que acenderam no último evento (o painel pisca neles). */
  recentes: string[];
};

const POLL_MS = 3000;
/** #661: refazer sem resposta depois disso (sem Pusher, ou o servidor caiu no meio) = falhou, e o mapa atual volta. */
const REFAZER_MAX_MS = 90_000;

export function useCerebro(scopeId: string | null, opts: { aberto?: boolean } = {}) {
  const [st, setSt] = useState<CerebroState>({ mapa: null, estado: "oculta", tituloSugerido: null, gerando: false, erro: null, recentes: [] });
  const gerandoRef = useRef(false);
  const pusherRef = useRef<PusherClient | null>(null);
  const canalRef = useRef<string | null>(null);
  const on = mapPanelOn();
  // #661: refazendo = o mapa antigo ainda tem percurso, então "tem backbone" não diz que acabou; acaba quando o
  // updatedAt mudar (ou no evento). Guarda o updatedAt de quando o refazer começou.
  const refazendoRef = useRef<string | null>(null);
  const timerRefazer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // o aviso de que o refazer falhou sobrevive aos refetchs (o poll o apagaria em 3 s), até a próxima tentativa
  const avisoRefazer = useRef<string | null>(null);
  const fimRefazer = useCallback(() => {
    refazendoRef.current = null;
    if (timerRefazer.current) clearTimeout(timerRefazer.current);
    timerRefazer.current = null;
  }, []);

  const refetch = useCallback(async (recentes: string[] = []) => {
    if (!on || !scopeId) return;
    try {
      const r = await fetch(`/api/map?scopeId=${encodeURIComponent(scopeId)}`, { cache: "no-store" });
      if (!r.ok) { setSt((s) => ({ ...s, erro: r.status === 404 ? null : `HTTP ${r.status}` })); return; }
      const d = await r.json();
      const mapa: MapaCliente | null = d.mapa ?? null;
      if (mapa?.backbone?.length && mapa.updatedAt !== refazendoRef.current) { gerandoRef.current = false; fimRefazer(); }
      const estado = estadoDaBolinha({ estudavel: !!d.estudavel, mapaId: mapa?.id ?? null, temMapa: !!mapa, backbone: mapa?.backbone?.length ?? 0, gerando: gerandoRef.current });
      setSt({ mapa, estado, tituloSugerido: d.tituloSugerido ?? null, gerando: gerandoRef.current, erro: avisoRefazer.current, recentes });
    } catch (e: any) { setSt((s) => ({ ...s, erro: e?.message ?? "falha" })); }
  }, [on, scopeId, fimRefazer]);

  // Conversa trocou → zera e recarrega.
  useEffect(() => { gerandoRef.current = false; fimRefazer(); avisoRefazer.current = null; setSt({ mapa: null, estado: "oculta", tituloSugerido: null, gerando: false, erro: null, recentes: [] }); void refetch(); }, [refetch, fimRefazer]);
  useEffect(() => fimRefazer, [fimRefazer]);

  // Pusher: assina o canal do mapa (privado; auth em /api/map/pusher-auth).
  useEffect(() => {
    const mapaId = st.mapa?.id;
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY, cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!on || !mapaId || !key || !cluster) return;
    let vivo = true;
    (async () => {
      const Pusher = (await import("pusher-js")).default;
      if (!vivo) return;
      const p = pusherRef.current ?? new Pusher(key, { cluster, channelAuthorization: { endpoint: "/api/map/pusher-auth", transport: "ajax" } });
      pusherRef.current = p;
      const nome = canalCerebro(mapaId);
      if (canalRef.current && canalRef.current !== nome) { try { p.unsubscribe(canalRef.current); } catch { /* ignore */ } }
      canalRef.current = nome;
      const ch = p.subscribe(nome);
      ch.bind(EV_TURNO, (ev: { novos?: string[]; tocados?: string[] }) => void refetch([...(ev.novos ?? []), ...(ev.tocados ?? [])]));
      ch.bind(EV_GERADO, () => { gerandoRef.current = false; fimRefazer(); void refetch(); });
      ch.bind(EV_ERRO, (ev: { motivo?: string }) => { gerandoRef.current = false; fimRefazer(); avisoRefazer.current = ev?.motivo ?? "falhou"; setSt((s) => ({ ...s, gerando: false, estado: s.mapa?.backbone?.length ? "ativa" : "vazia", erro: ev?.motivo ?? "falhou" })); });
    })();
    return () => { vivo = false; };
  }, [on, st.mapa?.id, refetch, fimRefazer]);
  useEffect(() => () => { try { pusherRef.current?.disconnect(); } catch { /* ignore */ } pusherRef.current = null; canalRef.current = null; }, []);

  // Poll de fallback: gerando (sempre) ou painel aberto sem Pusher.
  useEffect(() => {
    const semPusher = !process.env.NEXT_PUBLIC_PUSHER_KEY;
    if (!on || !scopeId || !(st.gerando || (opts.aberto && semPusher))) return;
    const id = setInterval(() => void refetch(), POLL_MS);
    return () => clearInterval(id);
  }, [on, scopeId, st.gerando, opts.aberto, refetch]);

  const gerar = useCallback(async (topico?: string) => {
    if (!on || !scopeId || gerandoRef.current) return;
    gerandoRef.current = true;
    avisoRefazer.current = null;
    setSt((s) => ({ ...s, gerando: true, estado: "gerando", erro: null }));
    try {
      const r = await fetch("/api/map/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scopeId, ...(topico ? { topico } : {}) }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d?.error || `HTTP ${r.status}`); }
      const d = await r.json();
      if (d?.pronto) { gerandoRef.current = false; }
      void refetch();
    } catch (e: any) {
      gerandoRef.current = false;
      setSt((s) => ({ ...s, gerando: false, estado: s.mapa ? "vazia" : "sugerida", erro: mensagemDeErro(e, "o mapa não foi gerado") }));
    }
  }, [on, scopeId, refetch]);

  /** #661: o ↻ — pede um percurso novo (`force`); o que já foi estudado fica. Falhou → o mapa atual volta, com o aviso. */
  const atualizadoEm = st.mapa?.updatedAt ?? null;
  const refazer = useCallback(async () => {
    if (!on || !scopeId || gerandoRef.current) return;
    const falhou = (erro: string) => {
      gerandoRef.current = false; fimRefazer(); avisoRefazer.current = erro;
      setSt((s) => ({ ...s, gerando: false, estado: s.mapa?.backbone?.length ? "ativa" : "vazia", erro }));
    };
    gerandoRef.current = true;
    avisoRefazer.current = null;
    refazendoRef.current = atualizadoEm;
    timerRefazer.current = setTimeout(() => falhou("Não deu para refazer o mapa agora — o seu continua aqui."), REFAZER_MAX_MS);
    setSt((s) => ({ ...s, gerando: true, estado: "gerando", erro: null }));
    try {
      const r = await fetch("/api/map/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scopeId, force: true }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d?.error || `HTTP ${r.status}`); }
    } catch (e: any) { falhou(mensagemDeErro(e, "o mapa não foi refeito")); }
  }, [on, scopeId, atualizadoEm, fimRefazer]);

  /** depois de um TURNO do chat: o servidor decide se a conversa é estudável (lib/map/gatekeeper) em segundo plano, com
   *  uma chamada de IA de até ~8 s — então confere em 3 tempos (uma vez só, cedo demais, a bolinha não aparecia até trocar
   *  de conversa) */
  const timersTurno = useRef<ReturnType<typeof setTimeout>[]>([]);
  const conferirDepoisDoTurno = useCallback(() => {
    if (!on || !scopeId) return;
    for (const t of timersTurno.current) clearTimeout(t);
    timersTurno.current = [1500, 5000, 10000].map((ms) => setTimeout(() => void refetch(), ms));
  }, [on, scopeId, refetch]);
  useEffect(() => () => { for (const t of timersTurno.current) clearTimeout(t); }, []);

  return { ...st, refetch, gerar, refazer, conferirDepoisDoTurno, ligado: on };
}
