"use client";

/**
 * SolanaMark — logomark OFICIAL da Solana (brand kit solana.com/branding), sem distorção:
 * três barras em paralelogramo com o gradiente oficial verde (#00FFA3) → roxo (#DC1FFF).
 * Não recolorir, não girar, não esticar. `useId` evita colisão do gradiente com várias marcas na página.
 *
 * Uso: <SolanaMark size={20} /> (só a marca) · <SolanaMark size={16} wordmark /> (marca + "Solana").
 */
import { useId } from "react";

type Props = {
  size?: number;
  /** mostra o nome ao lado da marca */
  wordmark?: boolean;
  /** rótulo acessível (default: "Solana") */
  title?: string;
  className?: string;
};

export default function SolanaMark({ size = 20, wordmark = false, title = "Solana", className }: Props) {
  const id = useId().replace(/:/g, "");
  const grad = `solana-grad-${id}`;
  // viewBox oficial do logomark: 397.7 × 311.7
  const h = size;
  const w = Math.round((size * 397.7) / 311.7);
  return (
    <span className={`inline-flex items-center gap-2 align-middle ${className ?? ""}`}>
      <svg
        width={w}
        height={h}
        viewBox="0 0 397.7 311.7"
        role={title ? "img" : undefined}
        aria-label={title || undefined}
        aria-hidden={title ? undefined : true}
        focusable="false"
        className="shrink-0"
      >
        {title && <title>{title}</title>}
        <defs>
          <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1="360.8791" y1="351.4553" x2="141.213" y2="-69.2936" gradientTransform="matrix(1 0 0 -1 0 314)">
            <stop offset="0" stopColor="#00FFA3" />
            <stop offset="1" stopColor="#DC1FFF" />
          </linearGradient>
        </defs>
        <path fill={`url(#${grad})`} d="M64.6,237.9c2.4-2.4,5.7-3.8,9.2-3.8h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,237.9z" />
        <path fill={`url(#${grad})`} d="M64.6,3.8C67.1,1.4,70.4,0,73.8,0h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,3.8z" />
        <path fill={`url(#${grad})`} d="M333.1,120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8,0-8.7,7-4.6,11.1l62.7,62.7c2.4,2.4,5.7,3.8,9.2,3.8h317.4c5.8,0,8.7-7,4.6-11.1L333.1,120.1z" />
      </svg>
      {wordmark && (
        <span className="font-black tracking-tight leading-none text-slate-900 dark:text-white" style={{ fontSize: Math.max(11, Math.round(size * 0.85)) }}>
          Solana
        </span>
      )}
    </span>
  );
}

/** Selo compacto "verificável na Solana" (marca oficial + texto), pra cards e badges. */
export function SolanaSelo({ title = "Verificável na Solana", className }: { title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-2 py-[3px] text-[9px] font-black uppercase tracking-widest text-white backdrop-blur ${className ?? ""}`}
    >
      <SolanaMark size={9} title="" />
      Solana
    </span>
  );
}
