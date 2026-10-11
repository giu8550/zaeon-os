"use client";
/** O retrato do DROID (um ofanim de luz: dois anéis cruzados girando, os olhos e a luz no centro) — a caixa de diálogo
 *  do tutorial no cyberespaço e o balão dele no tablet */
import { useId } from "react";

export default function RetratoDroid({ cor }: { cor: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6dc" />
          <stop offset="45%" stopColor={cor} stopOpacity="0.9" />
          <stop offset="100%" stopColor={cor} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill="#0b0716" />
      <g className="motion-safe:animate-[spin_9s_linear_infinite]" style={{ transformOrigin: "40px 40px" }}>
        <ellipse cx="40" cy="40" rx="30" ry="11" fill="none" stroke={cor} strokeWidth="2.4" opacity="0.9" />
        <ellipse cx="40" cy="40" rx="11" ry="30" fill="none" stroke={cor} strokeWidth="2.4" opacity="0.75" />
      </g>
      <circle cx="40" cy="40" r="22" fill="none" stroke={cor} strokeWidth="1.2" strokeDasharray="3 4" opacity="0.6" />
      <circle cx="40" cy="40" r="13" fill={`url(#${id})`} />
      {[[40, 12], [68, 40], [40, 68], [12, 40]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" fill="#fff6dc" />)}
    </svg>
  );
}

