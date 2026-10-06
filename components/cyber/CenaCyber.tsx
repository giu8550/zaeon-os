"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LAB_ENTRADA, MSG_ENTRAR_ESTUDO, ehMsgEntrarEstudo } from "@/lib/ui/loungeHub";
import { detectarPerfil, precisaGirar, qualidadeDe } from "@/lib/cyber/dispositivo";
import { PREF_SFX, PREF_VOLUME, lerPrefs } from "@/lib/cyber/audio";
import { tocarUI } from "./AudioCyber";
import { MAX_TEXTO_RECADO, type MensagemChat, type Presenca, type RecadoQG } from "@/lib/lounge3d/tipos";
import { landmarksOn, type POI } from "@/lib/cyber/landmarks";
import { CyberEngine, type PessoaCyber } from "./engine";
import { criarVoz, type VozHandle } from "./Voz";
import { transporteRealtime, vozLigada } from "@/lib/lounge3d/realtime";
import { ehTeclaFalar } from "@/lib/cyber/voz";
import type { CanalVoz } from "@/components/lounge/salaColyseus";
import Joystick from "./Joystick";
import ControlesVoo from "./ControlesVoo";
import TocaDiscos, { type ApiMusica } from "./TocaDiscos";
import type { SomLounge } from "@/lib/lounge3d/musica";

export type CenaCyberProps = {
  /** "janela": prévia na landing (começa no menu, sem rede). "tela": cyberespaço inteiro (já em play, com a sala). */
  modo: "janela" | "tela";
  eu: PessoaCyber;
  membros: PessoaCyber[];
  remotos?: { current: Map<string, Presenca> };
  enviarPos?: (p: { x: number; z: number; facing: number; moving: boolean; sit: boolean }) => void;
  chat?: MensagemChat[];
  enviarChat?: (texto: string) => Promise<void> | void;
  /** só o dono da sala tem o token → só ele convida. */
  tokenConvite?: string | null;
  online?: number;
  /** aviso de rede ("tempo real indisponível", "sala cheia"…). */
  aviso?: string | null;
  onSessaoIniciada?: () => void;
  /** dono da Zaeon (vem do SERVIDOR) — só pinta os botões; quem decide é `pedirAcesso` */
  souFundador?: boolean;
  /** AÇÃO PRIVILEGIADA: pede ao servidor pra subir ao topo da Zaeon (POST /api/lounge3d/[id]/topo) */
  pedirAcesso?: (alvo: "topo" | "ceu" | "nave") => Promise<{ ok: boolean; erro?: string }>;
  /** o recado ATUAL do dono pro QG do Andrei (holograma ao lado da tela dele; a TV do lounge mostra o último enviado) */
  recadoQG?: RecadoQG | null;
  /** o DONO manda (texto) ou apaga (null) o recado — o servidor confere a sessão */
  enviarRecado?: (texto: string | null) => Promise<{ ok: boolean; erro?: string }>;
  /** o TOCA-DISCOS do lounge da Zaeon: a playlist/estado da sala, a diferença de relógio (servidor − cliente) e as
   *  ações do dono (subir/controlar/tirar) + a URL de cada música */
  somLounge?: SomLounge | null;
  offsetMusica?: number;
  musica?: (ApiMusica & { urlDe(arq: string): string }) | null;
  /** VOZ (push-to-talk, NEXT_PUBLIC_VOZ=on + colyseus): o signaling da room e quem está online (userIds) */
  canalVoz?: CanalVoz | null;
  onlineIds?: string[];
};


export default function CenaCyber(p: CenaCyberProps) {
  const router = useRouter();
  const tela = p.modo === "tela";
  const cont = useRef<HTMLDivElement>(null), overlay = useRef<HTMLDivElement>(null);
  const monLabel = useRef<HTMLDivElement>(null);
  const engine = useRef<CyberEngine | null>(null);
  const [pronto, setPronto] = useState(false), [perto, setPerto] = useState(false), [menu, setMenu] = useState(!tela);
  const [falandoCom, setFalandoCom] = useState<string | null>(null), [abrindo, setAbrindo] = useState(false), [copiado, setCopiado] = useState(false);
  const [rota, setRota] = useState<"heliporto" | "qg" | "zaeon" | null>(null);
  const [voo, setVoo] = useState<{ y: number } | null>(null);
  /** a AÇÃO de contexto (o que o F faz agora) — o chip "F · Estudar" etc.; no celular, tocar no chip faz a ação */
  const [acao, setAcao] = useState<{ rotulo: string } | null>(null);
  const [qg, setQg] = useState({ noCeu: false, navePerto: false, pilotando: false, pousado: true, moto: false, motoPerto: false }), [fade, setFade] = useState(false), [aviso2, setAviso2] = useState<string | null>(null);
  const avisar = useCallback((m: string) => { setAviso2(m); setTimeout(() => setAviso2((x) => (x === m ? null : x)), 3500); }, []);
  /** corte com fade (portal: sem animação de viagem) */
  const comFade = useCallback((acao: () => void) => { setFade(true); setTimeout(() => { acao(); setTimeout(() => setFade(false), 260); }, 360); }, []);
  /** ação privilegiada: pergunta ao SERVIDOR antes (cb sempre fresco via ref) */
  const pedir = useCallback(async (alvo: "topo" | "ceu" | "nave", ok: () => void) => {
    const fn = cb.current.pedirAcesso;
    if (!cb.current.souFundador || !fn) { avisar(alvo === "ceu" ? "A Zaeon é a base do dono — o portal não abre pra você." : alvo === "nave" ? "Só o dono pilota a nave." : "Só o dono sobe ao topo."); return; }
    try { const r = await fn(alvo); if (r.ok) ok(); else avisar(r.erro ?? "Não autorizado."); } catch { avisar("Sem conexão."); }
  }, [avisar]);
  const [poiAberto, setPoiAberto] = useState<POI | null>(null), [noTopo, setNoTopo] = useState(false), [subindo, setSubindo] = useState(false), [erroTopo, setErroTopo] = useState<string | null>(null);
  const [correndo, setCorrendo] = useState(false), [txt, setTxt] = useState(""), [falha, setFalha] = useState(false);
  // som: liga/desliga (`zaeon_sfx`) + volume mestre (`zaeon_volume`), lidos/gravados no localStorage
  const [som, setSom] = useState(() => (typeof window === "undefined" ? { ligado: true, volume: 0.8 } : lerPrefs((k) => { try { return localStorage.getItem(k); } catch { return null; } })));
  const [painelSom, setPainelSom] = useState(false);
  // RECADO pro QG: a caixa abre ao clicar na TV do lounge da Zaeon (só o dono)
  // VOZ: segurar G (ou o botão no celular) = falar
  const voz = useRef<VozHandle | null>(null), [falandoEu, setFalandoEu] = useState(false);
  const comVoz = tela && vozLigada() && !!p.canalVoz;
  const [somAberto, setSomAberto] = useState(false);
  const [recadoAberto, setRecadoAberto] = useState(false), [recadoTxt, setRecadoTxt] = useState(""), [recadoEnviando, setRecadoEnviando] = useState(false);
  const mudarSom = (n: { ligado: boolean; volume: number }) => {
    setSom(n);
    try { localStorage.setItem(PREF_SFX, n.ligado ? "1" : "0"); localStorage.setItem(PREF_VOLUME, String(n.volume)); } catch { /* storage bloqueado */ }
    engine.current?.aplicarPrefsSom();
  };
  const touch = useMemo(() => typeof window !== "undefined" && (matchMedia("(pointer:coarse)").matches || "ontouchstart" in window), []);
  // ONDE está rodando (celular × desktop, aparelho fraco) → capas de efeito só onde precisa (lib/cyber/dispositivo)
  const perfil = useMemo(() => typeof window === "undefined" ? { movel: false, leve: false, fraco: false } : detectarPerfil({
    coarse: matchMedia("(pointer: coarse)").matches, toques: navigator.maxTouchPoints || 0, ua: navigator.userAgent, largura: innerWidth, altura: innerHeight,
    memoriaGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory, nucleos: navigator.hardwareConcurrency || undefined,
  }), []);
  const qualidade = useMemo(() => qualidadeDe(perfil), [perfil]);
  const low = qualidade.leve;
  // celular: o cyberespaço é NA HORIZONTAL — em pé, pede pra girar e pausa a cena
  const [girar, setGirar] = useState(false);
  useEffect(() => {
    if (!tela) return;
    const ver = () => setGirar(precisaGirar(perfil, innerWidth, innerHeight));
    ver(); window.addEventListener("resize", ver); window.addEventListener("orientationchange", ver);
    return () => { window.removeEventListener("resize", ver); window.removeEventListener("orientationchange", ver); };
  }, [tela, perfil]);
  useEffect(() => { engine.current?.pausar(girar); }, [girar, pronto]);
  /** Android: tela cheia + trava na horizontal (precisa de gesto do usuário); no iPhone só girar resolve */
  const telaCheiaHorizontal = useCallback(async () => {
    try { await document.documentElement.requestFullscreen?.({ navigationUI: "hide" }); } catch { /* sem tela cheia */ }
    try { await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape"); } catch { /* sem trava (iOS) */ }
  }, []);

  // callbacks sempre frescos sem recriar a engine
  const cb = useRef(p); cb.current = p;
  // contrato: a intenção sai como postMessage({type:"zaeon:enter-study"}) (mesma origem) → router.push("/research-lab?tab=pesquisa")
  const entrarEstudo = useCallback(() => { window.postMessage({ type: MSG_ENTRAR_ESTUDO }, window.location.origin); }, []);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!ehMsgEntrarEstudo(e.data, e.origin, window.location.origin)) return;
      // O cyberespaço é pesado (WebGL + GLB): ao ir estudar ele é DESMONTADO já — nada de ficar vivo no background.
      tocarUI("study-confirm");   // som de UI fora da cena (ela some já já)
      engine.current?.dispose(); engine.current = null;
      setAbrindo(true);
      router.push(LAB_ENTRADA);   // primeira tela do laboratório = aba de Pesquisa
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [router]);

  useEffect(() => {
    if (!cont.current || !overlay.current) return;
    let cancelado = false, e: CyberEngine | null = null;
    CyberEngine.criar({
      container: cont.current, overlay: overlay.current, els: { menu: null, hold: null, monLabel: monLabel.current },
      eu: cb.current.eu, membros: cb.current.membros, menu: !tela, low, qualidade, teclasSempre: tela,
      remotos: cb.current.remotos, enviarPos: (x) => cb.current.enviarPos?.(x),
      onPerto: setPerto, onFalarCom: setFalandoCom, onEntrarEstudo: entrarEstudo,
      onSessao: () => { setMenu(false); cb.current.onSessaoIniciada?.(); }, onPronto: () => setPronto(true),
      landmarks: landmarksOn(), onLandmark: (poi) => { setErroTopo(null); setPoiAberto(poi); }, onTopo: (v) => { setNoTopo(v); if (v) setPoiAberto(null); },
      onPortalCeu: () => comFade(() => engine.current?.entrarNoCeu()),   // a Zaeon é aberta a todos (sem pedir acesso)
      onEmbarcar: () => { void pedir("nave", () => engine.current?.embarcar()); },
      onEstadoQG: setQg, onAcao: setAcao,
      onVoo: setVoo,
      onRota: setRota,
      remotosSuaves: transporteRealtime() === "colyseus",
      onAbrirSom: () => { if (!cb.current.souFundador || !cb.current.musica) { avisar("Só o dono da Zaeon mexe no toca-discos."); return; } setSomAberto(true); },
      urlMusica: cb.current.musica ? (arq: string) => cb.current.musica!.urlDe(arq) : undefined,
      onAbrirRecado: () => { if (!cb.current.souFundador || !cb.current.enviarRecado) { avisar("Só o dono da Zaeon manda recados pro QG."); return; } setRecadoTxt(""); setRecadoAberto(true); },
    }).then((eng) => { if (cancelado) { eng.dispose(); return; } e = eng; engine.current = eng; eng.setPessoas(cb.current.membros); })
      .catch(() => { if (!cancelado) setFalha(true); });
    return () => { cancelado = true; e?.dispose(); engine.current = null; };
    // a engine é criada uma vez por montagem; mudanças vão por métodos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { engine.current?.setPessoas(p.membros); }, [p.membros]);
  // VOZ: a malha WebRTC vive enquanto houver o canal (Colyseus); o áudio de quem fala sai pelo avatar dele
  useEffect(() => {
    if (!comVoz || !p.canalVoz) return;
    const v = criarVoz({ euId: p.eu.id, canal: p.canalVoz, aoAudio: (id, s) => engine.current?.vozDe(id, s), aoErro: avisar });
    voz.current = v;
    return () => { v.dispose(); voz.current = null; setFalandoEu(false); };
  }, [comVoz, p.canalVoz, p.eu.id, avisar]);
  useEffect(() => { voz.current?.pares(p.onlineIds ?? []); }, [p.onlineIds, comVoz]);
  const falar = useCallback((on: boolean) => { if (!voz.current) return; setFalandoEu(on); void voz.current.segurar(on); }, []);
  useEffect(() => {
    if (!comVoz) return;
    const digitando = () => { const a = document.activeElement; return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || (a as HTMLElement).isContentEditable); };
    const baixo = (e: KeyboardEvent) => { if (ehTeclaFalar(e, digitando())) { e.preventDefault(); falar(true); } };
    const cima = (e: KeyboardEvent) => { if (e.key === "g" || e.key === "G") falar(false); };
    const solta = () => falar(false);
    window.addEventListener("keydown", baixo); window.addEventListener("keyup", cima); window.addEventListener("blur", solta);
    return () => { window.removeEventListener("keydown", baixo); window.removeEventListener("keyup", cima); window.removeEventListener("blur", solta); };
  }, [comVoz, falar]);
  // OLHAR LIVRE (mouse travado): abriu um painel → solta o mouse pra clicar nele; Enter (fora de um campo) → solta e
  // foca o chat (dá pra falar sem precisar do Esc antes)
  const chatRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (poiAberto || recadoAberto || somAberto) engine.current?.soltarMouse(); }, [poiAberto, recadoAberto, somAberto]);
  // o toca-discos: o estado da sala vai pro player (a música sai das caixas do lounge, sincronizada)
  useEffect(() => { engine.current?.setSomLounge(p.somLounge ?? null, p.offsetMusica ?? 0); }, [p.somLounge, p.offsetMusica, pronto]);
  useEffect(() => {
    const enter = (e: KeyboardEvent) => {
      const a = document.activeElement, campo = !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || (a as HTMLElement).isContentEditable);
      if (e.key !== "Enter" || campo || !chatRef.current || !document.pointerLockElement) return;
      e.preventDefault(); engine.current?.soltarMouse(); chatRef.current.focus();
    };
    window.addEventListener("keydown", enter); return () => window.removeEventListener("keydown", enter);
  }, []);
  // o recado atual: holograma no QG + a TV do lounge (e um "ping" quando chega um novo)
  useEffect(() => { engine.current?.setRecado(p.recadoQG ?? null); }, [p.recadoQG, pronto]);

  // chat da sala → balões sobre os avatares
  const vistas = useRef(0);
  useEffect(() => {
    const c = p.chat ?? [];
    if (c.length < vistas.current) vistas.current = 0;
    for (let i = vistas.current; i < c.length; i++) engine.current?.falar(c[i]!.userId, c[i]!.texto);
    vistas.current = c.length;
  }, [p.chat]);

  if (falha) return <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#03030a] px-6 text-center text-sm text-white/70">Não deu para iniciar o cyberespaço 3D neste aparelho.<button onClick={entrarEstudo} className="min-h-[44px] rounded-full bg-cyan-400 px-5 font-semibold text-slate-950">Ir para a Sala de Estudos</button></div>;

  const enviar = () => { const t = txt.trim(); if (!t) return; void p.enviarChat?.(t); setTxt(""); };
  const mandarRecado = async (texto: string | null) => {
    const fn = p.enviarRecado; if (!fn || recadoEnviando) return;
    if (texto !== null && !texto.trim()) return;
    setRecadoEnviando(true);
    try { const r = await fn(texto === null ? null : texto.trim()); if (r.ok) { setRecadoAberto(false); avisar(texto === null ? "Recado apagado do QG." : "Recado enviado ao QG do Andrei ✦"); tocarUI("chat-pop"); } else avisar(r.erro ?? "Não deu pra enviar."); }
    catch { avisar("Sem conexão."); }
    finally { setRecadoEnviando(false); }
  };
  const convidar = async () => {
    if (!p.tokenConvite) return;
    const url = `${location.origin}/lounge-cosmico?sala=${p.tokenConvite}`;
    try { await navigator.clipboard.writeText(url); } catch { window.prompt("Copie o link de convite:", url); }
    setCopiado(true); setTimeout(() => setCopiado(false), 2200);
  };

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[#03030a] text-[#e7ecff]">
      <div ref={cont} className="absolute inset-0" />
      <div ref={overlay} className="pointer-events-none absolute inset-0 overflow-hidden" />

      {/* rótulo do monitor (hover) */}
      <div ref={monLabel} className="pointer-events-none absolute z-[22] hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-gradient-to-b from-cyan-100 to-sky-400 px-3 py-1.5 text-[12.5px] font-bold text-slate-950 shadow-[0_0_18px_rgba(90,200,255,.7)] data-[longe=true]:border data-[longe=true]:border-sky-300/35 data-[longe=true]:bg-slate-900/80 data-[longe=true]:from-transparent data-[longe=true]:to-transparent data-[longe=true]:text-sky-100 data-[longe=true]:shadow-none" />

      {/* janela da landing = só a VISTA do cyberespaço: sem menu, sem frases, sem tutorial */}

      {/* HUD de jogo (fora do menu) */}
      {!menu && (
        <>
          {/* interface limpa: sem dicas/tutorial na tela */}
          {tela && (
            <button type="button" onClick={() => router.push("/")} className="absolute left-3 top-3 z-20 min-h-[44px] rounded-full border border-white/20 bg-black/50 px-4 text-xs font-medium text-white backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">← Sair</button>
          )}
          {tela && (
            <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
              <div className="relative">
                <button type="button" aria-label={som.ligado ? "Som (ligado)" : "Som (desligado)"} aria-expanded={painelSom} onClick={() => setPainelSom((v) => !v)} className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-white/15 bg-black/50 text-base text-white/85 backdrop-blur">{som.ligado && som.volume > 0 ? "🔊" : "🔇"}</button>
                {painelSom && (
                  <div className="absolute right-0 top-[52px] z-30 w-[200px] rounded-2xl border border-white/15 bg-[#070c22]/90 p-3 text-xs text-white/85 backdrop-blur">
                    <label className="flex items-center justify-between gap-2"><span>Som</span><input type="checkbox" checked={som.ligado} onChange={(e) => mudarSom({ ...som, ligado: e.target.checked })} /></label>
                    <label className="mt-2 block">Volume<input type="range" min={0} max={1} step={0.05} value={som.volume} onChange={(e) => mudarSom({ ...som, volume: Number(e.target.value) })} className="mt-1 w-full" aria-label="Volume" /></label>
                  </div>
                )}
              </div>
              {typeof p.online === "number" && <span className="rounded-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white/80">{p.online}/5 online</span>}
              {p.tokenConvite && <button type="button" onClick={convidar} className="min-h-[44px] rounded-full border border-cyan-300/40 bg-cyan-400/15 px-4 text-xs font-semibold text-cyan-100 backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">{copiado ? "Link copiado ✓" : "Convidar"}</button>}
            </div>
          )}
          {p.aviso && <p role="status" className="absolute left-1/2 top-[120px] z-20 -translate-x-1/2 rounded-full bg-amber-300/90 px-3 py-1 text-xs font-medium text-slate-900">{p.aviso}</p>}

          {perto && menu && (   // na vista (landing/menu); fora dele o "Estudar" é a ação de contexto (F)
            <button type="button" onClick={entrarEstudo} className="absolute left-1/2 z-[21] min-h-[44px] -translate-x-1/2 animate-pulse rounded-full bg-gradient-to-b from-cyan-200 to-sky-400 px-6 text-sm font-extrabold text-slate-950 shadow-[0_0_26px_rgba(90,200,255,.75)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" style={{ bottom: touch ? 168 : tela ? 150 : 28 }}>✦ Estudar</button>
          )}

          {tela && !(touch && (qg.pilotando || qg.moto)) && (   // celular pilotando: o chat sai da frente dos atalhos/controles
            <div className="absolute z-20 w-[min(68vw,300px)] rounded-2xl border border-violet-300/25 bg-[#0a081e]/70 p-2.5 backdrop-blur" style={touch ? { left: 10, top: 64 } : { left: 16, bottom: 16 }}>
              <div className="h-4 px-1 text-[10.5px] text-cyan-200">{falandoCom ? `💬 falando com ${falandoCom}` : ""}</div>
              <div className="mb-1.5 flex max-h-[96px] flex-col gap-0.5 overflow-y-auto px-1 text-[12.5px] text-violet-100" aria-live="polite">
                {(p.chat ?? []).slice(-8).map((m) => <div key={m.id}><b style={{ color: m.color }}>{m.name}:</b> {m.texto}</div>)}
              </div>
              <input ref={chatRef} value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") enviar(); }} maxLength={400} placeholder="Falar…  (Enter)" aria-label="Falar na sala" className="w-full rounded-xl border border-violet-300/30 bg-[#0a081e]/70 px-3 py-2 text-[13px] text-white outline-none focus:border-cyan-300" />
            </div>
          )}

          {touch && (
            <>
              <Joystick onMove={(x, y) => engine.current?.setJoystick(x, y)} />
              {qg.pilotando || qg.moto ? null : (<>
              <button type="button" aria-label="Correr" aria-pressed={correndo} onPointerDown={(e) => { e.stopPropagation(); setCorrendo(engine.current?.alternarCorrer() ?? false); }} className={`absolute z-[25] flex h-[62px] w-[62px] touch-none items-center justify-center rounded-full border border-sky-300/45 text-[12px] font-extrabold backdrop-blur ${correndo ? "bg-gradient-to-b from-cyan-200 to-sky-400 text-slate-950" : "bg-sky-950/55 text-sky-50"}`} style={{ right: "max(94px, calc(env(safe-area-inset-right) + 72px))", bottom: "max(30px, env(safe-area-inset-bottom))" }}>CORRER</button>
              <button type="button" aria-label="Voar (segurar)" onPointerDown={(e) => { e.stopPropagation(); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* sem captura */ } engine.current?.comandoJet(true); }} onPointerUp={() => engine.current?.comandoJet(false)} onPointerCancel={() => engine.current?.comandoJet(false)} onLostPointerCapture={() => engine.current?.comandoJet(false)} onContextMenu={(e) => e.preventDefault()} className="absolute z-[25] flex h-[62px] w-[62px] touch-none items-center justify-center rounded-full border border-sky-300/45 bg-sky-950/55 text-[12px] font-extrabold text-sky-50 backdrop-blur" style={{ right: "max(22px, env(safe-area-inset-right))", bottom: "max(30px, env(safe-area-inset-bottom))" }}>VOAR</button>
              </>)}
            </>
          )}
        </>
      )}

      {/* entrando nos estudos: SÓ uma barra de loading, nenhum texto */}
      {/* painel do marco (proximidade + clique): nome, org, link; "Subir ao topo" só pro dono e validado no SERVIDOR */}
      {poiAberto && !menu && (
        <div role="dialog" aria-label={poiAberto.nome} className="absolute left-1/2 top-[110px] z-30 w-[min(92vw,340px)] -translate-x-1/2 rounded-2xl border border-sky-300/35 bg-[#070c22]/90 p-4 text-sm shadow-[0_0_40px_-10px_rgba(90,200,255,.6)] backdrop-blur">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1"><p className="text-base font-extrabold tracking-wide text-sky-100">{poiAberto.nome}</p><p className="mt-0.5 text-white/70">{poiAberto.org}</p></div>
            <button type="button" aria-label="Fechar" onClick={() => setPoiAberto(null)} className="min-h-[36px] min-w-[36px] rounded-full border border-white/15 text-white/70 hover:text-white">×</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {poiAberto.link && <button type="button" onClick={() => router.push(poiAberto.link!)} className="min-h-[40px] rounded-full border border-sky-300/40 bg-sky-400/15 px-4 font-semibold text-sky-100">Abrir</button>}
            {poiAberto.acesso === "dono" && p.souFundador && p.pedirAcesso && (
              <button type="button" disabled={subindo} onClick={async () => {
                setSubindo(true); setErroTopo(null);
                try { const r = await p.pedirAcesso!("topo"); if (r.ok) engine.current?.subir(); else setErroTopo(r.erro ?? "Não foi possível subir."); }
                catch { setErroTopo("Sem conexão."); } finally { setSubindo(false); }
              }} className="min-h-[40px] rounded-full bg-gradient-to-b from-cyan-200 to-sky-400 px-4 font-extrabold text-slate-950 disabled:opacity-60">{subindo ? "Subindo…" : "Subir ao topo"}</button>
            )}
          </div>
          {erroTopo && <p role="alert" className="mt-2 text-rose-300">{erroTopo}</p>}
        </div>
      )}
      {/* AÇÃO de contexto: sem mouse no cyberespaço — F faz (estudar, montar na moto, embarcar, descer, falar, recado…);
          no celular, tocar no chip. Embarcar continua validado no servidor (onEmbarcar → pedir). */}
      {!menu && acao && (
        <button type="button" onClick={() => engine.current?.executarAcao()} className="absolute left-1/2 z-[22] flex min-h-[44px] -translate-x-1/2 items-center gap-2 rounded-full bg-gradient-to-b from-cyan-200 to-sky-400 py-1.5 pl-1.5 pr-5 text-sm font-extrabold text-slate-950 shadow-[0_0_26px_rgba(90,200,255,.6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" style={{ bottom: touch ? 168 : tela ? 150 : 28 }}>
          {!touch && <kbd className="flex h-8 min-w-8 items-center justify-center rounded-full bg-slate-950/85 px-2 font-mono text-[13px] text-cyan-100">F</kbd>}
          <span className={touch ? "pl-3.5" : ""}>{acao.rotulo}</span>
        </button>
      )}
      {!menu && (qg.pilotando || qg.moto) && <ControlesVoo engine={engine} touch={touch} pousado={qg.pousado} />}
      {/* MOTO VOADORA: o altímetro (montar/descer é a ação de contexto, F) */}
      {!menu && qg.moto && voo && !qg.pousado && (
        <p className="absolute left-1/2 top-[110px] z-30 -translate-x-1/2 rounded-full bg-[#070c22]/70 px-3 py-1 text-center text-xs font-bold tabular-nums text-sky-100 backdrop-blur">↕ {voo.y} m</p>
      )}
      {!menu && qg.pilotando && (
        <div className="absolute left-1/2 top-[110px] z-30 flex -translate-x-1/2 flex-col items-center gap-2">
          {voo && !qg.pousado && <p className="rounded-full bg-[#070c22]/70 px-3 py-1 text-center text-xs font-bold tabular-nums text-sky-100 backdrop-blur">↕ {voo.y} m</p>}
          {/* atalhos (só no começo do voo, com a nave pousada): a nave voa sozinha, à vista de todos; qualquer botão de movimento cancela */}
          {rota ? (
            <button type="button" onClick={() => engine.current?.pararRota()} className="min-h-[40px] rounded-full border border-amber-200/45 bg-[#1a0f08]/85 px-4 text-xs font-semibold text-amber-100 backdrop-blur">■ Parar</button>
          ) : qg.pousado && (
            <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Atalhos de voo">
              {([["heliporto", "Heliporto"], ["qg", "QG do Andrei"], ["zaeon", "Zaeon"]] as const).map(([d, rot]) => (
                <button key={d} type="button" onClick={() => engine.current?.irPara(d)} className="min-h-[40px] rounded-full border border-sky-300/40 bg-[#070c22]/85 px-4 text-xs font-semibold text-sky-100 backdrop-blur">{rot}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {!menu && qg.noCeu && !qg.pilotando && (
        <button type="button" onClick={() => comFade(() => engine.current?.voltarDaCidade())} className="absolute right-3 top-[64px] z-30 min-h-[44px] rounded-full border border-amber-200/40 bg-[#1a0f08]/80 px-4 text-xs font-semibold text-amber-100 backdrop-blur">↩ Voltar à praça</button>
      )}
      {somAberto && p.musica && <TocaDiscos som={p.somLounge ?? null} offsetMs={p.offsetMusica ?? 0} api={p.musica} onFechar={() => setSomAberto(false)} />}
      {recadoAberto && (
        <div role="dialog" aria-modal="true" aria-label="Recado pro QG do Andrei" className="absolute inset-0 z-50 flex items-center justify-center bg-[#03030a]/60 px-4" onClick={() => setRecadoAberto(false)}>
          <div className="w-full max-w-[420px] rounded-2xl border border-cyan-300/30 bg-[#070c22]/95 p-4 text-sky-100 shadow-[0_0_40px_rgba(102,230,255,.15)]" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-cyan-200">Recado pro QG do Andrei</p>
            <p className="mt-1 text-xs text-sky-100/60">Aparece num holograma ao lado da tela onde ele trabalha. Fica lá até você mandar outro ou apagar.</p>
            <textarea autoFocus value={recadoTxt} onChange={(e) => setRecadoTxt(e.target.value)} maxLength={MAX_TEXTO_RECADO} rows={4} placeholder="Escreva o recado…" aria-label="Texto do recado"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void mandarRecado(recadoTxt); if (e.key === "Escape") setRecadoAberto(false); }}
              className="mt-3 w-full resize-none rounded-xl border border-cyan-300/30 bg-[#0a081e]/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300" />
            <div className="mt-1 text-right text-[11px] text-sky-100/50">{recadoTxt.length}/{MAX_TEXTO_RECADO}</div>
            {p.recadoQG && <p className="mt-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-sky-100/70"><span className="text-sky-100/50">No QG agora: </span>{p.recadoQG.texto}</p>}
            <div className="mt-3 flex items-center justify-between gap-2">
              {p.recadoQG ? <button type="button" disabled={recadoEnviando} onClick={() => void mandarRecado(null)} className="min-h-[40px] rounded-full px-3 text-xs text-rose-200/80 hover:text-rose-200">Apagar o atual</button> : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={() => setRecadoAberto(false)} className="min-h-[40px] rounded-full border border-white/15 px-4 text-xs text-sky-100/80">Fechar</button>
                <button type="button" disabled={recadoEnviando || !recadoTxt.trim()} onClick={() => void mandarRecado(recadoTxt)} className="min-h-[40px] rounded-full bg-gradient-to-b from-cyan-200 to-sky-400 px-5 text-xs font-extrabold text-slate-950 disabled:opacity-50">{recadoEnviando ? "Enviando…" : "Enviar ao QG"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {comVoz && falandoEu && <p role="status" className="pointer-events-none absolute left-1/2 top-[120px] z-40 -translate-x-1/2 rounded-full border border-emerald-300/40 bg-[#062018]/85 px-4 py-1.5 text-xs font-semibold text-emerald-200">🎙 Falando…</p>}
      {comVoz && touch && !menu && (
        <button type="button" aria-label="Segurar pra falar" onPointerDown={(e) => { e.preventDefault(); falar(true); }} onPointerUp={() => falar(false)} onPointerLeave={() => falar(false)} onPointerCancel={() => falar(false)}
          className={`absolute bottom-[150px] right-4 z-30 min-h-[52px] select-none rounded-full border px-4 text-sm font-semibold backdrop-blur ${falandoEu ? "border-emerald-300 bg-emerald-400/30 text-emerald-50" : "border-white/20 bg-[#070c22]/80 text-sky-100"}`}>🎤 {falandoEu ? "Falando…" : "Segurar pra falar"}</button>
      )}
      {aviso2 && <p role="status" className="absolute left-1/2 top-[164px] z-40 -translate-x-1/2 rounded-full bg-[#1a0f08]/90 px-4 py-2 text-xs text-amber-100">{aviso2}</p>}
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 z-[45] bg-black transition-opacity duration-300 ${fade ? "opacity-100" : "opacity-0"}`} />
      {/* celular em pé: o cyberespaço roda na horizontal (a cena fica pausada até girar) */}
      {girar && (
        <div role="dialog" aria-label="Gire o celular" className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-[#03030a]/95 px-8 text-center text-sky-100">
          <svg aria-hidden="true" width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-300">
            <rect x="7" y="2.5" width="10" height="17" rx="2" /><path d="M19.5 14.5a7.5 7.5 0 0 1-6 6.9" /><path d="m13.5 21.4 1.6-1.9-2.2-.9" />
          </svg>
          <p className="text-base font-bold">Gire o celular</p>
          <p className="max-w-[260px] text-sm text-sky-100/70">O cyberespaço roda na horizontal.</p>
          <button type="button" onClick={() => void telaCheiaHorizontal()} className="min-h-[44px] rounded-full bg-gradient-to-b from-cyan-200 to-sky-400 px-5 text-sm font-extrabold text-slate-950">Tela cheia na horizontal</button>
        </div>
      )}

      {noTopo && !menu && (
        <button type="button" onClick={() => engine.current?.descer()} className="absolute left-1/2 top-[110px] z-30 min-h-[44px] -translate-x-1/2 rounded-full border border-sky-300/40 bg-[#070c22]/85 px-5 text-sm font-semibold text-sky-100 backdrop-blur">↓ Descer da Zaeon</button>
      )}

      {abrindo && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#03030a]">
          <div role="progressbar" aria-label="Carregando" className="h-1.5 w-[220px] overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/3 animate-[cyber-entrando_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-cyan-200 to-sky-400" />
          </div>
          <style>{`@keyframes cyber-entrando{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
        </div>
      )}
      {!pronto && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#03030a]">
          <div className="h-1.5 w-[220px] overflow-hidden rounded-full bg-white/10"><div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-cyan-200 to-sky-400" /></div>
        </div>
      )}
    </div>
  );
}
