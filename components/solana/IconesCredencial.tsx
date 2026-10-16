"use client";

/**
 * IconesCredencial — família de ícones da camada verificável (mesmo traço: 24×24, stroke 1.6,
 * cantos redondos, currentColor). Um por etapa/pilar do fluxo "produzido → revisado → credencial":
 *
 *   agentes      produção (agentes de IA)
 *   identidade   papéis e vínculo (aluno · professor vinculado · instituição)
 *   chancela     a chancela humana (carimbo) — nada vira credencial sem ela
 *   revisor      o revisor humano (pessoa + check)
 *   livro        livro-razão append-only (AuraEvent)
 *   economia     AURA (reputação derivada do ledger)
 *   credencial   credencial verificável (medalha)
 *   hash         integridade sem revelar (sha256 do documento)
 *   privacidade  o que fica privado (cadeado)
 *   portavel     a credencial é do aluno e sai com ele (carteira)
 *
 * Acessibilidade: com `title` vira role="img"; sem `title` é decorativo (aria-hidden).
 */
import type { SVGProps } from "react";

export type NomeIcone =
  | "agentes" | "identidade" | "chancela" | "revisor" | "livro" | "economia"
  | "credencial" | "hash" | "privacidade" | "portavel";

const PATHS: Record<NomeIcone, JSX.Element> = {
  agentes: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </>
  ),
  identidade: (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20c0-3.6 2.9-6 6.5-6 1.2 0 2.3.3 3.2.8" />
      <path d="M17 13.5l3.5 1.4v2.6c0 2.1-1.5 3.6-3.5 4.3-2-.7-3.5-2.2-3.5-4.3v-2.6l3.5-1.4z" />
    </>
  ),
  chancela: (
    <>
      <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
      <path d="M5 14.5c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2V16H5v-1.5z" />
      <path d="M6 16v3.5h12V16" />
      <path d="M9.5 13.8l1.8 1.7 3.2-3.2" />
    </>
  ),
  revisor: (
    <>
      <circle cx="9.5" cy="7.5" r="3.5" />
      <path d="M3 20c0-3.6 2.9-6.2 6.5-6.2 1.1 0 2.1.2 3 .6" />
      <circle cx="17" cy="16.5" r="4" />
      <path d="M15.3 16.6l1.2 1.2 2.3-2.4" />
    </>
  ),
  livro: (
    <>
      <path d="M5 4.5h11a2 2 0 0 1 2 2V19a1.5 1.5 0 0 0 1.5 1.5H6.5A1.5 1.5 0 0 1 5 19V4.5z" />
      <path d="M18 6.5h1a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 20.5" />
      <path d="M8.5 9h6M8.5 12.5h6M8.5 16h3.5" />
      <path d="M15 15.5l1 1 1.8-2" />
    </>
  ),
  economia: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2" />
      <path d="M6.7 6.7l1.4 1.4M15.9 15.9l1.4 1.4M6.7 17.3l1.4-1.4M15.9 8.1l1.4-1.4" strokeOpacity="0.55" />
      <circle cx="12" cy="12" r="7.5" strokeDasharray="2.5 3" strokeOpacity="0.55" />
    </>
  ),
  credencial: (
    <>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M9.5 9.2l1.7 1.6 3.3-3.3" />
      <path d="M8.5 13.5L6.5 21l5.5-2.5 5.5 2.5-2-7.5" />
    </>
  ),
  hash: (
    <>
      <path d="M12 2.8l7.8 4.5v9.4L12 21.2l-7.8-4.5V7.3L12 2.8z" />
      <path d="M9.5 8.5l-1 7M15.5 8.5l-1 7M7.5 10.5h9M7.5 13.5h9" />
    </>
  ),
  privacidade: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
      <circle cx="12" cy="15.3" r="1.3" />
      <path d="M12 16.6v1.6" />
    </>
  ),
  portavel: (
    <>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H17a2 2 0 0 1 2 2v1" />
      <rect x="4" y="9" width="16" height="10.5" rx="2.5" />
      <path d="M15 13h5v3h-5a1.5 1.5 0 0 1 0-3z" />
    </>
  ),
};

type Props = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: NomeIcone;
  size?: number;
  /** rótulo acessível; sem ele o ícone é decorativo */
  title?: string;
};

export default function IconeCredencial({ name, size = 24, title, className, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={className}
      {...rest}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}

/** Medalhão redondo com o ícone dentro (o "selo" usado nos pilares e nas etapas). */
export function MedalhaoIcone({ name, title, size = 44, tom = "cyan", className }: { name: NomeIcone; title?: string; size?: number; tom?: "cyan" | "amber" | "emerald" | "violet"; className?: string }) {
  const TOM = {
    cyan: "text-cyan-600 dark:text-cyan-300 border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_24px_rgba(34,211,238,0.18)]",
    amber: "text-amber-600 dark:text-amber-300 border-amber-500/30 bg-amber-500/10 shadow-[0_0_24px_rgba(245,158,11,0.18)]",
    emerald: "text-emerald-600 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_24px_rgba(52,211,153,0.18)]",
    violet: "text-violet-600 dark:text-violet-300 border-violet-500/30 bg-violet-500/10 shadow-[0_0_24px_rgba(167,139,250,0.18)]",
  }[tom];
  return (
    <span className={`inline-flex items-center justify-center rounded-full border ${TOM} ${className ?? ""}`} style={{ width: size, height: size }}>
      <IconeCredencial name={name} title={title} size={Math.round(size * 0.5)} />
    </span>
  );
}
