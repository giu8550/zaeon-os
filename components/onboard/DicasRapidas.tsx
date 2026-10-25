"use client";
/**
 * DicasRapidas — #618: um balão por vez, na 1ª vez que a pessoa entra no lugar (lib/onboarding/dicas). "Entendi" vai
 * pra próxima; Esc fecha (sem perguntar: é só uma dica). Espera um tour do laboratório ou do tablet acabar.
 */
import { useEffect, useState } from "react";
import { OverlayTour, useDestaque } from "@/components/onboard/BalaoTour";
import { getTour } from "@/lib/onboarding/tour";
import { tourDoLabAtivo } from "@/lib/onboarding/tourSala";
import { deveMostrarDicas, dicasVistas, marcarDicasVistas, type Dica } from "@/lib/onboarding/dicas";

const SEM_ALVOS: string[] = [];

export default function DicasRapidas({ lugar, dicas }: { lugar: string; dicas: Dica[] }) {
  const [i, setI] = useState<number | null>(null);
  // espera a tela assentar e nenhum tour estar rodando (confere de novo a cada segundo)
  useEffect(() => {
    if (dicasVistas(lugar)) return;
    const t = setInterval(() => {
      if (deveMostrarDicas({ visto: dicasVistas(lugar), largura: window.innerWidth, outroTour: getTour().active || tourDoLabAtivo() })) { setI(0); clearInterval(t); }
    }, 1200);
    return () => clearInterval(t);
  }, [lugar]);
  const dica = i === null ? null : dicas[i] ?? null;
  const { alvo, evita } = useDestaque(dica ? [dica.alvo] : SEM_ALVOS, SEM_ALVOS, !!dica);
  if (!dica || i === null) return null;
  const fechar = () => { marcarDicasVistas(lugar); setI(null); };
  return (
    <OverlayTour dica chave={`${lugar}-${i}`} alvo={alvo} evita={evita} titulo={dica.texto} fala={dica.texto} passo={i} total={dicas.length}
      tom="ciano" acao={{ rotulo: "Entendi", onClick: i + 1 >= dicas.length ? fechar : () => setI(i + 1) }} onPular={fechar} />
  );
}
