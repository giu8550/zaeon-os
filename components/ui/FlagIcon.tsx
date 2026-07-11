"use client";

/**
 * FlagIcon — bandeiras reconhecíveis em SVG (br, us, es) para o seletor de idioma.
 * ViewBox quadrado + preserveAspectRatio "slice": preenche bem um contêiner
 * redondo (é só envolver com rounded-full overflow-hidden).
 */

export type FlagCode = "br" | "us" | "es";

export default function FlagIcon({ code, className = "" }: { code: FlagCode; className?: string }) {
  const common = { viewBox: "0 0 60 60", className, preserveAspectRatio: "xMidYMid slice" as const };

  if (code === "es") {
    // Espanha — rojigualda (vermelho / amarelo dobrado / vermelho)
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg" aria-label="Español">
        <rect width="60" height="60" fill="#AA151B" />
        <rect y="15" width="60" height="30" fill="#F1BF00" />
      </svg>
    );
  }

  if (code === "us") {
    // EUA — 7 faixas + cantão azul com estrelas
    const stripeH = 60 / 7;
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg" aria-label="English">
        <rect width="60" height="60" fill="#fff" />
        {[0, 2, 4, 6].map((i) => (
          <rect key={i} y={i * stripeH} width="60" height={stripeH} fill="#B22234" />
        ))}
        <rect width="30" height={stripeH * 4} fill="#3C3B6E" />
        {[...Array(3)].map((_, r) =>
          [...Array(4)].map((_, c) => (
            <circle
              key={`${r}-${c}`}
              cx={4 + c * 7.5 + (r % 2 ? 3.75 : 0)}
              cy={5 + r * 8}
              r="1.6"
              fill="#fff"
            />
          )),
        )}
      </svg>
    );
  }

  // Brasil — verde, losango amarelo, círculo azul + faixa branca
  return (
    <svg {...common} xmlns="http://www.w3.org/2000/svg" aria-label="Português">
      <rect width="60" height="60" fill="#009C3B" />
      <polygon points="30,7 53,30 30,53 7,30" fill="#FFDF00" />
      <circle cx="30" cy="30" r="10.5" fill="#002776" />
      <path d="M20.5 32.5 Q30 26.5 39.5 32.5" stroke="#fff" strokeWidth="2.2" fill="none" />
    </svg>
  );
}
