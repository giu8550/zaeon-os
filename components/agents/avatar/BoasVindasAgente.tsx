"use client";

/**
 * BoasVindasAgente — o chat VAZIO tem rosto: a Aura grande, se apresentando como a própria
 * conversa ("é comigo que você fala aqui"). Enquanto a pessoa digita, ela OUVE (inclina e acena);
 * ao enviar, o rosto VIAJA (layoutId compartilhado com a AgentePilula) até a primeira resposta —
 * o usuário vê que quem responde é ela. Sem avatar vivo pro agente → não renderiza (chat como era).
 */
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import AgentAvatar from "@/components/agents/AgentAvatar";
import { useManifesto } from "./hooks";
import type { SinalAvatar } from "@/lib/avatars/estados";

export const layoutIdRosto = (agentId: string) => `rosto-vivo-${agentId}`;

export default function BoasVindasAgente({
  agentId, nome, sinal, convite = "Pergunta o que quiser, pede um resumo ou me manda um PDF — eu respondo aqui mesmo.",
}: { agentId: string; nome: string; sinal: SinalAvatar; convite?: string }) {
  const manifest = useManifesto(agentId);
  const { data } = useSession();
  if (!manifest) return null;
  const primeiro = (data?.user?.name || "").trim().split(/\s+/)[0];
  const ouvindo = sinal === "ouvindo";
  return (
    <div className="flex flex-col items-center text-center gap-4 py-8 sm:py-12 select-none">
      <motion.span layoutId={layoutIdRosto(agentId)} className="inline-flex rounded-full" transition={{ type: "spring", stiffness: 140, damping: 22 }}>
        <AgentAvatar agentId={agentId} manifest={manifest} nome={nome} size={112} estado={sinal} destaque
          className="shadow-[0_18px_50px_-18px_rgba(124,58,237,0.65)] ring-4 ring-white/70 dark:ring-white/10" />
      </motion.span>
      <div className="flex flex-col items-center gap-1.5 max-w-[34ch]">
        <h2 className="font-tech text-[22px] sm:text-[24px] font-semibold tracking-tight text-slate-900 dark:text-white">
          Oi{primeiro ? `, ${primeiro}` : ""}! Eu sou a {nome}.
        </h2>
        <p className="text-[14px] leading-relaxed text-slate-600 dark:text-white/65" aria-live="polite">
          {ouvindo ? "Tô te ouvindo… pode mandar quando quiser." : <>Este chat <b className="font-semibold text-slate-800 dark:text-white/85">sou eu</b>. {convite}</>}
        </p>
      </div>
    </div>
  );
}
