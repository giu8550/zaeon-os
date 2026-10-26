"use client";
/**
 * TourSala — o tour do LABORATÓRIO (lib/onboarding/tourSala): na 1ª vez que a pessoa abre o laboratório FORA do tutorial
 * do tablet, a Aura guia o caminho de ouro (estudo no chat → Sala de Estudos → diagrama → percurso → mapa). Cada passo
 * leva o laboratório pra sala certa (zaeon:set-tab + a sub-aba); os passos de ação andam quando o evento da ação chega,
 * os de explicação no botão. Pular/Esc/Concluir marca como visto. Cartão: components/onboard/BalaoTour.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { OverlayTour, useDestaque } from "@/components/onboard/BalaoTour";
import { mapPanelOn } from "@/components/cerebro/useCerebro";
import { irPraAbaEstudos } from "@/lib/chat/conversasNav";
import { getTour } from "@/lib/onboarding/tour";
import { ALVO_ENVIAR, AVISO_PEDIDO, EVT_DESENHO, EVT_PERGUNTA_CHAT, EVT_TURNO_FIM, KINDS_VISUAIS, TAREFA_SEM_DESENHO, estadoPercursoAtual, proximoPedido, type EventoPedido, type PedidoDesenho, EVT_CHAT_TEXTO, EVT_PERCURSO_ESTADO, EVT_PREENCHER_CHAT, TAREFA_ENVIAR, deveMostrarTourSala, eventoAvanca, marcarTourDoLabAtivo, marcarTourSalaVisto, passosDaSala, tarefaDoPercurso, tourSalaVisto } from "@/lib/onboarding/tourSala";
import { EVT_ESTUDOS_VISTA } from "@/lib/onboarding/tutorialLab";
import { EVT_REVER_TOURS } from "@/lib/onboarding/reverTours";
import { geracaoDosTours } from "@/lib/onboarding/geracaoTour";
import { dicaAtiva } from "@/lib/onboarding/dicas";
import type { EstadoBolinha } from "@/lib/map/bolinha";

const SEM_ALVOS: string[] = [];
/** #618: com o contorno no ➤, o cartão continua sem cobrir o campo inteiro (a pessoa revisa o que vai mandar) */
const EVITA_CHAT = ['[data-tour="composer-estudos"]'];
/** #613: o exemplo do "Sua vez" vai pro campo do chat (components/study/StudyCoworkChat) — a pessoa só manda */
const preencherChat = (texto: string) => window.dispatchEvent(new CustomEvent(EVT_PREENCHER_CHAT, { detail: { texto } }));

export default function TourSala({ noTutorial }: { noTutorial: boolean }) {
  const passos = useMemo(() => passosDaSala(mapPanelOn()), []);
  const [i, setI] = useState<number | null>(null);
  // #613: a geração em que este tour começou (um "Rever tutorial" noutra aba a invalida)
  const geracao = useRef<string | undefined>(undefined);
  const comecar = () => { geracao.current = geracaoDosTours(); setI(0); };
  // espera o laboratório assentar (a sala inicial, a sidebar) antes de começar
  useEffect(() => {
    const t = setTimeout(() => {
      if (deveMostrarTourSala({ noTutorial, largura: window.innerWidth, visto: tourSalaVisto(), outroTour: getTour().active || dicaAtiva() })) comecar();
    }, 1500);
    return () => clearTimeout(t);
  }, [noTutorial]);
  // #613: "Rever tutorial do laboratório" (Configurações) — recomeça do 1º passo
  useEffect(() => {
    const rever = () => { if (deveMostrarTourSala({ noTutorial, largura: window.innerWidth, visto: tourSalaVisto(), outroTour: getTour().active || dicaAtiva() })) comecar(); };
    window.addEventListener(EVT_REVER_TOURS, rever);
    return () => window.removeEventListener(EVT_REVER_TOURS, rever);
  }, [noTutorial]);
  const passo = i === null ? null : passos[i] ?? null;
  useEffect(() => { marcarTourDoLabAtivo(!!passo); }, [passo]);
  useEffect(() => () => marcarTourDoLabAtivo(false), []);
  // leva o laboratório pra sala do passo
  useEffect(() => {
    const ir = passo?.ir; if (!ir) return;
    window.dispatchEvent(new CustomEvent("zaeon:set-tab", { detail: ir.tab }));
    if (ir.aba) irPraAbaEstudos(ir.aba);
    if (ir.vista) { const v = ir.vista; setTimeout(() => window.dispatchEvent(new CustomEvent(EVT_ESTUDOS_VISTA, { detail: v })), 120); }
  }, [passo]);
  const sair = () => { marcarTourSalaVisto(geracao.current); setI(null); };
  const seguir = () => setI((k) => {
    if (k === null) return null;
    if (k + 1 >= passos.length) { marcarTourSalaVisto(geracao.current); return null; }
    return k + 1;
  });
  // #626: anda SÓ se ainda estiver neste passo — dois avisos na mesma hora (desenho pronto + documento aberto)
  // pulavam dois passos
  const seguirDe = (id: string) => setI((k) => {
    if (k === null || passos[k]?.id !== id) return k;
    if (k + 1 >= passos.length) { marcarTourSalaVisto(geracao.current); return null; }
    return k + 1;
  });
  // passo de AÇÃO: anda quando a pessoa faz a coisa (o evento chega)
  useEffect(() => {
    if (!passo?.avancaEm?.length) return;
    const id = passo.id;
    const eventos = Array.from(new Set(passo.avancaEm.map((a) => a.evento)));
    const ouvir = (e: Event) => { if (eventoAvanca(passo, e.type, (e as CustomEvent).detail)) seguirDe(id); };
    for (const ev of eventos) window.addEventListener(ev, ouvir);
    return () => { for (const ev of eventos) window.removeEventListener(ev, ouvir); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo]);
  // #626: o passo do diagrama acompanha o pedido (enviado → desenhando → pronto; ou não saiu o desenho)
  const [pedido, setPedido] = useState<PedidoDesenho>(null);
  useEffect(() => {
    setPedido(null);
    if (passo?.id !== "criar-diagrama") return;
    const id = passo.id;
    const mudar = (ev: EventoPedido) => setPedido((p) => proximoPedido(p, ev));
    const pergunta = () => mudar({ tipo: "pergunta" });
    const desenho = (e: Event) => {
      const d = ((e as CustomEvent).detail ?? {}) as { fase?: "comecou" | "pronto" | "falhou"; kind?: string };
      if (!d.fase || !d.kind) return;
      if (d.fase === "pronto" && KINDS_VISUAIS.includes(d.kind)) seguirDe(id);
      else mudar({ tipo: "desenho", fase: d.fase, kind: d.kind });
    };
    // o desenho pode começar um instante depois de a resposta acabar: espera um pouco antes de dizer "não saiu"
    let t: ReturnType<typeof setTimeout> | undefined;
    const fim = () => { clearTimeout(t); t = setTimeout(() => mudar({ tipo: "fim" }), 1500); };
    window.addEventListener(EVT_PERGUNTA_CHAT, pergunta);
    window.addEventListener(EVT_DESENHO, desenho);
    window.addEventListener(EVT_TURNO_FIM, fim);
    return () => { clearTimeout(t); window.removeEventListener(EVT_PERGUNTA_CHAT, pergunta); window.removeEventListener(EVT_DESENHO, desenho); window.removeEventListener(EVT_TURNO_FIM, fim); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo]);
  const esperando = pedido === "enviado" || pedido === "desenhando";
  // #613: o estado do botão do percurso (gerando → pronto), pro "Sua vez" acompanhar
  const [percurso, setPercurso] = useState<EstadoBolinha | null>(estadoPercursoAtual);   // #626: o que já se sabe
  useEffect(() => {
    const on = (e: Event) => setPercurso(((e as CustomEvent).detail as EstadoBolinha) ?? null);
    window.addEventListener(EVT_PERCURSO_ESTADO, on);
    return () => window.removeEventListener(EVT_PERCURSO_ESTADO, on);
  }, []);
  // #618: o campo do chat tem texto? o contorno anda junto: campo vazio → campo; com texto → ➤ enviar
  const [temTexto, setTemTexto] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setTemTexto(!!(e as CustomEvent).detail);
    window.addEventListener(EVT_CHAT_TEXTO, on);
    return () => window.removeEventListener(EVT_CHAT_TEXTO, on);
  }, []);
  const mandar = !!passo?.noChat && temTexto;
  const alvos = useMemo(() => (mandar ? [ALVO_ENVIAR] : passo?.alvos ?? SEM_ALVOS), [mandar, passo]);
  const { alvo, evita } = useDestaque(alvos, mandar ? EVITA_CHAT : SEM_ALVOS, !!passo);
  if (!passo || i === null) return null;
  const ultimo = i === passos.length - 1;
  return (
    <OverlayTour
      chave={passo.id}
      alvo={alvo}
      evita={evita}
      titulo={passo.dica}
      fala={passo.fala}
      passo={i}
      total={passos.length}
      acao={passo.cta ? { rotulo: passo.cta, onClick: ultimo ? sair : seguir } : undefined}
      onPular={sair}
      etiqueta={mandar && !esperando ? "Enviar" : undefined}
      // #626: pediu o desenho → o cartão sai da frente (pílula com o aviso) pra a pessoa ver a resposta chegando
      minimizarAgora={esperando}
      avisoMinimizado={esperando ? AVISO_PEDIDO[pedido] : undefined}
      suaVez={passo.suaVez ? {
        tarefa: pedido === "semDesenho" ? TAREFA_SEM_DESENHO : mandar ? TAREFA_ENVIAR : passo.id === "gerar-percurso" ? tarefaDoPercurso(percurso, passo.suaVez) : passo.suaVez,
        // #626: com o campo preenchido, o exemplo já cumpriu o papel — sai da frente do "apertar ↑"
        exemplo: mandar ? undefined : passo.exemplo, onExemplo: preencherChat, onJaFiz: passo.jaFiz ? () => seguirDe(passo.id) : undefined, jaFizEmDestaque: pedido === "semDesenho",
      } : undefined}
    />
  );
}
