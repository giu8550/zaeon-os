"use client";

/**
 * BoasVindasAgente — o chat VAZIO tem rosto: só a Aura grande, sem texto. Ela SE APRESENTA
 * FALANDO, com a voz de verdade (saudação do manifesto, uma por vez em rodízio) e a boca segue o
 * áudio. Toca sozinha uma vez por sessão quando o navegador permite (o usuário já interagiu com
 * a página); tocar no rosto faz ela falar de novo. Enquanto a pessoa digita, ela OUVE (inclina e
 * acena); ao enviar, o rosto VIAJA (layoutId compartilhado com a AgentePilula) até a 1ª resposta.
 * Sem avatar vivo pro agente → não renderiza (o chat fica como era).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import AgentAvatar from "@/components/agents/AgentAvatar";
import { useManifesto } from "./hooks";
import { falarClipe, type Fala } from "./falar";
import { definirPresenca } from "@/lib/avatars/presenca";
import type { SinalAvatar } from "@/lib/avatars/estados";

export const layoutIdRosto = (agentId: string) => `rosto-vivo-${agentId}`;

const CHAVE_SESSAO = (id: string) => `zaeon:saudou:${id}`;
const CHAVE_RODIZIO = (id: string) => `zaeon:saudacao:${id}`;

export default function BoasVindasAgente({ agentId, nome, sinal }: { agentId: string; nome: string; sinal: SinalAvatar }) {
  const manifest = useManifesto(agentId);
  const [nivel, setNivel] = useState<number | null>(null);
  const fala = useRef<Fala | null>(null);
  const saudacoes = manifest?.voz?.saudacoes ?? [];

  const saudar = useCallback(() => {
    if (!saudacoes.length) return;
    let i = 0;
    try { i = (Number(localStorage.getItem(CHAVE_RODIZIO(agentId))) || 0) % saudacoes.length; localStorage.setItem(CHAVE_RODIZIO(agentId), String(i + 1)); } catch { /* sem storage: a 1ª */ }
    fala.current = falarClipe(saudacoes[i], (n) => {
      setNivel(n);
      // a bolinha da aba (e qualquer rosto da Aura) fala junto
      definirPresenca(agentId, n === null ? { sinal: "idle", boca: null } : { sinal: "falando", boca: n });
    });
    fala.current.fim.catch(() => { /* autoplay bloqueado: fica pro toque no rosto */ });
  }, [agentId, saudacoes]);

  // uma vez por sessão, sozinha — se o navegador deixa tocar áudio (usuário já interagiu)
  useEffect(() => {
    if (!saudacoes.length) return;
    let ja = false;
    try { ja = sessionStorage.getItem(CHAVE_SESSAO(agentId)) === "1"; } catch { /* segue */ }
    const ativo = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive;
    if (ja || !ativo) return;
    try { sessionStorage.setItem(CHAVE_SESSAO(agentId), "1"); } catch { /* segue */ }
    const t = setTimeout(saudar, 600);
    return () => clearTimeout(t);
  }, [agentId, saudacoes.length, saudar]);

  // saiu do chat vazio (mandou a 1ª mensagem / trocou de sala) → ela para de falar
  useEffect(() => () => { fala.current?.parar(); }, []);

  if (!manifest) return null;
  const falando = nivel !== null;
  return (
    <div className="flex flex-col items-center py-10 sm:py-14 select-none">
      <motion.span layoutId={layoutIdRosto(agentId)} className="inline-flex rounded-full" transition={{ type: "spring", stiffness: 140, damping: 22 }}>
        <button
          type="button"
          onClick={() => (falando ? fala.current?.parar() : saudar())}
          disabled={!saudacoes.length}
          aria-label={falando ? `${nome} está falando — tocar pra parar` : `${nome} — este chat é ela. Tocar pra ouvir`}
          className="rounded-full outline-none focus-visible:ring-4 focus-visible:ring-cyan-400/60 disabled:cursor-default"
        >
          <AgentAvatar agentId={agentId} manifest={manifest} nome={nome} size={128}
            estado={falando ? "falando" : sinal} boca={nivel} destaque
            className="shadow-[0_18px_50px_-18px_rgba(124,58,237,0.65)] ring-4 ring-white/70 dark:ring-white/10" />
        </button>
      </motion.span>
    </div>
  );
}
