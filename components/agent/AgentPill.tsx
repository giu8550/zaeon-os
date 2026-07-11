"use client";

/**
 * AgentPill — indicador do agente ATIVO no co-working.
 *
 * Padrão da casa: EMPILHADO — ⟁ (triângulo) em cima, nome do agente embaixo na
 * fonte tech (Inter Tight), tudo cravado na pill de fundo (liquid-glass). Sem
 * rótulo de contexto ("Sala de Estudos") e sem bolinha de "online".
 * Preparado pra virar SELETOR de agentes na Fase 2: passe `onClick`.
 */

export type AgentPillProps = {
  /** Nome do agente ativo. Default: "Aura". */
  name?: string;
  /** Se o agente está "trabalhando" (dá um pulse sutil no triângulo). */
  busy?: boolean;
  /** Habilita clique (troca de agente na Fase 2). */
  onClick?: () => void;
  className?: string;
};

export default function AgentPill({
  name = "Aura",
  busy = false,
  onClick,
  className = "",
}: AgentPillProps) {
  const interactive = typeof onClick === "function";
  const Comp: any = interactive ? "button" : "div";

  return (
    <Comp
      {...(interactive ? { onClick, type: "button" } : {})}
      aria-label={`Agente ativo: ${name}`}
      className={`inline-flex flex-col items-center justify-center gap-1 rounded-2xl px-5 py-3 font-tech
        bg-white/70 dark:bg-white/[0.05] backdrop-blur-xl
        border border-white/70 dark:border-white/10
        shadow-[0_14px_36px_-18px_rgba(37,99,235,0.5)]
        transition-colors ${interactive ? "hover:border-cyan-400/50 cursor-pointer" : ""} ${className}`}
    >
      {/* ⟁ em cima */}
      <span
        className={`text-[22px] leading-none text-cyan-600 dark:text-cyan-300 ${busy ? "animate-pulse" : ""} motion-reduce:animate-none`}
        style={{ filter: "drop-shadow(0 0 6px rgba(34,211,238,0.55))" }}
      >
        ⟁
      </span>
      {/* nome do agente embaixo, fonte tech */}
      <span className="text-[14px] font-medium tracking-[0.03em] text-slate-800 dark:text-white/90 leading-none">
        {name}
      </span>
    </Comp>
  );
}
