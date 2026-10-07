"use client";

/**
 * AgentePilula — o agente "ao lado da resposta": avatar vivo pequeno + nome, reagindo ao turno
 * (pensando → falando enquanto o stream chega → sorri ao concluir). Vai SÓ na resposta mais
 * recente (1 avatar vivo no chat). Sem avatar vivo pro agente → não renderiza nada (o chat fica
 * exatamente como era).
 */
import AgentAvatar from "@/components/agents/AgentAvatar";
import { useManifesto } from "./hooks";
import type { SinalAvatar } from "@/lib/avatars/estados";

export default function AgentePilula({ agentId, nome, estado, className = "" }: { agentId: string; nome: string; estado: SinalAvatar; className?: string }) {
  const manifest = useManifesto(agentId);
  if (!manifest) return null;
  return (
    <span className={`inline-flex items-center gap-2 mb-1.5 pl-0.5 pr-2.5 py-0.5 rounded-full bg-white/60 dark:bg-white/[0.05] border border-white/70 dark:border-white/10 ${className}`}>
      <AgentAvatar agentId={agentId} manifest={manifest} nome={nome} size={30} estado={estado} destaque />
      <span className="font-tech text-[12.5px] font-medium tracking-[0.02em] text-slate-700 dark:text-white/80">{nome}</span>
    </span>
  );
}
