"use client";
/**
 * useSala3D — dados + tempo real da sala 3D (docs/HANDOFF_LOUNGE_COWORK_3D.md):
 *   GET /api/lounge3d/[id] (conteúdo, membros) · Pusher presença `presence-lounge3d-<id>` (quem está;
 *   teto 5 no auth → "cheia") · posições por `client-pos` (12 Hz, sem servidor; fallback POST /pos a 4 Hz)
 *   · chat (POST → evento "chat") · conteúdo (PATCH → evento "conteudo").
 * Presença/chat são efêmeros; só notas/artefatos persistem.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type PusherClient from "pusher-js";
import { sanitizarPresenca } from "@/lib/lounge3d/sala";
import { EV_CHAT, EV_CONTEUDO, EV_POS, EV_POS_CLIENTE, POS_HZ, POS_HZ_FALLBACK, canalSala, type ConteudoSala, type MensagemChat, type OpsSala, type Presenca } from "@/lib/lounge3d/tipos";

export type Membro = { id: string; name: string; image: string | null; color: string };
export type Sala = { id: string; title: string; ownerId: string; isOwner: boolean; members: string[]; token: string | null; conteudo: ConteudoSala };
export type EstadoSala = "carregando" | "ok" | "cheia" | "erro" | "off";

export function useSala3D(salaId: string | null) {
  const [sala, setSala] = useState<Sala | null>(null);
  const [eu, setEu] = useState<Membro | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [estado, setEstado] = useState<EstadoSala>("carregando");
  const [online, setOnline] = useState<Membro[]>([]);
  const [chat, setChat] = useState<MensagemChat[]>([]);
  const [realtime, setRealtime] = useState<"pusher" | "nenhum">("nenhum");
  /** Presenças remotas (alvo da interpolação) — ref, não state: muda 12×/s. */
  const remotos = useRef<Map<string, Presenca>>(new Map());
  const pusherRef = useRef<PusherClient | null>(null);
  const canalRef = useRef<any>(null);
  const clientEventsOk = useRef(true);
  const ultimoPos = useRef(0);

  const carregar = useCallback(async () => {
    if (!salaId) return;
    try {
      const r = await fetch(`/api/lounge3d/${salaId}`, { cache: "no-store" });
      if (r.status === 404) { setEstado("off"); return; }
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      setSala(d.sala); setMembros(d.membros ?? []); setEu({ id: d.eu.id, name: d.eu.name, image: d.eu.image ?? null, color: d.eu.color });
      setEstado((e) => (e === "cheia" ? e : "ok"));
    } catch { setEstado("erro"); }
  }, [salaId]);
  useEffect(() => { setSala(null); setChat([]); remotos.current.clear(); setEstado("carregando"); void carregar(); }, [carregar]);

  // Pusher: presença + eventos
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY, cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!salaId || !key || !cluster || !eu) return;
    let vivo = true;
    (async () => {
      const Pusher = (await import("pusher-js")).default;
      if (!vivo) return;
      const p = new Pusher(key, { cluster, channelAuthorization: { endpoint: `/api/lounge3d/${salaId}/pusher-auth`, transport: "ajax" } });
      pusherRef.current = p;
      const ch: any = p.subscribe(canalSala(salaId));
      canalRef.current = ch;
      const sync = () => { const lista: Membro[] = []; ch.members?.each((m: any) => lista.push({ id: String(m.id), name: m.info?.name ?? "Alguém", image: m.info?.image ?? null, color: m.info?.color ?? "#4aa3ff" })); setOnline(lista); };
      ch.bind("pusher:subscription_succeeded", () => { setRealtime("pusher"); sync(); });
      ch.bind("pusher:subscription_error", (e: any) => { if (e?.status === 403 || e?.error?.status === 403) setEstado("cheia"); else setRealtime("nenhum"); });
      ch.bind("pusher:member_added", sync);
      ch.bind("pusher:member_removed", (m: any) => { remotos.current.delete(String(m.id)); sync(); });
      const onPos = (raw: unknown) => { const pr = sanitizarPresenca(raw); if (pr && pr.userId !== eu.id) remotos.current.set(pr.userId, pr); };
      ch.bind(EV_POS_CLIENTE, onPos); ch.bind(EV_POS, onPos);
      ch.bind(EV_CHAT, (m: MensagemChat) => setChat((c) => [...c.slice(-199), m]));
      ch.bind(EV_CONTEUDO, (d: { fromUserId: string; conteudo: ConteudoSala; title?: string }) => {
        if (d.fromUserId === eu.id) return; // o autor já aplicou localmente
        setSala((s) => (s ? { ...s, conteudo: d.conteudo, title: d.title ?? s.title } : s));
      });
    })();
    return () => { vivo = false; try { pusherRef.current?.disconnect(); } catch { /* ignore */ } pusherRef.current = null; canalRef.current = null; setOnline([]); };
  }, [salaId, eu]);

  /** Difunde a minha posição (throttle). client-pos → sem servidor; se não dá, POST a 4 Hz. */
  const enviarPos = useCallback((p: Omit<Presenca, "userId" | "name" | "color">) => {
    if (!salaId || !eu) return;
    const agora = performance.now();
    const hz = clientEventsOk.current ? POS_HZ : POS_HZ_FALLBACK;
    if (agora - ultimoPos.current < 1000 / hz) return;
    ultimoPos.current = agora;
    const payload: Presenca = { userId: eu.id, name: eu.name, color: eu.color, ...p, ts: Date.now() };
    const ch = canalRef.current;
    if (clientEventsOk.current && ch?.subscribed) {
      const ok = ch.trigger(EV_POS_CLIENTE, payload);
      if (ok) return;
      clientEventsOk.current = false; // app Pusher sem "client events": cai no servidor
    }
    void fetch(`/api/lounge3d/${salaId}/pos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }).catch(() => {});
  }, [salaId, eu]);

  const enviarChat = useCallback(async (texto: string) => {
    if (!salaId || !texto.trim()) return;
    const r = await fetch(`/api/lounge3d/${salaId}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto }) });
    if (r.ok && realtime !== "pusher") { const d = await r.json().catch(() => null); if (d?.msg) setChat((c) => [...c.slice(-199), d.msg]); }
  }, [salaId, realtime]);

  /** Aplica no servidor e localmente (otimista) — o evento "conteudo" cobre os outros. */
  const patch = useCallback(async (ops: OpsSala & { title?: string }) => {
    if (!salaId) return;
    const r = await fetch(`/api/lounge3d/${salaId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ops) });
    if (!r.ok) return;
    const d = await r.json().catch(() => null);
    if (d?.conteudo) setSala((s) => (s ? { ...s, conteudo: d.conteudo, title: d.title ?? s.title } : s));
  }, [salaId]);

  return { sala, eu, membros, online, chat, estado, realtime, remotos, enviarPos, enviarChat, patch, recarregar: carregar };
}
