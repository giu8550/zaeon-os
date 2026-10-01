"use client";

/**
 * AgentAvatar — foto do agente (AgentProfile.avatarUrl) com fallback GRACIOSO: sem foto (ou
 * foto que falhou) mostra a inicial do nome num disco de vidro. Nunca quebra, nunca 404 na
 * cara do usuário. Mesmo componente na landing, no canal e no admin.
 */
import { useState } from "react";
import { inicial } from "@/lib/agents/roster";

export default function AgentAvatar({
  src, nome, size = 32, className = "", emoji,
}: { src?: string | null; nome: string; size?: number; className?: string; emoji?: string | null }) {
  const [falhou, setFalhou] = useState(false);
  const ok = !!src && !falhou;
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.42)) };
  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/70 dark:border-white/15 bg-gradient-to-br from-sky-200/80 to-blue-300/60 dark:from-cyan-500/25 dark:to-blue-500/20 text-blue-900 dark:text-cyan-100 font-bold select-none shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] ${className}`}
      style={style}
      title={nome}
      aria-label={nome}
    >
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src!} alt="" aria-hidden className="h-full w-full object-cover" onError={() => setFalhou(true)} loading="lazy" />
      ) : (
        <span aria-hidden>{emoji && emoji !== "⟁" ? emoji : inicial(nome)}</span>
      )}
    </span>
  );
}
