"use client";
/**
 * DicasRapidas — #618: um balão por vez, na 1ª vez que a pessoa entra no lugar (lib/onboarding/dicas). "Entendi" vai
 * pra próxima; Esc fecha (sem perguntar: é só uma dica). Espera um tour do laboratório ou do tablet acabar.
 */
import { useEffect, useState } from "react";
import { EVT_REVER_TOURS } from "@/lib/onboarding/reverTours";
import { OverlayTour, useDestaque } from "@/components/onboard/BalaoTour";
import { getTour } from "@/lib/onboarding/tour";
import { tourDoLabAtivo } from "@/lib/onboarding/tourSala";
import { deveMostrarDicas, dicasVistas, marcarDicaAtiva, marcarDicasVistas, type Dica } from "@/lib/onboarding/dicas";

const SEM_ALVOS: string[] = [];

export default function DicasRapidas({ lugar, dicas }: { lugar: string; dicas: Dica[] }) {
  const [i, setI] = useState<number | null>(null);
  // "Rever tutorial" com a tela aberta: começa de novo (sem precisar sair e voltar)
  const [rodada, setRodada] = useState(0);
  useEffect(() => {
    const rever = () => setRodada((r) => r + 1);
    window.addEventListener(EVT_REVER_TOURS, rever);
    return () => window.removeEventListener(EVT_REVER_TOURS, rever);
  }, []);
  // espera a tela assentar e nenhum tour estar rodando (confere de novo a cada segundo)
  useEffect(() => {
    if (dicasVistas(lugar)) return;
    const t = setInterval(() => {
      if (deveMostrarDicas({ visto: dicasVistas(lugar), largura: window.innerWidth, outroTour: getTour().active || tourDoLabAtivo() })) { setI(0); clearInterval(t); }
    }, 1200);
    return () => clearInterval(t);
  }, [lugar, rodada]);
  const dica = i === null ? null : dicas[i] ?? null;
  // com uma dica na tela, os tours esperam (lib/onboarding/dicas)
  useEffect(() => { marcarDicaAtiva(!!dica); }, [dica]);
  useEffect(() => () => marcarDicaAtiva(false), []);
  const fechar = () => { marcarDicasVistas(lugar); setI(null); };
  const seguir = (k: number) => (k + 1 >= dicas.length ? fechar() : setI(k + 1));
  // #629: a dica aponta pra algo que não está na tela (um blueprint sem crítico, por ex.)? pula ela em vez de apontar o vazio
  const alvoDaVez = dica?.alvo;
  useEffect(() => {
    if (!alvoDaVez || i === null) return;
    const t = setTimeout(() => { if (!document.querySelector(alvoDaVez)) seguir(i); }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvoDaVez, i]);
  const { alvo, evita } = useDestaque(dica ? [dica.alvo] : SEM_ALVOS, SEM_ALVOS, !!dica);
  if (!dica || i === null) return null;
  return (
    <OverlayTour dica chave={`${lugar}-${i}`} alvo={alvo} evita={evita} titulo={dica.texto} fala={dica.texto} passo={i} total={dicas.length}
      tom="ciano" acao={{ rotulo: "Entendi", onClick: () => seguir(i) }} onPular={fechar} />
  );
}
