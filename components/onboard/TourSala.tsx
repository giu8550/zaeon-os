"use client";
/**
 * TourSala — o tour do LABORATÓRIO (lib/onboarding/tourSala): na 1ª vez que a pessoa abre o laboratório FORA do tutorial
 * do tablet, a Aura guia o caminho de ouro (estudo no chat → Sala de Estudos → diagrama → percurso → mapa). Cada passo
 * leva o laboratório pra sala certa (zaeon:set-tab + a sub-aba); os passos de ação andam quando o evento da ação chega,
 * os de explicação no botão. Pular/Esc/Concluir marca como visto. Cartão: components/onboard/BalaoTour.
 */
import { useEffect, useMemo, useState } from "react";
import { OverlayTour, useDestaque } from "@/components/onboard/BalaoTour";
import { mapPanelOn } from "@/components/cerebro/useCerebro";
import { irPraAbaEstudos } from "@/lib/chat/conversasNav";
import { getTour } from "@/lib/onboarding/tour";
import { EVT_PREENCHER_CHAT, deveMostrarTourSala, eventoAvanca, marcarTourDoLabAtivo, marcarTourSalaVisto, passosDaSala, tourSalaVisto } from "@/lib/onboarding/tourSala";
import { EVT_ESTUDOS_VISTA } from "@/lib/onboarding/tutorialLab";

const SEM_ALVOS: string[] = [];
/** #613: o exemplo do "Sua vez" vai pro campo do chat (components/study/StudyCoworkChat) — a pessoa só manda */
const preencherChat = (texto: string) => window.dispatchEvent(new CustomEvent(EVT_PREENCHER_CHAT, { detail: { texto } }));

export default function TourSala({ noTutorial }: { noTutorial: boolean }) {
  const passos = useMemo(() => passosDaSala(mapPanelOn()), []);
  const [i, setI] = useState<number | null>(null);
  // espera o laboratório assentar (a sala inicial, a sidebar) antes de começar
  useEffect(() => {
    const t = setTimeout(() => {
      if (deveMostrarTourSala({ noTutorial, largura: window.innerWidth, visto: tourSalaVisto(), outroTour: getTour().active })) setI(0);
    }, 1500);
    return () => clearTimeout(t);
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
  const sair = () => { marcarTourSalaVisto(); setI(null); };
  const seguir = () => setI((k) => {
    if (k === null) return null;
    if (k + 1 >= passos.length) { marcarTourSalaVisto(); return null; }
    return k + 1;
  });
  // passo de AÇÃO: anda quando a pessoa faz a coisa (o evento chega)
  useEffect(() => {
    if (!passo?.avancaEm?.length) return;
    const eventos = Array.from(new Set(passo.avancaEm.map((a) => a.evento)));
    const ouvir = (e: Event) => { if (eventoAvanca(passo, e.type, (e as CustomEvent).detail)) seguir(); };
    for (const ev of eventos) window.addEventListener(ev, ouvir);
    return () => { for (const ev of eventos) window.removeEventListener(ev, ouvir); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo]);
  const { alvo, evita } = useDestaque(passo?.alvos ?? SEM_ALVOS, SEM_ALVOS, !!passo);
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
      suaVez={passo.suaVez ? { tarefa: passo.suaVez, exemplo: passo.exemplo, onExemplo: preencherChat } : undefined}
    />
  );
}
