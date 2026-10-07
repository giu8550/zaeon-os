"use client";

/**
 * RostoDaAba — a "bolinha" da aba do chat É o rosto do agente, espelhando a conversa de qualquer
 * lugar da sala (presença): pensa, fala, sorri. Se ela terminou de responder enquanto você estava
 * em outra aba, aparece um anel pulsando ("respondeu") até você voltar pro chat.
 * Sem avatar vivo pro agente → `children` (o ⟁ de sempre).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import AgentAvatar from "@/components/agents/AgentAvatar";
import { useManifesto, usePresenca } from "./hooks";

export default function RostoDaAba({ agentId, nome, ativa, size = 24, children }: { agentId: string; nome: string; ativa: boolean; size?: number; children?: ReactNode }) {
  const manifest = useManifesto(agentId);
  const { sinal } = usePresenca(agentId);
  const anterior = useRef(sinal);
  const [naoVisto, setNaoVisto] = useState(false);
  useEffect(() => {
    const antes = anterior.current;
    anterior.current = sinal;
    if (!ativa && (antes === "falando" || antes === "pensando") && sinal !== "falando" && sinal !== "pensando") setNaoVisto(true);
  }, [sinal, ativa]);
  useEffect(() => { if (ativa) setNaoVisto(false); }, [ativa]);
  if (!manifest) return <>{children}</>;
  return (
    <span className="relative inline-flex shrink-0" title={naoVisto ? `${nome} respondeu` : nome}>
      <AgentAvatar agentId={agentId} manifest={manifest} nome={nome} size={size} presenca destaque={ativa} />
      {naoVisto && (
        <>
          <span aria-hidden className="absolute inset-0 rounded-full ring-2 ring-cyan-400 animate-ping motion-reduce:animate-none" />
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 border-2 border-white dark:border-[#0b1020]" />
          <span className="sr-only">{nome} respondeu</span>
        </>
      )}
    </span>
  );
}
