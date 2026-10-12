"use client";
/**
 * TutorialLab — o tour da 1ª missão DENTRO do tablet (lib/onboarding/tutorialLab). Só existe no laboratório aberto pelo
 * tutorial do cyberespaço (`?tablet=1&tutorial=1`). Escurece a tela em volta do card da vez (o DESTAQUE, que deixa
 * clicar), e o Droid fala num balão de RPG. Cada etapa anda com a ação certa (evento) ou, nas de só ver, com "Próximo".
 * No tema, leva a pessoa pro Marketplace › Estudos já pesquisando; no fim, com a pesquisa SALVA de verdade, avisa o
 * cyberespaço (o Droid interrompe o tablet).
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { BotaoDroid, OverlayDroid, useDestaque } from "@/components/onboard/BalaoDroid";
import { irPraAbaEstudos } from "@/lib/chat/conversasNav";
import { MSG_PESQUISA_SALVA, MSG_TUTORIAL_ETAPA, type PesquisaSalva } from "@/lib/ui/loungeHub";
import { getDraftState } from "@/lib/research/draftRun";
import {
  EVT_ESTUDOS_VISTA, EVT_OMEGA_RODAR, EVT_PESQUISA_SALVA, EVT_TEMA, SALTOS_LAB, assinarTutorialLab, avancarAte, avancarTutorialLab, encerrarTutorialLab,
  etapaDe, falaDaEtapa, iniciarTutorialLab, lerTutorialLab,
} from "@/lib/onboarding/tutorialLab";

export default function TutorialLab() {
  const st = useSyncExternalStore(assinarTutorialLab, lerTutorialLab, lerTutorialLab);
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); iniciarTutorialLab(); }, []);
  const etapa = etapaDe(st.etapa);
  const { alvo, evita } = useDestaque(etapa.alvos, etapa.evitar, st.ativo);

  // a etapa de agora → o cyberespaço (o tablet destaca o "Guardar"; o Droid de lá ensina a concorrência)
  useEffect(() => {
    try { window.parent?.postMessage({ type: MSG_TUTORIAL_ETAPA, etapa: st.ativo ? st.etapa : "fim" }, window.location.origin); } catch { /* fora do tablet */ }
  }, [st.ativo, st.etapa]);

  // o TEMA (a 1ª etapa): vai pro Marketplace › Estudos, direto na tela roxa, já pesquisando
  useEffect(() => {
    if (!st.ativo || st.etapa !== "tema") return;
    const f = (e: Event) => {
      const tema = String((e as CustomEvent).detail?.tema ?? "").trim(); if (!tema) return;
      avancarTutorialLab({ tema });
      irPraAbaEstudos("community");
      window.dispatchEvent(new CustomEvent(EVT_ESTUDOS_VISTA, { detail: "pesquisar" }));
      setTimeout(() => window.dispatchEvent(new CustomEvent(EVT_OMEGA_RODAR, { detail: { prompt: tema } })), 350);
    };
    window.addEventListener(EVT_TEMA, f);
    return () => window.removeEventListener(EVT_TEMA, f);
  }, [st.ativo, st.etapa]);

  // depois do tema, as AÇÕES valem EM QUALQUER etapa: fazer algo mais adiante pula o tour até lá — o tour nunca fica
  // esperando uma ação que já aconteceu (o bug do "gerei a pesquisa mas não reconheceu": o botão Gerar já está na tela
  // enquanto o Droid mostra as referências). Salvar de verdade, a qualquer momento, encerra a missão
  useEffect(() => {
    if (!st.ativo || st.etapa === "tema" || st.etapa === "fim") return;
    const offs = Object.entries(SALTOS_LAB).map(([ev, ate]) => {
      const f = (e: Event) => { const d = (e as CustomEvent).detail; if (ev === "zaeon:research:draftdone" && d && d.ok === false) return; avancarAte(ate); };
      window.addEventListener(ev, f); return () => window.removeEventListener(ev, f);
    });
    const salva = (e: Event) => {
      const d = (e as CustomEvent).detail;
      const p: PesquisaSalva = { titulo: String(d?.titulo || st.tema || "Minha pesquisa"), palavras: Number(d?.palavras) || 0, workId: d?.workId ?? null };
      try { window.parent?.postMessage({ type: MSG_PESQUISA_SALVA, pesquisa: p }, window.location.origin); } catch { /* fora do tablet */ }
      encerrarTutorialLab();
    };
    window.addEventListener(EVT_PESQUISA_SALVA, salva);
    // a pesquisa sugerida JÁ estava gerada (o painel abre direto no "Iniciar pesquisa"): não espera gerar de novo
    if (st.etapa === "gerar" && getDraftState().status === "done") avancarAte("abrir");
    return () => { for (const o of offs) o(); window.removeEventListener(EVT_PESQUISA_SALVA, salva); };
  }, [st.ativo, st.etapa, st.tema]);

  if (!montado || !st.ativo || st.etapa === "fim") return null;
  // as etapas de "ver" têm o Próximo; nas de AÇÃO o balão não tem botão e o clique atravessa ele
  return <OverlayDroid alvo={alvo} evita={evita} fala={falaDaEtapa(etapa, st.tema)}
    botoes={etapa.avancaEm.length === 0 ? <BotaoDroid onClick={() => avancarTutorialLab()}>Próximo ▸</BotaoDroid> : undefined} />;
}
