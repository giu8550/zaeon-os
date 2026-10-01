"use client";

/**
 * CoworkingCanal — o Escritório como CANAL (estilo Buzz): lista de mensagens + input + @mention
 * + presença. Só isso. Humanos e agentes no mesmo fio, em tempo real (Pusher); `@agente`
 * convoca o harness daquele agente, que responde com SEU nome e avatar. Sem 3D, sem
 * departamentos, sem títulos decorativos — a sala se explica pelo uso.
 *
 * Vidro Apple, claro === escuro (lib/canal/vidro.ts). Notificações fora da tela
 * (lib/canal/notificacoes.ts + useNotificacoesSO). Alvos ≥44px, input com safe-area.
 */
import PusherClient from "pusher-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AgentAvatar from "@/components/agents/AgentAvatar";
import { montarAliases, mencaoAberta, sugerir } from "@/lib/canal/mention";
import { prioridadeDe, deveNotificar } from "@/lib/canal/notificacoes";
import { canalChannel, presenceChannel, EV_MENSAGEM, EV_DIGITANDO, type MensagemWire } from "@/lib/canal/wire";
import { VIDRO_PAINEL, VIDRO_BOLHA, VIDRO_BOLHA_MINHA, VIDRO_INPUT, VIDRO_POPOVER, VIDRO_CHIP, TXT, TXT_2, TXT_MUDO, TOQUE } from "@/lib/canal/vidro";
import { useNotificacoesSO } from "./useNotificacoesSO";

type Canal = { id: string; titulo: string; acesso: string; ownerId: string; membros: string[]; agentes: string[]; cartolinaId: string | null; souDono: boolean };
type Agente = { agentKey: string; tipo: string; nome: string; emoji: string; bio: string; curso: string | null; avatarUrl: string | null; ativo: boolean };
type Pessoa = { id: string; nome: string; avatar: string | null };
type Detalhe = { canal: Canal; eu: Pessoa; mensagens: MensagemWire[]; agentes: Agente[]; pessoas: Pessoa[] };

const LS_ULTIMO = "zaeon.canal.ultimo";
const H = { "Content-Type": "application/json" };

export default function CoworkingCanal({ agenteInicial = null }: { agenteInicial?: string | null }) {
  const [canais, setCanais] = useState<Canal[]>([]);
  const [ativoId, setAtivoId] = useState<string | null>(null);
  const [det, setDet] = useState<Detalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [naoLidas, setNaoLidas] = useState<Record<string, number>>({});
  const [online, setOnline] = useState<Pessoa[]>([]);
  const [digitando, setDigitando] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [menu, setMenu] = useState<"canais" | "config" | null>(null);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [emailConvite, setEmailConvite] = useState("");
  const [sugIdx, setSugIdx] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const ativoRef = useRef<string | null>(null);
  const meuIdRef = useRef<string | null>(null);
  const meusAgentes = useRef<Set<string>>(new Set());
  const meusAliases = useRef<string[]>([]);
  const canaisRef = useRef<Canal[]>([]);
  const { visivel, pedirPermissao, badgeTitulo, notificar } = useNotificacoesSO();
  const visivelRef = useRef(true);
  useEffect(() => { visivelRef.current = visivel; }, [visivel]);
  useEffect(() => { ativoRef.current = ativoId; }, [ativoId]);
  useEffect(() => { canaisRef.current = canais; }, [canais]);

  // ─── canais: carrega; sem nenhum, cria o primeiro (a sala nunca abre vazia) ───
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/canal", { cache: "no-store" });
        if (r.status === 404) { setErro("off"); return; }
        if (!r.ok) throw new Error(String(r.status));
        let lista: Canal[] = (await r.json())?.canais ?? [];
        if (!lista.length) {
          const c = await fetch("/api/canal", { method: "POST", headers: H, body: JSON.stringify({ titulo: "Meu escritório", acesso: "turma", agentes: ["aura"], primeiro: true }) });
          if (c.ok) lista = [(await c.json()).canal];
        }
        if (!vivo) return;
        setCanais(lista);
        let ult: string | null = null;
        try { ult = localStorage.getItem(LS_ULTIMO); } catch { /* ignore */ }
        setAtivoId(lista.find((c) => c.id === ult)?.id ?? lista[0]?.id ?? null);
      } catch (e) {
        if (vivo) setErro(String((e as Error)?.message ?? e));
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  // ─── detalhe do canal ativo (+ marca lido) ───
  const carregarDetalhe = useCallback(async (id: string) => {
    const r = await fetch(`/api/canal/${id}`, { cache: "no-store" });
    if (!r.ok) { if (r.status === 403) setErro("403"); return; }
    const d: Detalhe = await r.json();
    meuIdRef.current = d.eu.id;
    const nome = d.eu.nome || "";
    meusAliases.current = [nome, nome.split(/\s+/)[0] ?? ""].filter(Boolean);
    setDet(d);
    setDigitando([]);
    setNaoLidas((n) => ({ ...n, [id]: 0 }));
    try { localStorage.setItem(LS_ULTIMO, id); } catch { /* ignore */ }
  }, []);
  useEffect(() => { if (ativoId) void carregarDetalhe(ativoId); }, [ativoId, carregarDetalhe]);

  // ─── badge no título da aba ───
  const totalNaoLidas = useMemo(() => Object.values(naoLidas).reduce((a, b) => a + b, 0), [naoLidas]);
  useEffect(() => { badgeTitulo(totalNaoLidas); }, [totalNaoLidas, badgeTitulo]);
  useEffect(() => { if (visivel && ativoId) setNaoLidas((n) => (n[ativoId] ? { ...n, [ativoId]: 0 } : n)); }, [visivel, ativoId]);

  // ─── realtime: um Pusher; assina TODOS os meus canais (não-lidas) + presença do ativo ───
  const pusherRef = useRef<PusherClient | null>(null);
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY, cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster || !canais.length) return;
    const p = pusherRef.current ?? new PusherClient(key, { cluster, channelAuthorization: { endpoint: "/api/canal/pusher-auth", transport: "ajax" } });
    pusherRef.current = p;
    const nomes = p.allChannels().map((c) => c.name);
    for (const c of canais) {
      const nome = canalChannel(c.id);
      if (nomes.includes(nome)) continue;
      const ch = p.subscribe(nome);
      ch.bind(EV_MENSAGEM, (m: MensagemWire) => aoChegar(m, c.id));
      ch.bind(EV_DIGITANDO, (d: { agentKey: string; estado: string }) => {
        if (c.id !== ativoRef.current) return;
        setDigitando((prev) => (d.estado === "digitando" ? [...new Set([...prev, d.agentKey])] : prev.filter((k) => k !== d.agentKey)));
      });
    }
    return () => { /* mantém assinaturas enquanto o componente vive; desconecta no unmount abaixo */ };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canais]);
  useEffect(() => () => { try { pusherRef.current?.disconnect(); } catch { /* ignore */ } pusherRef.current = null; }, []);

  useEffect(() => {
    const p = pusherRef.current;
    if (!p || !ativoId) return;
    const nome = presenceChannel(ativoId);
    const ch: any = p.subscribe(nome);
    const sync = () => {
      const lista: Pessoa[] = [];
      ch.members?.each((m: any) => lista.push({ id: String(m.id), nome: m.info?.nome ?? "Alguém", avatar: m.info?.avatar ?? null }));
      setOnline(lista);
    };
    ch.bind("pusher:subscription_succeeded", sync);
    ch.bind("pusher:member_added", sync);
    ch.bind("pusher:member_removed", sync);
    if (ch.subscribed) sync();
    return () => { try { p.unsubscribe(nome); } catch { /* ignore */ } setOnline([]); };
  }, [ativoId, canais.length]);

  const aoChegar = useCallback((m: MensagemWire, canalId: string) => {
    const aberto = canalId === ativoRef.current;
    if (aberto) {
      setDet((d) => (d && !d.mensagens.some((x) => x.id === m.id) ? { ...d, mensagens: [...d.mensagens, m] } : d));
      if (m.autorTipo === "agente") setDigitando((prev) => prev.filter((k) => k !== m.autorId));
    }
    const prioridade = prioridadeDe(m, { meuId: meuIdRef.current, meusAgentes: [...meusAgentes.current], meusAliases: meusAliases.current });
    if (!deveNotificar({ prioridade, abaVisivel: visivelRef.current, canalAberto: aberto })) return;
    if (!aberto || !visivelRef.current) setNaoLidas((n) => ({ ...n, [canalId]: (n[canalId] ?? 0) + 1 }));
    const canal = canaisRef.current.find((c) => c.id === canalId);
    notificar({
      canalId, prioridade,
      titulo: m.autorNome || (m.autorTipo === "agente" ? m.autorId : "Alguém"),
      corpo: canal && !aberto ? `${canal.titulo} · ${m.texto}` : m.texto,
      onClick: () => { setAtivoId(canalId); try { window.dispatchEvent(new CustomEvent("zaeon:set-tab", { detail: "escritorio" })); } catch { /* ignore */ } },
    });
  }, [notificar]);

  // ─── autoscroll ───
  useEffect(() => { fimRef.current?.scrollIntoView({ block: "end" }); }, [det?.mensagens.length, digitando.length]);

  // ─── "falar com agente": prefixa @agente e foca (NUNCA redireciona) ───
  const prefixarAgente = useCallback((key: string) => {
    setTexto((t) => (t.includes(`@${key}`) ? t : `@${key} ${t}`.replace(/\s+$/, " ")));
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);
  useEffect(() => {
    let k = agenteInicial;
    try { k = k || new URLSearchParams(window.location.search).get("agente"); } catch { /* ignore */ }
    if (k) prefixarAgente(k);
    const h = (e: Event) => { const slug = (e as CustomEvent<{ slug?: string }>).detail?.slug; if (slug) prefixarAgente(slug); };
    window.addEventListener("zaeon:escritorio:agente", h);
    return () => window.removeEventListener("zaeon:escritorio:agente", h);
  }, [agenteInicial, prefixarAgente]);

  // ─── @mention autocomplete ───
  const agentes = det?.agentes ?? [];
  const aliases = useMemo(() => montarAliases(agentes.map((a) => ({ agentKey: a.agentKey, nome: a.nome }))), [agentes]);
  const [caret, setCaret] = useState(0);
  const aberta = useMemo(() => mencaoAberta(texto, caret), [texto, caret]);
  const sugestoes = useMemo(() => (aberta ? sugerir(aberta.prefixo, agentes) : []), [aberta, agentes]);
  useEffect(() => { setSugIdx(0); }, [aberta?.prefixo]);
  const completar = useCallback((a: Agente) => {
    if (!aberta) return;
    const antes = texto.slice(0, aberta.inicio), depois = texto.slice(caret);
    const novo = `${antes}@${a.agentKey} ${depois.replace(/^\s+/, "")}`;
    setTexto(novo);
    const pos = antes.length + a.agentKey.length + 2;
    setTimeout(() => { const el = inputRef.current; if (el) { el.focus(); el.setSelectionRange(pos, pos); setCaret(pos); } }, 0);
  }, [aberta, texto, caret]);

  // ─── enviar ───
  const enviar = useCallback(async () => {
    const t = texto.trim();
    if (!t || !ativoId || enviando) return;
    setEnviando(true);
    try {
      void pedirPermissao(); // 1ª vez: gesto do usuário → pode pedir
      const r = await fetch(`/api/canal/${ativoId}/mensagem`, { method: "POST", headers: H, body: JSON.stringify({ texto: t }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); setErro(j?.error || `Falhou (${r.status})`); return; }
      const j = await r.json();
      const m: MensagemWire = j.mensagem;
      for (const k of m.mencoes ?? []) meusAgentes.current.add(k);
      if (m.mencoes?.length) setDigitando((prev) => [...new Set([...prev, ...m.mencoes])]);
      setDet((d) => (d && !d.mensagens.some((x) => x.id === m.id) ? { ...d, mensagens: [...d.mensagens, m] } : d));
      setTexto("");
      setErro(null);
      // agentes recém-convocados passam a constar no canal
      if (m.mencoes?.length) setCanais((cs) => cs.map((c) => (c.id === ativoId ? { ...c, agentes: [...new Set([...c.agentes, ...m.mencoes])] } : c)));
    } catch (e) {
      setErro(String((e as Error)?.message ?? e));
    } finally {
      setEnviando(false);
      inputRef.current?.focus();
    }
  }, [texto, ativoId, enviando, pedirPermissao]);

  const aoTeclar = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (aberta && sugestoes.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSugIdx((i) => (i + 1) % sugestoes.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSugIdx((i) => (i - 1 + sugestoes.length) % sugestoes.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); completar(sugestoes[sugIdx] ?? sugestoes[0]!); return; }
      if (e.key === "Escape") { e.preventDefault(); setCaret(0); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); }
  };

  // ─── ações do canal ───
  const criarCanal = async () => {
    const titulo = novoTitulo.trim();
    if (!titulo) return;
    const r = await fetch("/api/canal", { method: "POST", headers: H, body: JSON.stringify({ titulo, acesso: "turma", agentes: ["aura"] }) });
    if (!r.ok) return;
    const c: Canal = (await r.json()).canal;
    setCanais((cs) => [c, ...cs]);
    setNovoTitulo(""); setMenu(null); setAtivoId(c.id);
  };
  const patch = async (body: Record<string, unknown>) => {
    if (!ativoId) return;
    const r = await fetch(`/api/canal/${ativoId}`, { method: "PATCH", headers: H, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErro(j?.error || `Falhou (${r.status})`); return; }
    const c: Canal = j.canal;
    setCanais((cs) => cs.map((x) => (x.id === c.id ? c : x)));
    setDet((d) => (d ? { ...d, canal: c } : d));
    setErro(null);
  };
  const abrirCartolina = () => {
    const id = det?.canal.cartolinaId;
    if (!id) return;
    try { window.dispatchEvent(new CustomEvent("zaeon:cartolina:abrir", { detail: { id, canalId: ativoId } })); } catch { /* ignore */ }
  };

  // ─── render ───
  if (erro === "off") return <Vazio texto="O escritório coworking ainda não está ligado neste ambiente." />;
  if (carregando) return <Vazio texto="Abrindo o escritório…" />;
  if (!ativoId || !det) return <Vazio texto={erro === "403" ? "Você não tem acesso a este canal." : "Abrindo o canal…"} />;

  const canal = det.canal;
  const meuId = det.eu.id;
  const presentes = agentes.filter((a) => canal.agentes.includes(a.agentKey));
  const outros = agentes.filter((a) => !canal.agentes.includes(a.agentKey));

  return (
    <div className="w-full h-full min-h-0 flex flex-col p-2 sm:p-4">
      <div className={`relative flex-1 min-h-0 flex flex-col rounded-[28px] overflow-hidden ${VIDRO_PAINEL}`}>
        {/* barra: canal · presença · cartolina · config */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/50 dark:border-white/[0.08]">
          <div className="relative">
            <button type="button" onClick={() => setMenu(menu === "canais" ? null : "canais")} className={`${TOQUE} px-3 rounded-2xl text-[13px] font-bold ${TXT} ${VIDRO_CHIP} flex items-center gap-2`} aria-haspopup="listbox" aria-expanded={menu === "canais"}>
              <span className="max-w-[40vw] sm:max-w-[260px] truncate">{canal.titulo}</span>
              <span aria-hidden className={`text-[10px] ${TXT_MUDO}`}>▾</span>
              {totalNaoLidas - (naoLidas[ativoId] ?? 0) > 0 && <Badge n={totalNaoLidas - (naoLidas[ativoId] ?? 0)} />}
            </button>
            {menu === "canais" && (
              <div role="listbox" className={`absolute left-0 top-full mt-1.5 z-30 w-[min(92vw,320px)] p-1.5 rounded-2xl ${VIDRO_POPOVER}`}>
                {canais.map((c) => (
                  <button key={c.id} type="button" role="option" aria-selected={c.id === ativoId} onClick={() => { setAtivoId(c.id); setMenu(null); }}
                    className={`w-full ${TOQUE} flex items-center justify-between gap-2 px-3 rounded-xl text-left text-[13px] ${c.id === ativoId ? `bg-blue-500/15 dark:bg-blue-400/15 ${TXT}` : `${TXT_2} hover:bg-slate-500/10 dark:hover:bg-white/10`}`}>
                    <span className="truncate font-medium">{c.titulo}</span>
                    {naoLidas[c.id] ? <Badge n={naoLidas[c.id]!} /> : null}
                  </button>
                ))}
                <div className="mt-1 flex gap-1.5 p-1">
                  <input value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void criarCanal(); }} placeholder="novo canal" aria-label="Nome do novo canal"
                    className={`flex-1 min-h-[40px] px-3 rounded-xl text-[13px] bg-white/70 dark:bg-white/[0.06] border border-white/60 dark:border-white/10 ${TXT} placeholder:text-slate-400 dark:placeholder:text-white/35 outline-none focus:border-blue-400/70`} />
                  <button type="button" onClick={() => void criarCanal()} className={`min-h-[40px] px-3 rounded-xl text-[12px] font-bold ${VIDRO_CHIP} ${TXT}`}>+</button>
                </div>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {/* presença: quem está online agora (humanos) */}
            <div className="hidden xs:flex sm:flex -space-x-2" aria-label={`${online.length} online`}>
              {online.slice(0, 6).map((p) => <AgentAvatar key={p.id} src={p.avatar} nome={p.nome} size={28} className="ring-2 ring-emerald-400/70" />)}
            </div>
            {online.length > 0 && <span className={`text-[11px] ${TXT_MUDO}`}>{online.length}</span>}
            {canal.cartolinaId && (
              <button type="button" onClick={abrirCartolina} className={`${TOQUE} px-3 rounded-2xl text-[12px] font-bold ${VIDRO_CHIP} ${TXT}`} title="Abrir a cartolina da sala">▦ cartolina</button>
            )}
            {canal.souDono && (
              <div className="relative">
                <button type="button" onClick={() => setMenu(menu === "config" ? null : "config")} className={`${TOQUE} rounded-2xl text-[14px] ${VIDRO_CHIP} ${TXT}`} aria-label="Configurar canal" aria-expanded={menu === "config"}>⚙︎</button>
                {menu === "config" && (
                  <div className={`absolute right-0 top-full mt-1.5 z-30 w-[min(92vw,320px)] p-3 rounded-2xl flex flex-col gap-3 ${VIDRO_POPOVER}`}>
                    <div className="flex gap-1" role="radiogroup" aria-label="Quem o agente atende">
                      {(["privado", "turma", "aberto"] as const).map((a) => (
                        <button key={a} type="button" role="radio" aria-checked={canal.acesso === a} onClick={() => void patch({ acesso: a })}
                          className={`flex-1 min-h-[40px] rounded-xl text-[12px] font-bold ${canal.acesso === a ? `bg-blue-500/20 dark:bg-blue-400/20 ${TXT}` : `${VIDRO_CHIP} ${TXT_2}`}`}>{a}</button>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input value={emailConvite} onChange={(e) => setEmailConvite(e.target.value)} placeholder="e-mail de um colega" aria-label="Adicionar membro por e-mail" type="email"
                        onKeyDown={(e) => { if (e.key === "Enter" && emailConvite) { void patch({ adicionarEmail: emailConvite }); setEmailConvite(""); } }}
                        className={`flex-1 min-h-[40px] px-3 rounded-xl text-[13px] bg-white/70 dark:bg-white/[0.06] border border-white/60 dark:border-white/10 ${TXT} placeholder:text-slate-400 dark:placeholder:text-white/35 outline-none focus:border-blue-400/70`} />
                      <button type="button" onClick={() => { if (emailConvite) { void patch({ adicionarEmail: emailConvite }); setEmailConvite(""); } }} className={`min-h-[40px] px-3 rounded-xl text-[12px] font-bold ${VIDRO_CHIP} ${TXT}`}>+</button>
                    </div>
                    {det.pessoas.filter((p) => canal.membros.includes(p.id)).length > 0 && (
                      <ul className="flex flex-col gap-1">
                        {det.pessoas.filter((p) => canal.membros.includes(p.id)).map((p) => (
                          <li key={p.id} className={`flex items-center gap-2 text-[12.5px] ${TXT_2}`}>
                            <AgentAvatar src={p.avatar} nome={p.nome} size={22} /><span className="truncate flex-1">{p.nome}</span>
                            <button type="button" onClick={() => void patch({ removerMembro: p.id })} className={`min-h-[32px] px-2 rounded-lg text-[11px] ${TXT_MUDO} hover:text-rose-500 dark:hover:text-rose-300`} aria-label={`Remover ${p.nome}`}>×</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <input defaultValue={canal.cartolinaId ?? ""} placeholder="id da cartolina (opcional)" aria-label="Cartolina compartilhada"
                      onBlur={(e) => { const v = e.target.value.trim(); if (v !== (canal.cartolinaId ?? "")) void patch({ cartolinaId: v || null }); }}
                      className={`min-h-[40px] px-3 rounded-xl text-[12px] font-mono bg-white/70 dark:bg-white/[0.06] border border-white/60 dark:border-white/10 ${TXT} placeholder:text-slate-400 dark:placeholder:text-white/35 outline-none focus:border-blue-400/70`} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* mensagens */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 sm:px-5 py-4 flex flex-col gap-3" onClick={() => setMenu(null)}>
          {det.mensagens.map((m) => <Bolha key={m.id} m={m} minha={m.autorTipo === "humano" && m.autorId === meuId} aliases={aliases} />)}
          {digitando.map((k) => {
            const a = agentes.find((x) => x.agentKey === k);
            return (
              <div key={`dig-${k}`} className="flex items-end gap-2">
                <AgentAvatar src={a?.avatarUrl} nome={a?.nome ?? k} size={30} emoji={a?.emoji} />
                <div className={`px-3.5 py-2.5 rounded-2xl rounded-bl-md ${VIDRO_BOLHA} ${TXT_MUDO} text-[13px]`}>
                  <span className="font-semibold">{a?.nome ?? k}</span> está escrevendo<span className="animate-pulse">…</span>
                </div>
              </div>
            );
          })}
          <div ref={fimRef} />
        </div>

        {/* input (fixo, safe-area) */}
        <div className={`relative px-2 sm:px-3 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] ${VIDRO_INPUT}`}>
          {aberta && sugestoes.length > 0 && (
            <div role="listbox" className={`absolute left-3 bottom-full mb-1.5 z-30 w-[min(92vw,300px)] p-1.5 rounded-2xl ${VIDRO_POPOVER}`}>
              {sugestoes.map((a, i) => (
                <button key={a.agentKey} type="button" role="option" aria-selected={i === sugIdx} onMouseDown={(e) => { e.preventDefault(); completar(a); }}
                  className={`w-full ${TOQUE} flex items-center gap-2.5 px-3 rounded-xl text-left ${i === sugIdx ? `bg-blue-500/15 dark:bg-blue-400/15 ${TXT}` : `${TXT_2} hover:bg-slate-500/10 dark:hover:bg-white/10`}`}>
                  <AgentAvatar src={a.avatarUrl} nome={a.nome} size={26} emoji={a.emoji} />
                  <span className="flex flex-col min-w-0"><span className="text-[13px] font-semibold truncate">{a.nome}</span><span className={`text-[11px] truncate ${TXT_MUDO}`}>@{a.agentKey}{a.curso ? ` · ${a.curso}` : ""}</span></span>
                </button>
              ))}
            </div>
          )}
          {/* agentes convocáveis: presentes no canal + os meus contratados (toque = @) */}
          {(presentes.length > 0 || outros.length > 0) && (
            <div className="flex gap-1.5 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[...presentes, ...outros].map((a) => (
                <button key={a.agentKey} type="button" onClick={() => prefixarAgente(a.agentKey)} title={`@${a.agentKey}${a.curso ? ` · ${a.curso}` : ""}`}
                  className={`shrink-0 min-h-[36px] pl-1 pr-2.5 rounded-full flex items-center gap-1.5 text-[12px] font-semibold ${VIDRO_CHIP} ${canal.agentes.includes(a.agentKey) ? TXT : TXT_MUDO}`}>
                  <AgentAvatar src={a.avatarUrl} nome={a.nome} size={26} emoji={a.emoji} className={digitando.includes(a.agentKey) ? "ring-2 ring-cyan-400/80" : ""} />
                  {a.nome}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={texto}
              rows={1}
              onChange={(e) => { setTexto(e.target.value); setCaret(e.target.selectionStart ?? e.target.value.length); }}
              onKeyUp={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
              onClick={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
              onKeyDown={aoTeclar}
              placeholder="Mensagem · @agente convoca"
              aria-label="Mensagem"
              className={`flex-1 min-h-[44px] max-h-[140px] px-4 py-3 rounded-2xl resize-none text-[14px] leading-5 bg-white/70 dark:bg-white/[0.06] border border-white/70 dark:border-white/10 ${TXT} placeholder:text-slate-400 dark:placeholder:text-white/35 outline-none focus:border-blue-400/70 dark:focus:border-cyan-300/50`}
              style={{ height: Math.min(140, 24 + 20 * Math.max(1, texto.split("\n").length)) }}
            />
            <button type="button" onClick={() => void enviar()} disabled={!texto.trim() || enviando} aria-label="Enviar"
              className={`${TOQUE} rounded-2xl text-[15px] font-black transition-all disabled:opacity-40 bg-blue-600 text-white dark:bg-cyan-400 dark:text-slate-900 shadow-[0_8px_24px_-8px_rgba(37,99,235,0.6)] dark:shadow-[0_8px_24px_-8px_rgba(34,211,238,0.5)] hover:scale-[1.03] active:scale-95`}>
              ↑
            </button>
          </div>
          {erro && erro !== "403" && <p role="alert" className="mt-1.5 px-1 text-[11.5px] text-rose-600 dark:text-rose-300">{erro}</p>}
        </div>
      </div>
    </div>
  );
}

function Badge({ n }: { n: number }) {
  return <span className="ml-1 inline-grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black bg-blue-600 text-white dark:bg-cyan-400 dark:text-slate-900">{n > 99 ? "99+" : n}</span>;
}

function Vazio({ texto }: { texto: string }) {
  return <div className={`w-full h-full grid place-items-center text-[13px] ${TXT_MUDO}`}>{texto}</div>;
}

const hora = (iso: string) => { try { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

/** Bolha: humano e agente com o MESMO vidro; identidade = avatar + nome. @mentions em destaque. */
function Bolha({ m, minha, aliases }: { m: MensagemWire; minha: boolean; aliases: Map<string, string> }) {
  const partes = useMemo(() => m.texto.split(/(@[\p{L}\p{N}_-]+)/u), [m.texto]);
  const nome = m.autorNome || (m.autorTipo === "agente" ? m.autorId : "Alguém");
  return (
    <div className={`flex items-end gap-2 ${minha ? "flex-row-reverse" : ""}`}>
      {!minha && <AgentAvatar src={m.autorAvatar} nome={nome} size={30} />}
      <div className={`max-w-[85%] sm:max-w-[70%] flex flex-col ${minha ? "items-end" : "items-start"}`}>
        {!minha && (
          <span className={`px-1 mb-0.5 text-[11px] font-semibold ${m.autorTipo === "agente" ? "text-cyan-700 dark:text-cyan-300" : TXT_MUDO}`}>
            {nome}{m.autorTipo === "agente" ? ` · @${m.autorId}` : ""}
          </span>
        )}
        <div className={`px-3.5 py-2.5 rounded-2xl ${minha ? `rounded-br-md ${VIDRO_BOLHA_MINHA}` : `rounded-bl-md ${VIDRO_BOLHA}`} ${TXT} text-[14px] leading-relaxed whitespace-pre-wrap break-words`}>
          {partes.map((p, i) => {
            const alvo = p.startsWith("@") ? aliases.get(p.slice(1).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()) : null;
            return alvo ? <span key={i} className="font-bold text-blue-700 dark:text-cyan-300">{p}</span> : <span key={i}>{p}</span>;
          })}
        </div>
        <span className={`px-1 mt-0.5 text-[10px] ${TXT_MUDO}`}>{hora(m.createdAt)}</span>
      </div>
    </div>
  );
}
