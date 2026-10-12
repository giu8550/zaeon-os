"use client";
/**
 * TourSala — o tour da SALA INTEIRA (lib/onboarding/tourSala): na 1ª vez que a pessoa abre o laboratório FORA do tutorial
 * do tablet, o Droid passeia pelo chat da Aura, a Sala de Estudos, o Marketplace, as referências, a Sala de Pesquisa e as
 * citações. Cada passo leva o laboratório pra sala certa (zaeon:set-tab + a sub-aba) e anda no Próximo; Pular/Concluir
 * marca como visto.
 */
import { useEffect, useState } from "react";
import { BotaoDroid, BotaoDroidLeve, OverlayDroid, useDestaque } from "@/components/onboard/BalaoDroid";
import { irPraAbaEstudos } from "@/lib/chat/conversasNav";
import { getTour } from "@/lib/onboarding/tour";
import { PASSOS_SALA, deveMostrarTourSala, marcarTourSalaVisto, tourSalaVisto } from "@/lib/onboarding/tourSala";
import { EVT_ESTUDOS_VISTA } from "@/lib/onboarding/tutorialLab";

const SEM_ALVOS: string[] = [];

export default function TourSala({ noTutorial }: { noTutorial: boolean }) {
  const [i, setI] = useState<number | null>(null);
  // espera o laboratório assentar (a sala inicial, a sidebar) antes de começar
  useEffect(() => {
    const t = setTimeout(() => {
      if (deveMostrarTourSala({ noTutorial, largura: window.innerWidth, visto: tourSalaVisto(), outroTour: getTour().active })) setI(0);
    }, 1500);
    return () => clearTimeout(t);
  }, [noTutorial]);
  const passo = i === null ? null : PASSOS_SALA[i] ?? null;
  // leva o laboratório pra sala do passo
  useEffect(() => {
    const ir = passo?.ir; if (!ir) return;
    window.dispatchEvent(new CustomEvent("zaeon:set-tab", { detail: ir.tab }));
    if (ir.aba) irPraAbaEstudos(ir.aba);
    if (ir.vista) { const v = ir.vista; setTimeout(() => window.dispatchEvent(new CustomEvent(EVT_ESTUDOS_VISTA, { detail: v })), 120); }
  }, [passo]);
  const { alvo, evita } = useDestaque(passo?.alvos ?? SEM_ALVOS, SEM_ALVOS, !!passo);
  if (!passo || i === null) return null;
  const ultimo = i === PASSOS_SALA.length - 1;
  const sair = () => { marcarTourSalaVisto(); setI(null); };
  return <OverlayDroid alvo={alvo} evita={evita} fala={passo.fala} botoes={<>
    {!ultimo && <BotaoDroidLeve onClick={sair}>Pular</BotaoDroidLeve>}
    <span className="mr-auto order-first text-[11px] font-bold tabular-nums text-[#fff8ea]/40">{i + 1}/{PASSOS_SALA.length}</span>
    <BotaoDroid onClick={() => (ultimo ? sair() : setI(i + 1))}>{ultimo ? "Concluir ✦" : "Próximo ▸"}</BotaoDroid>
  </>} />;
}
