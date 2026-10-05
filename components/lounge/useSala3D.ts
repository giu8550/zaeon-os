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
import { HEARTBEAT_MS, HELLO_JITTER_MS, poseMudou, type Pose } from "@/lib/lounge3d/pose";
import { classificarErroPusher, ehFalhaDeConexao, type EstadoRealtime, type MotivoErro } from "@/lib/lounge3d/realtimeEstado";
import { EV_CHAT, EV_CONTEUDO, EV_POS, EV_POS_CLIENTE, EV_RECADO, POS_HZ, POS_HZ_FALLBACK, canalSala, type ConteudoSala, type MensagemChat, type OpsSala, type Presenca, type RecadoQG } from "@/lib/lounge3d/tipos";

export type Membro = { id: string; name: string; image: string | null; color: string; fundador?: boolean; qg?: boolean };
export type Sala = { id: string; title: string; ownerId: string; isOwner: boolean; members: string[]; token: string | null; conteudo: ConteudoSala };
export type EstadoSala = "carregando" | "ok" | "cheia" | "erro" | "off";

/**
 * `poseInicial(id)`: onde mostrar alguém que está ONLINE mas ainda não mandou posição (ex.: sentado na própria base).
 * Sem ela (Cartolina 3D), o avatar remoto só aparece com a 1ª posição recebida.
 */
export type OpcoesSala3D = { poseInicial?: (userId: string) => Pose | null };

/** Evento de handshake: quem entra pede; quem já está responde reenviando a própria pose na hora. */
const EV_HELLO = "client-hello";

export function useSala3D(salaId: string | null, opts: OpcoesSala3D = {}) {
  const [sala, setSala] = useState<Sala | null>(null);
  const [eu, setEu] = useState<Membro | null>(null);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [estado, setEstado] = useState<EstadoSala>("carregando");
  const [online, setOnline] = useState<Membro[]>([]);
  const [chat, setChat] = useState<MensagemChat[]>([]);
  /** conectando → pusher (ok) | erro (com `motivoRealtime`) | sem-chave (build sem NEXT_PUBLIC_PUSHER_*). Nunca "indisponível" só por estar conectando. */
  const [realtime, setRealtime] = useState<EstadoRealtime>("conectando");
  const [motivoRealtime, setMotivoRealtime] = useState<MotivoErro | null>(null);
  /** Presenças remotas (alvo da interpolação) — ref, não state: muda 12×/s. */
  const remotos = useRef<Map<string, Presenca>>(new Map());
  const pusherRef = useRef<PusherClient | null>(null);
  const canalRef = useRef<any>(null);
  const clientEventsOk = useRef(true);
  const ultimoPos = useRef(0);
  const poseInicialRef = useRef(opts.poseInicial); poseInicialRef.current = opts.poseInicial;
  /** última pose conhecida (o engine atualiza a cada frame) e a última que de fato saiu pela rede */
  const ultimaPose = useRef<Pose | null>(null);
  const ultimaEnviada = useRef<Pose | null>(null);
  /** emissor atual (ref p/ o efeito do Pusher e o heartbeat chamarem sem reinstalar) */
  const emitirRef = useRef<(p: Pose, forcar: boolean) => void>(() => {});

  const carregar = useCallback(async () => {
    if (!salaId) return;
    try {
      const r = await fetch(`/api/lounge3d/${salaId}`, { cache: "no-store" });
      if (r.status === 404) { setEstado("off"); return; }
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      setSala(d.sala); setMembros(d.membros ?? []); setEu({ id: d.eu.id, name: d.eu.name, image: d.eu.image ?? null, color: d.eu.color, fundador: d.eu.fundador === true, qg: d.eu.qg === true });
      setEstado((e) => (e === "cheia" ? e : "ok"));
    } catch { setEstado("erro"); }
  }, [salaId]);
  useEffect(() => { setSala(null); setChat([]); remotos.current.clear(); setEstado("carregando"); void carregar(); }, [carregar]);

  // Pusher: presença + eventos. Depende do ID (não do objeto `eu`, recriado a cada refetch → reconectava à toa).
  const euId = eu?.id ?? null;
  useEffect(() => {
    const mapaRemotos = remotos.current;
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY, cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!salaId || !euId) return;
    // Diagnóstico (1x por montagem): o bundle recebeu a key? (NEXT_PUBLIC_* é inlinada no BUILD/start — reinicie após mexer no .env)
    console.info(`[lounge] pusher: key ${key ? "presente" : "AUSENTE"} · cluster ${cluster || "AUSENTE"} · canal ${canalSala(salaId)}`);
    if (!key || !cluster) { setRealtime("sem-chave"); return; }
    setRealtime("conectando"); setMotivoRealtime(null);
    let vivo = true;
    (async () => {
      const Pusher = (await import("pusher-js")).default;
      if (!vivo) return;
      const p = new Pusher(key, { cluster, channelAuthorization: { endpoint: `/api/lounge3d/${salaId}/pusher-auth`, transport: "ajax" } });
      pusherRef.current = p; clientEventsOk.current = true;
      // conexão: failed/unavailable = erro de verdade; o resto é transitório
      p.connection.bind("state_change", (st: { current?: string }) => {
        if (!vivo) return;
        if (ehFalhaDeConexao(st?.current)) { setRealtime("erro"); setMotivoRealtime("conexao"); }
        else if (st?.current === "connected") setRealtime((r) => (r === "erro" ? "conectando" : r));
      });
      // pusher:error 4301 = "Enable client events" desligado no painel: as posições seriam descartadas em silêncio → cai pro POST /pos
      p.connection.bind("error", (err: unknown) => {
        if (classificarErroPusher(err) === "client-events" && clientEventsOk.current) {
          clientEventsOk.current = false;
          console.warn("[lounge] Pusher sem 'client events' (4301): usando o fallback do servidor (4 Hz). Ligue 'Enable client events' em App Settings.");
        }
      });
      const ch: any = p.subscribe(canalSala(salaId));
      canalRef.current = ch;
      // SEED: todo membro online (≠ eu) ganha uma presença placeholder já — o avatar aparece antes do 1º client-pos
      // (client-pos é efêmero: quem está parado ou entrou depois ficava invisível → "um vê, o outro não").
      const seed = (m: any) => {
        const id = String(m?.id ?? ""); if (!id || id === euId || mapaRemotos.has(id)) return;
        const pose = poseInicialRef.current?.(id); if (!pose) return;
        mapaRemotos.set(id, { userId: id, name: m.info?.name ?? "Alguém", color: m.info?.color ?? "#4aa3ff", x: pose.x, z: pose.z, facing: pose.facing, moving: false, sit: pose.sit ?? true, ts: Date.now() });
      };
      const sync = () => { const lista: Membro[] = []; ch.members?.each((m: any) => { lista.push({ id: String(m.id), name: m.info?.name ?? "Alguém", image: m.info?.image ?? null, color: m.info?.color ?? "#4aa3ff" }); seed(m); }); setOnline(lista); };
      ch.bind("pusher:subscription_succeeded", () => {
        setRealtime("pusher"); setMotivoRealtime(null); sync();
        // handshake: "cheguei" → quem já está reenvia a pose na hora (ninguém depende de o outro andar)
        try { ch.trigger(EV_HELLO, { id: euId }); } catch { /* client events off: o seed + heartbeat cobrem */ }
        if (ultimaPose.current) emitirRef.current(ultimaPose.current, true);
      });
      ch.bind(EV_HELLO, () => { setTimeout(() => { if (vivo && ultimaPose.current) emitirRef.current(ultimaPose.current, true); }, Math.random() * HELLO_JITTER_MS); });
      ch.bind("pusher:subscription_error", (e: any) => {
        const motivo = classificarErroPusher(e);
        console.warn("[lounge] assinatura do canal falhou:", motivo, e);
        if (motivo === "cheia") { setEstado("cheia"); return; }
        setRealtime("erro"); setMotivoRealtime(motivo);
      });
      ch.bind("pusher:member_added", (m: any) => { seed(m); sync(); });
      ch.bind("pusher:member_removed", (m: any) => { mapaRemotos.delete(String(m.id)); sync(); });
      const onPos = (raw: unknown) => { const pr = sanitizarPresenca(raw); if (pr && pr.userId !== euId) mapaRemotos.set(pr.userId, pr); };
      ch.bind(EV_POS_CLIENTE, onPos); ch.bind(EV_POS, onPos);
      ch.bind(EV_CHAT, (m: MensagemChat) => setChat((c) => [...c.slice(-199), m]));
      // recado do dono pro QG (holograma ao lado da tela do Andrei): chega na hora e fica no conteúdo
      ch.bind(EV_RECADO, (d: { recado: RecadoQG | null }) => setSala((s) => (s ? { ...s, conteudo: { ...s.conteudo, recadoQG: d.recado } } : s)));
      ch.bind(EV_CONTEUDO, (d: { fromUserId: string; conteudo: ConteudoSala; title?: string }) => {
        if (d.fromUserId === euId) return; // o autor já aplicou localmente
        setSala((s) => (s ? { ...s, conteudo: d.conteudo, title: d.title ?? s.title } : s));
      });
    })();
    return () => { vivo = false; try { pusherRef.current?.disconnect(); } catch { /* ignore */ } pusherRef.current = null; canalRef.current = null; setOnline([]); mapaRemotos.clear(); };
  }, [salaId, euId]);

  /** Emite a pose (throttle; `forcar` ignora o throttle — hello/heartbeat). client-pos → sem servidor; sem client events → POST a 4 Hz. */
  const euRef = useRef(eu); euRef.current = eu;
  const emitir = useCallback((p: Pose, forcar: boolean) => {
    const me = euRef.current;
    if (!salaId || !me) return;
    const agora = performance.now();
    const hz = clientEventsOk.current ? POS_HZ : POS_HZ_FALLBACK;
    if (!forcar && agora - ultimoPos.current < 1000 / hz) return;
    ultimoPos.current = agora; ultimaEnviada.current = p;
    const payload: Presenca = { userId: me.id, name: me.name, color: me.color, ...p, ts: Date.now() };
    const ch = canalRef.current;
    if (clientEventsOk.current && ch?.subscribed) {
      const ok = ch.trigger(EV_POS_CLIENTE, payload);
      if (ok) return;
      clientEventsOk.current = false; // app Pusher sem "client events": cai no servidor
    }
    void fetch(`/api/lounge3d/${salaId}/pos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }).catch(() => {});
  }, [salaId]);
  emitirRef.current = emitir;

  /** O engine chama a cada frame: guarda a pose e só envia quando MUDOU (parado não gasta a cota do Pusher). */
  const enviarPos = useCallback((p: Omit<Presenca, "userId" | "name" | "color">) => {
    const pose: Pose = { x: p.x, z: p.z, facing: p.facing, moving: !!p.moving, sit: !!p.sit, topo: !!p.topo, ceu: !!p.ceu, ...(p.voo ? { voo: p.voo } : {}), ...(p.naveParada ? { naveParada: p.naveParada } : {}), ...(typeof p.jet === "number" ? { jet: p.jet } : {}), ...(typeof p.alt === "number" ? { alt: p.alt } : {}) };
    ultimaPose.current = pose;
    if (poseMudou(ultimaEnviada.current, pose)) emitir(pose, false);
  }, [emitir]);

  // HEARTBEAT independente do requestAnimationFrame (que o navegador pausa em segundo plano): reenvia a última pose
  // a cada 2 s e ao voltar pra aba — cura pacote perdido, aba oculta e quem acabou de entrar.
  useEffect(() => {
    if (!salaId) return;
    const hb = setInterval(() => { if (ultimaPose.current) emitirRef.current(ultimaPose.current, true); }, HEARTBEAT_MS);
    const vis = () => { if (!document.hidden && ultimaPose.current) emitirRef.current(ultimaPose.current, true); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(hb); document.removeEventListener("visibilitychange", vis); };
  }, [salaId]);

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

  /** o DONO manda (ou apaga, `texto` null) o recado pro QG — o servidor confere a sessão; aplica aqui na hora */
  const enviarRecado = useCallback(async (texto: string | null): Promise<{ ok: boolean; erro?: string }> => {
    if (!salaId) return { ok: false, erro: "Sem sala." };
    const r = await fetch(`/api/lounge3d/${salaId}/recado`, texto === null ? { method: "DELETE" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, erro: (d as { error?: string })?.error ?? "Não deu pra enviar." };
    const recado = texto === null ? null : ((d as { recado?: RecadoQG }).recado ?? null);
    setSala((s) => (s ? { ...s, conteudo: { ...s.conteudo, recadoQG: recado } } : s));
    return { ok: true };
  }, [salaId]);

  return { sala, eu, membros, online, chat, estado, realtime, motivoRealtime, remotos, enviarPos, enviarChat, patch, enviarRecado, recadoQG: sala?.conteudo.recadoQG ?? null, recarregar: carregar };
}
