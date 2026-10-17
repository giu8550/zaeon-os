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
import ChatMarkdown from "@/components/study/ChatMarkdown";
import PusherClient from "pusher-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AgentAvatar from "@/components/agents/AgentAvatar";
import ChatZoom, { useChatFontScale } from "@/components/chat/ChatZoom";
import { fonteChat } from "@/lib/ui/chatFontScale";
import { montarTopoPessoas } from "@/lib/canal/topoPessoas";
import { podeApagar, textoConfirmarApagar, aposApagar } from "@/lib/canal/seletor";
import { ABAS, abaDoCanal, filtrarPorAba, type Aba } from "@/lib/canal/convite";
import { ConvidarForm, type ConviteVista } from "./ConvitesEscritorio";
import SinoConvites from "./SinoConvites";
import { montarSino, contadorDoSino, type HistoricoSino, type EstadoSino, type AcaoSino } from "@/lib/canal/sino";
import PessoasTopo from "./PessoasTopo";
import { estaAtivo, frase, normalizarEstado, rotulo, type EstadoAgente } from "@/lib/canal/estadoAgente";
import { montarAliases, mencaoAberta, sugerir } from "@/lib/canal/mention";
import { prioridadeDe, deveNotificar } from "@/lib/canal/notificacoes";
import { canalChannel, presenceChannel, EV_MENSAGEM, EV_DIGITANDO, EV_AGENDA, EV_HUMANO_DIGITANDO, type MensagemWire } from "@/lib/canal/wire";
import { deveAvisarDigitando, podarDigitando, quemDigita, TTL_DIGITANDO_MS, type Digitando } from "@/lib/canal/presenca";
import { LinhaSistema, AvisoDigitando } from "./Presenca";
import AgendaBandeja from "./AgendaBandeja";
import { VIDRO_PAINEL, VIDRO_BOLHA, VIDRO_BOLHA_MINHA, VIDRO_INPUT, VIDRO_POPOVER, VIDRO_CHIP, TXT, TXT_2, TXT_MUDO, TOQUE } from "@/lib/canal/vidro";
import { useNotificacoesSO } from "./useNotificacoesSO";

type Canal = { id: string; titulo: string; acesso: string; ownerId: string; membros: string[]; agentes: string[]; cartolinaId: string | null; souDono: boolean; dmCom?: string | null };
type Convites = { recebidos: ConviteVista[]; enviados: ConviteVista[]; contatos: ConviteVista[]; historico: HistoricoSino[]; sino: EstadoSino };
const SEM_CONVITES: Convites = { recebidos: [], enviados: [], contatos: [], historico: [], sino: { vistoEm: null, limpoAte: null } };
const NOME_ABA: Record<Aba, string> = { privado: "Privado", turma: "Turma", aberto: "Aberto" };
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
  // o que cada agente está fazendo (pesquisando, investigando…) e quem está "em descanso" (lib/canal/estadoAgente)
  const [estadoAgente, setEstadoAgente] = useState<Record<string, EstadoAgente>>({});
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [menu, setMenu] = useState<"canais" | "config" | "convidar" | "sino" | null>(null);
  // #396 (D): abas do seletor (dividem o espaço, não misturam) + convites da aba Privado
  const [aba, setAba] = useState<Aba>("turma");
  const [convites, setConvites] = useState<Convites>(SEM_CONVITES);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  // #423: sino — a lista que ele mostra e a bolinha. #425: o "visto" e o "Limpar" ficam no BANCO (CanalSino),
  // não no navegador: vêm junto com os convites e valem em qualquer aparelho.
  const [limpandoSino, setLimpandoSino] = useState(false);
  const itensSino = useMemo(() => montarSino(convites), [convites]);
  const contadorSino = contadorDoSino(convites, convites.sino.vistoEm);
  const gravarSino = useCallback(async (acao: AcaoSino) => {
    const r = await fetch("/api/canal/sino", { method: "POST", headers: H, body: JSON.stringify({ acao }) }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    return (j?.sino as EstadoSino | undefined) ?? null;
  }, []);
  const alternarSino = () => {
    const abrir = menu !== "sino";
    setMenu(abrir ? "sino" : null);
    if (!abrir) return;
    // abriu o sino = viu as respostas; a bolinha passa a contar só os pendentes e o que chegar depois.
    // Na tela já apaga na hora; o banco guarda pra próxima vez (e pros outros aparelhos).
    setConvites((c) => ({ ...c, sino: { ...c.sino, vistoEm: Date.now() } }));
    void gravarSino("visto").then(() => carregarConvites());
  };
  const limparSino = async () => {
    setLimpandoSino(true);
    try {
      const sino = await gravarSino("limpar");
      if (!sino) { setErro("Não deu pra limpar as notificações."); return; }
      // some com o que já foi respondido; os pendentes continuam (recebidos/enviados)
      setConvites((c) => ({ ...c, historico: [], sino }));
      void carregarConvites();
    } finally { setLimpandoSino(false); }
  };
  const [novoTitulo, setNovoTitulo] = useState("");
  const [apagando, setApagando] = useState<string | null>(null);
  const [agendaAberta, setAgendaAberta] = useState(false);
  const [agendaVersao, setAgendaVersao] = useState(0);
  const [emailConvite, setEmailConvite] = useState("");
  const [sugIdx, setSugIdx] = useState(0);
  // A− / A+ do texto das mensagens: a MESMA escolha do chat das salas de estudo e pesquisa (por aparelho).
  const zoom = useChatFontScale();

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

  // ─── #423: "fulano está digitando" (pessoas) — recebe, some sozinho no prazo, e avisa enquanto eu escrevo ───
  const [pessoasDigitando, setPessoasDigitando] = useState<Digitando>({});
  const ultimoAvisoDigitando = useRef<number | null>(null);
  useEffect(() => {
    if (!Object.keys(pessoasDigitando).length) return;
    const t = setInterval(() => setPessoasDigitando((p) => podarDigitando(p, Date.now())), 1000);
    return () => clearInterval(t);
  }, [pessoasDigitando]);
  /** Avisa os outros no máximo a cada poucos segundos (lib/canal/presenca), nunca a cada tecla. Falhar não atrapalha. */
  const avisarDigitando = (valor: string) => {
    const id = ativoRef.current, agora = Date.now();
    if (!id || !deveAvisarDigitando(ultimoAvisoDigitando.current, agora, valor)) return;
    ultimoAvisoDigitando.current = agora;
    void fetch(`/api/canal/${id}/digitando`, { method: "POST" }).catch(() => undefined);
  };

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
    if (!r.ok) {
      // sem acesso a ESTE canal (o dono mudou o acesso, tirou a pessoa…): some da lista e abre o próximo — a tela
      // nunca trava num canal fechado (o seletor, os convites e os outros canais continuam ao alcance)
      if (r.status === 403 || r.status === 404) {
        const resto = canaisRef.current.filter((c) => c.id !== id);
        setCanais(resto);
        try { if (localStorage.getItem(LS_ULTIMO) === id) localStorage.removeItem(LS_ULTIMO); } catch { /* ignore */ }
        if (resto.length) setAtivoId(resto[0]!.id); else setErro("403");
      }
      return;
    }
    const d: Detalhe = await r.json();
    meuIdRef.current = d.eu.id;
    const nome = d.eu.nome || "";
    meusAliases.current = [nome, nome.split(/\s+/)[0] ?? ""].filter(Boolean);
    setDet(d);
    setDigitando([]);
    setEstadoAgente({});
    setPessoasDigitando({});
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
      // alguém marcou/apagou horário na agenda deste canal → a bandeja (se aberta) recarrega
      ch.bind(EV_AGENDA, () => { if (c.id === ativoRef.current) setAgendaVersao((v) => v + 1); });
      ch.bind(EV_DIGITANDO, (d: { agentKey: string; estado: string }) => {
        if (c.id !== ativoRef.current) return;
        // estado em palavras (pesquisando, investigando, em descanso…); valor desconhecido = "digitando"
        const est = normalizarEstado(d.estado);
        setEstadoAgente((m) => ({ ...m, [d.agentKey]: est }));
        setDigitando((prev) => (estaAtivo(est) ? [...new Set([...prev, d.agentKey])] : prev.filter((k) => k !== d.agentKey)));
      });
      // #423: uma PESSOA está digitando neste canal (o meu próprio aviso não aparece pra mim)
      ch.bind(EV_HUMANO_DIGITANDO, (d: { userId: string; nome: string }) => {
        if (c.id !== ativoRef.current || !d?.userId || d.userId === meuIdRef.current) return;
        setPessoasDigitando((prev) => ({ ...prev, [d.userId]: { nome: d.nome || "Alguém", ate: Date.now() + TTL_DIGITANDO_MS } }));
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
      // a mensagem da pessoa chegou: ela parou de "digitar"
      if (m.autorTipo === "humano") setPessoasDigitando((prev) => { if (!(m.autorId in prev)) return prev; const n = { ...prev }; delete n[m.autorId]; return n; });
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
      // Quem vai responder = os `turnos` do servidor: as @menções OU, sem @, o último agente do canal.
      const alvos: string[] = Array.isArray(j.turnos) ? j.turnos.map((t: { agentKey: string }) => t.agentKey) : (m.mencoes ?? []);
      for (const k of alvos) meusAgentes.current.add(k);
      if (alvos.length) {
        setDigitando((prev) => [...new Set([...prev, ...alvos])]);
        // um "em descanso" antigo não pode aparecer como o balão de "escrevendo" do novo turno
        setEstadoAgente((m) => ({ ...m, ...Object.fromEntries(alvos.map((k) => [k, "digitando" as EstadoAgente])) }));
      }
      setDet((d) => (d && !d.mensagens.some((x) => x.id === m.id) ? { ...d, mensagens: [...d.mensagens, m] } : d));
      setTexto("");
      ultimoAvisoDigitando.current = null; // a próxima mensagem volta a avisar na primeira tecla
      setErro(null);
      // agentes recém-convocados passam a constar no canal
      if (alvos.length) setCanais((cs) => cs.map((c) => (c.id === ativoId ? { ...c, agentes: [...new Set([...c.agentes, ...alvos])] } : c)));
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

  // ─── convites (#396, item D) ───
  const carregarConvites = useCallback(async () => {
    try {
      const r = await fetch("/api/canal/convites", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setConvites({ recebidos: j.recebidos ?? [], enviados: j.enviados ?? [], contatos: j.contatos ?? [], historico: j.historico ?? [], sino: j.sino ?? SEM_CONVITES.sino });
    } catch { /* sem convites não trava o escritório */ }
  }, []);
  useEffect(() => { if (canais.length) void carregarConvites(); }, [canais.length, carregarConvites]);
  // a aba acompanha o canal aberto (ex.: aceitou um convite → vai pro Privado)
  useEffect(() => {
    const c = canaisRef.current.find((x) => x.id === ativoId);
    if (c) setAba(abaDoCanal(c));
  }, [ativoId]);

  const enviarConvite = useCallback(async (para: string): Promise<{ ok: boolean; msg: string }> => {
    try {
      const r = await fetch("/api/canal/convites", { method: "POST", headers: H, body: JSON.stringify({ para }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 201) { void carregarConvites(); return { ok: true, msg: `Convite enviado para ${j?.convite?.pessoa?.nome || para}.` }; }
      if (r.ok && j?.jaContatos) return { ok: true, msg: "Vocês já são contatos — a conversa está na aba Privado." };
      return { ok: false, msg: j?.error || `Não deu pra convidar (${r.status}).` };
    } catch (e) {
      return { ok: false, msg: String((e as Error)?.message ?? e) };
    }
  }, [carregarConvites]);

  const responderConvite = useCallback(async (id: string, acao: "aceitar" | "recusar") => {
    setRespondendo(id);
    try {
      const r = await fetch(`/api/canal/convites/${id}`, { method: "POST", headers: H, body: JSON.stringify({ acao }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j?.error || `Não deu pra responder (${r.status})`); return; }
      if (acao === "aceitar" && j?.canal?.id) {
        const novo: Canal = j.canal;
        setCanais((cs) => (cs.some((c) => c.id === novo.id) ? cs : [novo, ...cs]));
        setAba("privado");
        setAtivoId(novo.id);
        setMenu(null);
      }
      setErro(null);
      void carregarConvites();
    } finally {
      setRespondendo(null);
    }
  }, [carregarConvites]);

  // ─── ações do canal ───
  const criarCanal = async () => {
    const titulo = novoTitulo.trim();
    if (!titulo) return;
    // o canal novo nasce na aba em que você está (privado = só seu; turma; aberto)
    const r = await fetch("/api/canal", { method: "POST", headers: H, body: JSON.stringify({ titulo, acesso: aba, agentes: ["aura"] }) });
    if (!r.ok) return;
    const c: Canal = (await r.json()).canal;
    setCanais((cs) => [c, ...cs]);
    setNovoTitulo(""); setMenu(null); setAtivoId(c.id);
  };
  // Apaga um escritório (só o dono; a rota DELETE já existe). Pede confirmação, atualiza a lista e abre
  // outro canal; se não sobrar nenhum, recria o primeiro (a sala nunca fica vazia). Regras em lib/canal/seletor.
  const apagarCanal = async (c: Canal) => {
    if (!podeApagar(c) || apagando) return;
    if (!window.confirm(textoConfirmarApagar(c.titulo))) return;
    setApagando(c.id);
    try {
      const r = await fetch(`/api/canal/${c.id}`, { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErro(j?.error || `Não deu pra apagar (${r.status})`);
        return;
      }
      try { pusherRef.current?.unsubscribe(canalChannel(c.id)); pusherRef.current?.unsubscribe(presenceChannel(c.id)); } catch { /* ignore */ }
      const depois = aposApagar(canais, c.id, ativoId);
      setCanais(depois.restantes);
      setNaoLidas((n) => { const resto = { ...n }; delete resto[c.id]; return resto; });
      try { if (localStorage.getItem(LS_ULTIMO) === c.id) localStorage.removeItem(LS_ULTIMO); } catch { /* ignore */ }
      setErro(null);
      setMenu(null);
      if (depois.proximoAtivo) {
        if (depois.eraAtivo) setAtivoId(depois.proximoAtivo);
      } else {
        const n = await fetch("/api/canal", { method: "POST", headers: H, body: JSON.stringify({ titulo: "Meu escritório", acesso: "turma", agentes: ["aura"], primeiro: true }) });
        if (n.ok) {
          const novo: Canal = (await n.json()).canal;
          setCanais([novo]);
          setAtivoId(novo.id);
        }
      }
    } catch (e) {
      setErro(String((e as Error)?.message ?? e));
    } finally {
      setApagando(null);
    }
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
    // Seam: avisa quem renderiza a cartolina (LoungeCartolina na aba "lounge", PR #152) e leva pra lá.
    try {
      window.dispatchEvent(new CustomEvent("zaeon:cartolina:abrir", { detail: { id, canalId: ativoId } }));
      window.dispatchEvent(new CustomEvent("zaeon:set-tab", { detail: "lounge" }));
    } catch { /* ignore */ }
  };

  // ─── render ───
  if (erro === "off") return <Vazio texto="O escritório coworking ainda não está ligado neste ambiente." />;
  if (carregando) return <Vazio texto="Abrindo o escritório…" />;
  if (!ativoId || !det) return <Vazio texto={erro === "403" ? "Você não tem acesso a este canal." : "Abrindo o canal…"} />;

  const canal = det.canal;
  const meuId = det.eu.id;
  // Perfis no topo: dono + membros + você, e quem estiver online mesmo sem ser membro (canal aberto).
  // na conversa privada o "outro lado" (dmCom) também aparece no topo
  const topo = montarTopoPessoas({ pessoas: det.pessoas, online, donoId: canal.ownerId, meuId, membros: canal.dmCom ? [...canal.membros, canal.dmCom] : canal.membros });
  const daAba = filtrarPorAba(canais, aba);
  // contatos (convite aceito) que ainda não estão neste canal → dá pra pôr com um toque no ⚙︎
  const contatosFora = convites.contatos.filter((c) => c.pessoa.id !== canal.ownerId && !canal.membros.includes(c.pessoa.id));
  // Sem @, responde o último agente que falou. A dica só aparece em canal de uma pessoa: com mais
  // gente, o servidor só atende quem estava conversando com o agente (lib/canal/alvo.ts).
  const ultimoAgente = [...det.mensagens].reverse().find((m) => m.autorTipo === "agente" && !m.id.startsWith("efemera-"))?.autorId;
  const agenteAtivo = canal.membros.length === 0 ? agentes.find((a) => a.agentKey === ultimoAgente) ?? null : null;
  const presentes = agentes.filter((a) => canal.agentes.includes(a.agentKey));
  const outros = agentes.filter((a) => !canal.agentes.includes(a.agentKey));

  return (
    <div className="w-full h-full min-h-0 flex flex-col p-2 sm:p-4" style={zoom.style}>
      <div className={`relative flex-1 min-h-0 flex flex-col rounded-[28px] overflow-hidden ${VIDRO_PAINEL}`}>
        {/* agenda semanal do canal: bandeja por cima da conversa (#396) */}
        <AgendaBandeja canalId={ativoId} aberta={agendaAberta} onFechar={() => setAgendaAberta(false)} versao={agendaVersao} />
        {/* barra: agenda · canal · presença · cartolina · config */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/50 dark:border-white/[0.08]">
          {/* à esquerda do seletor: abre a agenda da semana */}
          <button type="button" onClick={() => { setAgendaAberta((v) => !v); setMenu(null); }} aria-label="Agenda da semana" aria-expanded={agendaAberta}
            title="Agenda da semana" className={`${TOQUE} rounded-2xl text-[15px] ${VIDRO_CHIP} ${TXT}`}>🗓</button>
          <div className="relative">
            <button type="button" onClick={() => { const abrir = menu !== "canais"; setMenu(abrir ? "canais" : null); if (abrir) void carregarConvites(); }} className={`${TOQUE} px-3 rounded-2xl text-[13px] font-bold ${TXT} ${VIDRO_CHIP} flex items-center gap-2`} aria-haspopup="listbox" aria-expanded={menu === "canais"}>
              <span className="max-w-[40vw] sm:max-w-[260px] truncate">{canal.titulo}</span>
              <span aria-hidden className={`text-[10px] ${TXT_MUDO}`}>▾</span>
              {totalNaoLidas - (naoLidas[ativoId] ?? 0) > 0 && <Badge n={totalNaoLidas - (naoLidas[ativoId] ?? 0)} />}
            </button>
            {menu === "canais" && (
              <div className={`absolute left-0 top-full mt-1.5 z-30 w-[min(92vw,340px)] p-1.5 rounded-2xl ${VIDRO_POPOVER}`}>
                {/* as três abas dividem o mesmo espaço; cada uma mostra só os canais dela */}
                <div className="flex gap-1 p-1" role="tablist" aria-label="Tipo de escritório">
                  {ABAS.map((a) => (
                    <button key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => setAba(a)}
                      className={`flex-1 min-h-[36px] rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 ${aba === a ? `bg-blue-500/20 dark:bg-blue-400/20 ${TXT}` : `${VIDRO_CHIP} ${TXT_2}`}`}>
                      {NOME_ABA[a]}
                    </button>
                  ))}
                </div>
                <div role="listbox" aria-label={`Escritórios · ${NOME_ABA[aba]}`}>
                {daAba.length === 0 && (
                  <p className={`px-3 py-2 text-[12px] ${TXT_MUDO}`}>
                    {aba === "privado" ? "Nenhuma conversa privada ainda. Use o + ao lado do seletor pra convidar alguém." : `Nenhum escritório de ${NOME_ABA[aba].toLowerCase()} ainda.`}
                  </p>
                )}
                {daAba.map((c) => (
                  <div key={c.id} className="flex items-center gap-1">
                    <button type="button" role="option" aria-selected={c.id === ativoId} onClick={() => { setAtivoId(c.id); setMenu(null); }}
                      className={`flex-1 min-w-0 ${TOQUE} flex items-center justify-between gap-2 px-3 rounded-xl text-left text-[13px] ${c.id === ativoId ? `bg-blue-500/15 dark:bg-blue-400/15 ${TXT}` : `${TXT_2} hover:bg-slate-500/10 dark:hover:bg-white/10`}`}>
                      <span className="truncate font-medium">{c.titulo}</span>
                      {naoLidas[c.id] ? <Badge n={naoLidas[c.id]!} /> : null}
                    </button>
                    {/* só o dono apaga (a rota também recusa não-dono); pede confirmação antes */}
                    {podeApagar(c) && (
                      <button type="button" onClick={() => void apagarCanal(c)} disabled={apagando === c.id}
                        aria-label={`Apagar o escritório ${c.titulo}`} title="Apagar este escritório"
                        className={`${TOQUE} w-10 shrink-0 rounded-xl text-[14px] ${TXT_MUDO} hover:text-rose-500 dark:hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-40`}>🗑</button>
                    )}
                  </div>
                ))}
                </div>
                {/* #423: os convites saíram daqui e foram pro sino */}
                <div className="mt-1 flex gap-1.5 p-1">
                  <input value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void criarCanal(); }} placeholder={`novo escritório (${NOME_ABA[aba].toLowerCase()})`} aria-label="Nome do novo canal"
                    className={`flex-1 min-h-[40px] px-3 rounded-xl text-[13px] bg-white/70 dark:bg-white/[0.06] border border-white/60 dark:border-white/10 ${TXT} placeholder:text-slate-400 dark:placeholder:text-white/35 outline-none focus:border-blue-400/70`} />
                  <button type="button" onClick={() => void criarCanal()} className={`min-h-[40px] px-3 rounded-xl text-[12px] font-bold ${VIDRO_CHIP} ${TXT}`}>+</button>
                </div>
              </div>
            )}
          </div>

          {/* #423: sino de notificações (por enquanto só convites, com o status de cada um), entre o seletor e o + */}
          <SinoConvites itens={itensSino} contador={contadorSino} aberto={menu === "sino"} onAlternar={alternarSino}
            ocupado={respondendo} onResponder={(id, acao) => void responderConvite(id, acao)}
            onLimpar={() => void limparSino()} limpando={limpandoSino} />

          {/* #423: "+" (convidar) à ESQUERDA, depois do sino; abre NA HORIZONTAL, ao lado do botão.
              O convite cai no sino da pessoa. */}
          <div className="flex items-center gap-1.5 min-w-0">
            <button type="button" onClick={() => setMenu(menu === "convidar" ? null : "convidar")} aria-label="Convidar pessoa" aria-expanded={menu === "convidar"}
              title="Convidar pessoa" className={`${TOQUE} shrink-0 rounded-full text-[18px] font-bold leading-none ${VIDRO_CHIP} ${TXT}`}>+</button>
            {menu === "convidar" && <ConvidarForm onEnviar={enviarConvite} variante="linha" onFechar={() => setMenu(null)} />}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {/* pessoas do canal (dono, membros e você), com espaço entre as fotos (#423). Os agentes ficam embaixo. */}
            <PessoasTopo visiveis={topo.visiveis} extras={topo.extras} onlineIds={topo.onlineIds} total={topo.total} />
            {online.length > 0 && <span className={`text-[11px] ${TXT_MUDO}`} title="online agora">{online.length} on</span>}
            {canal.cartolinaId && (
              <button type="button" onClick={abrirCartolina} className={`${TOQUE} px-3 rounded-2xl text-[12px] font-bold ${VIDRO_CHIP} ${TXT}`} title="Abrir a cartolina da sala">▦ cartolina</button>
            )}
            {canal.souDono && (
              <div className="relative">
                <button type="button" onClick={() => setMenu(menu === "config" ? null : "config")} className={`${TOQUE} rounded-2xl text-[14px] ${VIDRO_CHIP} ${TXT}`} aria-label="Configurar canal" aria-expanded={menu === "config"}>⚙︎</button>
                {menu === "config" && (
                  <div className={`absolute right-0 top-full mt-1.5 z-30 w-[min(92vw,320px)] p-3 rounded-2xl flex flex-col gap-3 ${VIDRO_POPOVER}`}>
                    {canal.dmCom ? (
                      <p className={`text-[12px] ${TXT_2}`}>Conversa privada: só vocês dois veem. Ela não muda de acesso nem recebe outras pessoas.</p>
                    ) : (<>
                    <div className="flex gap-1" role="radiogroup" aria-label="Quem o agente atende">
                      {(["privado", "turma", "aberto"] as const).map((a) => (
                        <button key={a} type="button" role="radio" aria-checked={canal.acesso === a} onClick={() => void patch({ acesso: a })}
                          className={`flex-1 min-h-[40px] rounded-xl text-[12px] font-bold ${canal.acesso === a ? `bg-blue-500/20 dark:bg-blue-400/20 ${TXT}` : `${VIDRO_CHIP} ${TXT_2}`}`}>{a}</button>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input value={emailConvite} onChange={(e) => setEmailConvite(e.target.value)} placeholder="e-mail de um contato (já aceitou)" aria-label="Adicionar membro por e-mail" type="email"
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
                    {/* contatos (convite aceito) que ainda não estão aqui: um toque e entram */}
                    {contatosFora.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <p className={`text-[10.5px] font-bold uppercase tracking-wider ${TXT_MUDO}`}>Seus contatos</p>
                        <div className="flex flex-wrap gap-1.5">
                          {contatosFora.map((c) => (
                            <button key={c.pessoa.id} type="button" onClick={() => void patch({ adicionarMembro: c.pessoa.id })} aria-label={`Pôr ${c.pessoa.nome} neste escritório`}
                              className={`min-h-[32px] pl-1 pr-2.5 rounded-full flex items-center gap-1.5 text-[12px] font-semibold ${VIDRO_CHIP} ${TXT}`}>
                              <AgentAvatar src={c.pessoa.avatar} nome={c.pessoa.nome} size={22} /> + {c.pessoa.nome}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    </>)}
                    <input defaultValue={canal.cartolinaId ?? ""} placeholder="id da cartolina (opcional)" aria-label="Cartolina compartilhada"
                      onBlur={(e) => { const v = e.target.value.trim(); if (v !== (canal.cartolinaId ?? "")) void patch({ cartolinaId: v || null }); }}
                      className={`min-h-[40px] px-3 rounded-xl text-[12px] font-mono bg-white/70 dark:bg-white/[0.06] border border-white/60 dark:border-white/10 ${TXT} placeholder:text-slate-400 dark:placeholder:text-white/35 outline-none focus:border-blue-400/70`} />
                  </div>
                )}
              </div>
            )}
            {/* zoom das letras, no canto superior direito (igual ao chat das salas) */}
            <ChatZoom escala={zoom.escala} menor={zoom.menor} maior={zoom.maior} />
          </div>
        </div>

        {/* mensagens */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 sm:px-5 py-4 flex flex-col gap-3" onClick={() => setMenu(null)}>
          {det.mensagens.map((m) => (m.autorTipo === "sistema"
            ? <LinhaSistema key={m.id} texto={m.texto} hora={hora(m.createdAt)} /> // #423: "fulano entrou no escritório"
            : <Bolha key={m.id} m={m} minha={m.autorTipo === "humano" && m.autorId === meuId} aliases={aliases} />))}
          {digitando.map((k) => {
            const a = agentes.find((x) => x.agentKey === k);
            return (
              <div key={`dig-${k}`} className="flex items-end gap-2">
                <AgentAvatar src={a?.avatarUrl} nome={a?.nome ?? k} size={30} emoji={a?.emoji} agentId={k} estado="falando" />
                <div className={`px-3.5 py-2.5 rounded-2xl rounded-bl-md ${VIDRO_BOLHA} ${TXT_MUDO} text-[13px]`}>
                  <span className="font-semibold">{a?.nome ?? k}</span> {frase(estadoAgente[k] ?? "digitando") || "está escrevendo"}<span className="animate-pulse">…</span>
                </div>
              </div>
            );
          })}
          {/* #425: as PESSOAS digitando, em balão igual ao dos agentes (foto + três pontinhos, sem texto) */}
          <AvisoDigitando pessoas={quemDigita(pessoasDigitando, det.pessoas)} />
          <div ref={fimRef} />
        </div>

        {/* input (fixo, safe-area) */}
        <div className={`relative px-2 sm:px-3 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] ${VIDRO_INPUT}`}>
          {aberta && sugestoes.length > 0 && (
            <div role="listbox" className={`absolute left-3 bottom-full mb-1.5 z-30 w-[min(92vw,300px)] p-1.5 rounded-2xl ${VIDRO_POPOVER}`}>
              {sugestoes.map((a, i) => (
                <button key={a.agentKey} type="button" role="option" aria-selected={i === sugIdx} onMouseDown={(e) => { e.preventDefault(); completar(a); }}
                  className={`w-full ${TOQUE} flex items-center gap-2.5 px-3 rounded-xl text-left ${i === sugIdx ? `bg-blue-500/15 dark:bg-blue-400/15 ${TXT}` : `${TXT_2} hover:bg-slate-500/10 dark:hover:bg-white/10`}`}>
                  <AgentAvatar src={a.avatarUrl} nome={a.nome} size={26} emoji={a.emoji} agentId={a.agentKey} vivo={false} />
                  <span className="flex flex-col min-w-0"><span className="text-[13px] font-semibold truncate">{a.nome}</span><span className={`text-[11px] truncate ${TXT_MUDO}`}>@{a.agentKey}{a.curso ? ` · ${a.curso}` : ""}</span></span>
                </button>
              ))}
            </div>
          )}
          {/* agentes convocáveis: presentes no canal + os meus contratados (toque = @) */}
          {(presentes.length > 0 || outros.length > 0) && (
            <div className="flex gap-1.5 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[...presentes, ...outros].map((a) => (
                <button key={a.agentKey} type="button" onClick={() => prefixarAgente(a.agentKey)}
                  title={estadoAgente[a.agentKey] === "descanso" ? rotulo(a.nome, "descanso") : `@${a.agentKey}${a.curso ? ` · ${a.curso}` : ""}`}
                  className={`shrink-0 min-h-[36px] pl-1 pr-2.5 rounded-full flex items-center gap-1.5 text-[12px] font-semibold ${VIDRO_CHIP} ${canal.agentes.includes(a.agentKey) ? TXT : TXT_MUDO} ${estadoAgente[a.agentKey] === "descanso" ? "opacity-60" : ""}`}>
                  <AgentAvatar src={a.avatarUrl} nome={a.nome} size={26} emoji={a.emoji} agentId={a.agentKey} estado={digitando.includes(a.agentKey) ? "falando" : "idle"} className={digitando.includes(a.agentKey) ? "ring-2 ring-cyan-400/80" : ""} />
                  {a.nome}
                  {estadoAgente[a.agentKey] === "descanso" && <span className={`text-[10px] font-medium ${TXT_MUDO}`}>em descanso</span>}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={texto}
              rows={1}
              onChange={(e) => { setTexto(e.target.value); setCaret(e.target.selectionStart ?? e.target.value.length); avisarDigitando(e.target.value); }}
              onKeyUp={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
              onClick={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
              onKeyDown={aoTeclar}
              placeholder={agenteAtivo ? `Mensagem · ${agenteAtivo.nome} responde · @ troca de agente` : "Mensagem · @agente convoca"}
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

/** o texto do agente antes do markdown: negrito VAZIO ("****") some e o negrito-itálico (***x***) vira negrito — nada de
 *  asteriscos soltos na conversa */
export const limparMarkdownDoAgente = (t: string) => t.replace(/\*{3}([^*\n]+?)\*{3}/g, "**$1**").replace(/\*{4,}/g, "");

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
        <div className={`px-3.5 py-2.5 rounded-2xl ${minha ? `rounded-br-md ${VIDRO_BOLHA_MINHA}` : `rounded-bl-md ${VIDRO_BOLHA}`} ${TXT} leading-relaxed break-words ${m.autorTipo === "agente" ? "" : "whitespace-pre-wrap"}`} style={{ fontSize: fonteChat(14) }}>
          {/* o AGENTE responde em markdown (o mesmo do chat): sem isso o **negrito** aparecia como "****" */}
          {m.autorTipo === "agente" ? <ChatMarkdown text={limparMarkdownDoAgente(m.texto)} /> : partes.map((p, i) => {
            const alvo = p.startsWith("@") ? aliases.get(p.slice(1).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()) : null;
            return alvo ? <span key={i} className="font-bold text-blue-700 dark:text-cyan-300">{p}</span> : <span key={i}>{p}</span>;
          })}
        </div>
        <span className={`px-1 mt-0.5 text-[10px] ${TXT_MUDO}`}>{hora(m.createdAt)}</span>
      </div>
    </div>
  );
}
