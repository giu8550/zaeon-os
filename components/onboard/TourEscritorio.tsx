"use client";
/**
 * TourEscritorio — o tutorial do ESCRITÓRIO (lib/onboarding/tourEscritorio): na 1ª vez que a pessoa abre a aba
 * Escritório do laboratório, a Aura mostra o canal, os agentes, onde escrever e o convite. Mesmo cartão do tour da sala
 * (components/onboard/BalaoTour); espera o tour da sala acabar se ele estiver na tela.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { OverlayTour, useDestaque } from "@/components/onboard/BalaoTour";
import { getTour } from "@/lib/onboarding/tour";
import { tourDoLabAtivo } from "@/lib/onboarding/tourSala";
import { escritorioCowork } from "@/lib/canal/flags";
import { geracaoDosTours } from "@/lib/onboarding/geracaoTour";
import { dicaAtiva } from "@/lib/onboarding/dicas";
import { passosDoEscritorio, deveMostrarTourEscritorio, marcarTourEscritorioVisto, tourEscritorioVisto } from "@/lib/onboarding/tourEscritorio";

const SEM_ALVOS: string[] = [];

export default function TourEscritorio({ naAba, noTutorial }: { naAba: boolean; noTutorial: boolean }) {
  const passos = useMemo(() => passosDoEscritorio(escritorioCowork()), []);
  const [i, setI] = useState<number | null>(null);
  // #613: a geração em que este tour começou (um "Rever tutorial" noutra aba a invalida)
  const geracao = useRef<string | undefined>(undefined);
  // a aba abriu: espera o canal montar antes de começar
  useEffect(() => {
    if (!naAba) { setI(null); return; }
    const t = setTimeout(() => {
      if (deveMostrarTourEscritorio({ naAba, noTutorial, largura: window.innerWidth, visto: tourEscritorioVisto(), outroTour: getTour().active || tourDoLabAtivo() || dicaAtiva() })) { geracao.current = geracaoDosTours(); setI(0); }
    }, 1200);
    return () => clearTimeout(t);
  }, [naAba, noTutorial]);
  const passo = i === null ? null : passos[i] ?? null;
  const { alvo, evita } = useDestaque(passo?.alvos ?? SEM_ALVOS, SEM_ALVOS, !!passo);
  if (!passo || i === null) return null;
  const sair = () => { marcarTourEscritorioVisto(geracao.current); setI(null); };
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
      acao={{ rotulo: passo.cta, onClick: ultimo ? sair : () => setI(i + 1) }}
      onPular={sair}
      tom="ciano"
    />
  );
}
