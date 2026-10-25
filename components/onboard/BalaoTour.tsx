"use client";
/**
 * BalaoTour — o cartão dos TOURS DO LABORATÓRIO (o da sala, TourSala, e o do Escritório, TourEscritorio).
 * #605: "diálogo de jogo" com a Aura — o retrato dela num círculo (com uma faixa de holograma passando pelo rosto),
 * a etiqueta "AURA" inclinada, a fala em caixas curtas (lib/onboarding/cartaoTour) aparecendo letra por letra (clicar
 * completa), o triângulo ⟁ dela piscando no fim da fala e girando no botão, e o progresso em losangos. Roxo na Sala
 * de Estudos, ciano no Escritório. No lugar do vidro escuro genérico (e, antes dele, do balão dourado do Droid, que
 * segue só na 1ª missão do tablet, components/onboard/BalaoDroid).
 * Reusa o destaque (useDestaque) e a conta de posição (posicaoDoBalao) do Droid: o cartão nunca cobre o que a pessoa
 * precisa clicar. Esc = pular. O foco vai pro botão principal a cada passo. O leitor de tela recebe a fala INTEIRA
 * (aria-live), não letra por letra. Com "reduzir movimento": sem animação e o texto vem inteiro. Só CSS (sem 3D, sem
 * desfoque de fundo); as animações param com a aba escondida.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { posicaoDoBalao, type Caixa } from "@/lib/onboarding/tutorialLab";
import { COR_DO_TOM, letrasVisiveis, paginasDaFala, posicaoEstavel, type Ancora, type TomCartao } from "@/lib/onboarding/cartaoTour";

export { useDestaque } from "@/components/onboard/BalaoDroid";

/** largura do cartão (com a sobra do retrato, que sai pra fora da caixa) */
const LARGURA = 420;
/** quanto o retrato sai pra fora (em cima e à esquerda) e o tamanho dele */
const SAI = 26, RETRATO = 80;
/** a "datilografia" anda de tanto em tanto (ms) */
const PASSO_MS = 30;
// falando = boca aberta; parada = sorriso de BOCA FECHADA (#613: o `smile` é de boca aberta e parecia falar pra sempre)
const AURA = { nome: "AURA", falando: "/avatars/aura/talk.sm.webp", parada: "/avatars/aura/idle.sm.webp" };

const CSS = `
@keyframes bt-anel { 0%,100% { box-shadow: 0 0 0 1.5px rgba(var(--bt-cor),.85), 0 0 14px 2px rgba(var(--bt-cor),.28) } 50% { box-shadow: 0 0 0 1.5px rgba(var(--bt-cor),.95), 0 0 22px 4px rgba(var(--bt-cor),.34) } }
@keyframes bt-scan { 0% { transform: translateY(-120%) } 55%,100% { transform: translateY(520%) } }
@keyframes bt-gira { 0%,70% { transform: rotate(0) } 100% { transform: rotate(120deg) } }
@keyframes bt-pisca { 0%,49% { opacity: 1 } 50%,100% { opacity: .25 } }
/* #613: o contorno é FIXO (a animação só faz ele respirar) — com "reduzir movimento" ele continua aparecendo */
.bt-anel { box-shadow: 0 0 0 2px rgba(var(--bt-cor),.9), 0 0 16px 3px rgba(var(--bt-cor),.3); animation: bt-anel 2.8s ease-in-out infinite; }
.bt-retrato::before { content: ""; position: absolute; inset: 0; z-index: 2; border-radius: 50%; background: repeating-linear-gradient(0deg, rgba(103,232,249,.08) 0 1px, transparent 1px 3px); }
.bt-retrato::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 22%; z-index: 3; background: linear-gradient(180deg, transparent, rgba(103,232,249,.45), transparent); animation: bt-scan 3.2s ease-in-out infinite; }
.bt-gira { display: inline-block; animation: bt-gira 2.4s ease-in-out infinite; }
.bt-pisca { animation: bt-pisca 1.1s steps(1) infinite; }
.bt-parado .bt-anel, .bt-parado .bt-retrato::after, .bt-parado .bt-gira, .bt-parado .bt-pisca { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .bt-anel, .bt-retrato::after, .bt-gira, .bt-pisca { animation: none; } }
`;

/** O Esc veio de um campo de texto (o chat, uma busca)? Aí ele é de quem está digitando, não do tutorial. */
export const emCampoDeTexto = (alvo: EventTarget | null): boolean => {
  const el = alvo as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || !!el.isContentEditable;
};

const reduzirMovimento = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

export function OverlayTour({ alvo, evita, titulo, fala, passo, total, acao, onPular, chave, tom = "roxo", suaVez, dica = false }: {
  alvo: Caixa | null;
  evita: Caixa | null;
  /** a dica curta (1 linha) — vira o nome do cartão pro leitor de tela */
  titulo: string;
  fala: string;
  /** 0-based */
  passo: number;
  total: number;
  /** o botão do passo (cta) — sem ele, o passo anda pela AÇÃO (o cartão só explica) */
  acao?: { rotulo: string; onClick: () => void };
  onPular?: () => void;
  /** muda a cada passo (reposiciona e devolve o foco) */
  chave: string;
  /** #605: roxo na Sala de Estudos, ciano no Escritório */
  tom?: TomCartao;
  /** #613: passo de ação — a tarefa fica escrita na última caixa (com um exemplo que dá pra usar) */
  suaVez?: { tarefa: string; exemplo?: string; onExemplo?: (texto: string) => void; onJaFiz?: () => void };
  /** #618: DICA RÁPIDA (components/onboard/DicasRapidas) — só a fala e o botão; sem progresso, minimizar nem "Pular?" */
  dica?: boolean;
}) {
  const card = useRef<HTMLDivElement>(null);
  const principal = useRef<HTMLButtonElement>(null);
  const cor = COR_DO_TOM[tom];
  const [alt, setAlt] = useState(200);
  // a fala em caixas curtas: uma ideia por caixa
  const paginas = useMemo(() => (dica ? [fala] : paginasDaFala(fala)), [fala, dica]);   // #618: dica = uma caixa só
  const [pg, setPg] = useState(0);
  const [ms, setMs] = useState(0);
  const [completo, setCompleto] = useState(false);
  const [calmo, setCalmo] = useState(reduzirMovimento);
  const [escondida, setEscondida] = useState(false);
  // "reduzir movimento" ligado com o cartão aberto: o texto completa na hora (o CSS já para sozinho)
  useEffect(() => {
    let mq: MediaQueryList | null = null;
    try { mq = window.matchMedia("(prefers-reduced-motion: reduce)"); } catch { return; }
    const mudou = () => setCalmo(!!mq?.matches);
    mq?.addEventListener?.("change", mudou);
    return () => mq?.removeEventListener?.("change", mudou);
  }, []);
  useEffect(() => { setPg(0); }, [chave]);
  useEffect(() => { setMs(0); setCompleto(false); }, [chave, pg]);
  const texto = paginas[Math.min(pg, paginas.length - 1)] ?? "";
  const ultimaPagina = pg >= paginas.length - 1;
  const visivel = calmo || completo ? texto : letrasVisiveis(texto, ms);
  const digitando = visivel.length < texto.length;
  // letra por letra (para com a aba escondida)
  useEffect(() => {
    if (!digitando || escondida) return;
    const t = setInterval(() => setMs((m) => m + PASSO_MS), PASSO_MS);
    return () => clearInterval(t);
  }, [digitando, escondida]);
  useEffect(() => {
    const ver = () => setEscondida(document.hidden);
    document.addEventListener("visibilitychange", ver);
    return () => document.removeEventListener("visibilitychange", ver);
  }, []);

  const W = window.innerWidth, H = window.innerHeight, larg = Math.min(W - 24, LARGURA);
  // #618: o cartão nunca encolhe (o botão de seguir saía da tela) — sem vão do lado, ele fica num canto por cima do
  // destaque; e, por garantia, nunca passa das bordas
  const bruto = posicaoDoBalao(evita ?? alvo, W, H, { w: larg, h: alt }, 16, larg);
  const novo = { ...bruto, left: Math.max(12, Math.min(bruto.left, W - bruto.w - 12)), top: Math.max(12, Math.min(bruto.top, H - alt - 12)) };
  // #618: dentro do mesmo passo (e com o destaque no mesmo lugar) o cartão não pula de canto a cada "Continuar"
  const caixa = evita ?? alvo;
  const fixo = useRef<{ k: string; ancora: Ancora } | null>(null);
  const kFixo = `${chave}|${W}x${H}|${caixa ? [caixa.x, caixa.y, caixa.w, caixa.h].map(Math.round).join(",") : "-"}`;
  const { pos, ancora } = posicaoEstavel(fixo.current?.k === kFixo ? fixo.current.ancora : null, novo, alt, H, caixa);
  useEffect(() => { fixo.current = { k: kFixo, ancora }; });
  // #613: a altura muda com o "Sua vez" e a confirmação também — senão o cartão descia em cima do que ele aponta
  const [confirmando, setConfirmando] = useState(false);
  useLayoutEffect(() => { const el = card.current; if (!el) return; const h = el.offsetHeight; if (h && Math.abs(h - alt) > 2) setAlt(h); }, [visivel, titulo, pos.w, alt, ultimaPagina, confirmando, suaVez?.tarefa]);
  // o foco vai pro botão do passo (ou pro Pular), sem rolar a página
  useEffect(() => { (principal.current ?? card.current)?.focus({ preventScroll: true }); }, [chave, ultimaPagina]);
  // #613: pular pergunta antes (um Esc sem querer ou um clique errado perdia o tutorial inteiro)
  const ficar = useRef<HTMLButtonElement>(null);
  // #613: minimizar — a pessoa quer ver o que está atrás do cartão sem sair do tutorial (o próximo passo reabre)
  const [minimizado, setMinimizado] = useState(false);
  useEffect(() => { setConfirmando(false); setMinimizado(false); }, [chave]);
  useEffect(() => { if (confirmando) ficar.current?.focus({ preventScroll: true }); }, [confirmando]);
  useEffect(() => {
    if (!onPular) return;
    const esc = (e: KeyboardEvent) => {
      // Esc digitando no chat (fechar sugestão, desistir da frase) não é sobre o tutorial
      if (e.key !== "Escape" || emCampoDeTexto(e.target)) return;
      if (dica) { setTimeout(() => { if (!e.defaultPrevented) onPular?.(); }, 0); return; }
      // o Esc que fechou outra coisa (o mapa do percurso) não é sobre o tutorial: espera os outros ouvintes e
      // só pergunta se ninguém usou a tecla (quem usa marca com preventDefault)
      setTimeout(() => {
        if (e.defaultPrevented) return;
        setMinimizado(false);
        setConfirmando((c) => !c);
      }, 0);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onPular, dica]);

  const P = 6;
  const botao = "inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-[12px] font-semibold transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-1";
  const triangulo = <span aria-hidden className="bt-gira" style={{ color: `rgb(${cor.rgb})` }}>⟁</span>;
  if (minimizado) return createPortal(
    <button type="button" data-tour-minimizado onClick={() => setMinimizado(false)} aria-label={`Abrir o tutorial — passo ${passo + 1} de ${total}`}
      className="fixed bottom-4 right-4 z-[1300] flex max-w-[min(340px,calc(100vw-32px))] items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-4 text-left transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-1"
      style={{ background: "rgba(12,10,34,.96)", borderColor: `rgba(${cor.rgb},.55)`, boxShadow: "0 12px 30px -14px rgba(0,0,0,.75)" }}>
      <span aria-hidden className="h-9 w-9 shrink-0 overflow-hidden rounded-full" style={{ border: `2px solid rgb(${cor.rgb})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={AURA.parada} alt="" className="h-full w-full scale-[1.18] object-cover object-[50%_22%]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium tabular-nums text-[#c3cbea]">Passo {passo + 1} de {total} · abrir</span>
        {suaVez && <span className="block truncate text-[12px] text-[#e6ebff]">{suaVez.tarefa}</span>}
      </span>
    </button>,
    document.body,
  );
  return createPortal(
    <div className={`pointer-events-none fixed inset-0 z-[1300] ${escondida ? "bt-parado" : ""}`} style={{ ["--bt-cor" as string]: cor.rgb }}>
      <style>{CSS}</style>
      {/* #613: o destaque só aparece quando a Aura chega no "faz isso" (na saudação ele apontava pra nada) */}
      {alvo && ultimaPagina ? (
        <div data-tour-anel className="bt-anel absolute rounded-xl transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{ left: alvo.x - P, top: alvo.y - P, width: alvo.w + P * 2, height: alvo.h + P * 2, outline: "9999px solid rgba(2,6,23,.38)" }} />
      ) : <div className="absolute inset-0 bg-[rgba(2,6,23,.22)]" />}
      <div
        ref={card}
        role="dialog"
        data-tour-cartao
        aria-label={titulo}
        tabIndex={-1}
        // o cartão segura o próprio mousedown: clicar nele não conta como "clique fora" de um painel aberto (o mapa)
        onMouseDown={(e) => e.stopPropagation()}
        // clicar no cartão completa o texto na hora
        onClick={() => { if (digitando) setCompleto(true); }}
        className="pointer-events-auto absolute outline-none transition-[left,top] duration-300 ease-out motion-reduce:transition-none"
        style={{ width: pos.w, left: pos.left, top: pos.top, paddingTop: SAI, paddingLeft: SAI }}
      >
        <div className="relative rounded-[4px_16px_16px_16px] border pb-3 pr-4 pt-[18px]"
          style={{ paddingLeft: RETRATO - SAI + 16, background: "rgba(12,10,34,.96)", borderColor: `rgba(${cor.rgb},.45)`, boxShadow: "0 16px 40px -18px rgba(0,0,0,.75)" }}>
          {!dica && <button type="button" onClick={(e) => { e.stopPropagation(); setMinimizado(true); }} aria-label="Minimizar o tutorial" title="Minimizar"
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border text-[#e6ebff] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-1"
            style={{ borderColor: `rgba(${cor.rgb},.45)` }}>
            {/* #618: o "–" sumia; uma setinha pra baixo (= recolher), com borda */}
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>}
          {/* o retrato: falando enquanto o texto aparece, sorrindo quando para */}
          <div aria-hidden className="absolute rounded-full p-[3px]" style={{ left: -SAI, top: -SAI, width: RETRATO, height: RETRATO, border: `3px solid rgb(${cor.rgb})`, background: "#070a18" }}>
            <div className="bt-retrato relative h-full w-full overflow-hidden rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={AURA.parada} alt="" className="absolute inset-0 h-full w-full scale-[1.18] object-cover object-[50%_22%]" style={{ opacity: digitando ? 0 : 1 }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={AURA.falando} alt="" className="absolute inset-0 h-full w-full scale-[1.18] object-cover object-[50%_22%]" style={{ opacity: digitando ? 1 : 0 }} />
            </div>
          </div>
          <span aria-hidden className="absolute -top-3 px-3 py-0.5 text-[11px] font-bold tracking-wide" style={{ left: RETRATO - SAI + 12, background: `rgb(${cor.rgb})`, color: cor.tinta, transform: "skewX(-14deg)" }}>
            <span className="inline-block" style={{ transform: "skewX(14deg)" }}>{AURA.nome}</span>
          </span>
          {/* o leitor de tela recebe a fala inteira, de uma vez */}
          <p aria-live="polite" className="sr-only">{fala}</p>
          <p aria-hidden className="min-h-[3em] pr-6 text-[15px] leading-relaxed text-[#e6ebff]">
            {visivel}
            {!digitando && <span className="bt-pisca ml-1 text-[13px]" style={{ color: `rgb(${cor.rgb})` }}>⟁</span>}
          </p>
          {suaVez && ultimaPagina && (
            <div data-tour-sua-vez className="mt-2.5 rounded-lg border px-3 py-2" style={{ borderColor: `rgba(${cor.rgb},.4)`, background: `rgba(${cor.rgb},.08)` }}>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: `rgb(${cor.rgb})` }}>Sua vez</p>
              <p className="mt-0.5 text-[13px] text-[#e6ebff]">{suaVez.tarefa}</p>
              {suaVez.exemplo && suaVez.onExemplo && (
                <button type="button" onClick={(e) => { e.stopPropagation(); suaVez.onExemplo?.(suaVez.exemplo!); }}
                  className="mt-1.5 rounded-full border px-2.5 py-0.5 text-left text-[12px] text-[#f1edff] transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-1"
                  style={{ borderColor: `rgba(${cor.rgb},.55)` }}>
                  Usar o exemplo: “{suaVez.exemplo}”
                </button>
              )}
              {/* #618: o exemplo não manda sozinho — dizer o que acontece */}
              {suaVez.exemplo && suaVez.onExemplo && <p className="mt-1 text-[11px] text-[#c3cbea]">Vai pro campo de mensagem, é só apertar ➤</p>}
              {suaVez.onJaFiz && (
                <button type="button" onClick={(e) => { e.stopPropagation(); suaVez.onJaFiz?.(); }}
                  className="ml-2 mt-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium text-[#c3cbea] underline-offset-2 transition-colors hover:text-white hover:underline focus-visible:outline focus-visible:outline-1">
                  Já fiz ✓
                </button>
              )}
            </div>
          )}
          {/* #618: falta espaço? os botões descem pra linha de baixo em vez de sair do cartão */}
          <div className="mt-3 flex flex-wrap items-center justify-end gap-x-2.5 gap-y-2">
            {!dica && <span className={`mr-auto items-center gap-2 ${confirmando ? "hidden" : "flex"}`}>
              <span aria-hidden className="flex items-center gap-1">
                {Array.from({ length: total }, (_, k) => (
                  <span key={k} className="h-1.5 w-1.5 rotate-45"
                    style={k === passo ? { background: `rgb(${cor.rgb})` } : k < passo ? { background: `rgba(${cor.rgb},.45)` } : { border: `1px solid rgba(${cor.rgb},.55)` }} />
                ))}
              </span>
              {/* #613: quanto falta, escrito (ajuda a não desistir no meio) */}
              <span className="whitespace-nowrap text-[11px] font-medium tabular-nums text-[#c3cbea]">Passo {passo + 1} de {total}</span>
            </span>}
            {onPular && confirmando && (
              <span role="group" aria-label="Pular o tutorial?" className="flex w-full items-center gap-2 whitespace-nowrap">
                <span className="mr-auto text-[12px] text-[#e6ebff]">Pular o tutorial?</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); onPular(); }}
                  className="rounded-full px-2.5 py-1 text-[12px] font-medium text-[#c3cbea] transition-colors hover:text-white focus-visible:outline focus-visible:outline-1">
                  Sim, pular
                </button>
                <button type="button" ref={ficar} onClick={(e) => { e.stopPropagation(); setConfirmando(false); }}
                  className={`${botao} text-[#f1edff]`} style={{ borderColor: `rgb(${cor.rgb})` }}>
                  Continuar tutorial
                </button>
              </span>
            )}
            {/* #618: minimizar ESCRITO, junto dos outros botões — o ícone do canto ninguém via */}
            {!confirmando && !dica && (
              <button type="button" onClick={(e) => { e.stopPropagation(); setMinimizado(true); }}
                className="rounded-full px-2 py-1 text-[12px] font-medium text-[#c3cbea] transition-colors hover:text-white focus-visible:outline focus-visible:outline-1">
                Minimizar
              </button>
            )}
            {onPular && !confirmando && !dica && (
              <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmando(true); }} ref={acao || !ultimaPagina ? undefined : principal}
                className="rounded-full px-2.5 py-1 text-[12px] font-medium text-[#c3cbea] transition-colors hover:text-white focus-visible:outline focus-visible:outline-1">
                Pular
              </button>
            )}
            {confirmando ? null : !ultimaPagina ? (
              <button type="button" ref={principal} onClick={(e) => { e.stopPropagation(); setPg((k) => k + 1); }}
                className={`${botao} text-[#f1edff]`} style={{ borderColor: `rgb(${cor.rgb})` }}>
                Continuar {triangulo}
              </button>
            ) : acao && (
              <button type="button" ref={principal} onClick={(e) => { e.stopPropagation(); acao.onClick(); }}
                className={`${botao} text-[#f1edff]`} style={{ borderColor: `rgb(${cor.rgb})` }}>
                {acao.rotulo} {triangulo}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
