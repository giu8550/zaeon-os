"use client";

/**
 * SponsorsMarquee — faixa fina de sponsors rolando na horizontal, pensada pra
 * ficar fixa na BORDA INFERIOR da tela inicial (splash). Loop contínuo (x 0→-50%
 * com a lista duplicada). Cards discretos com o logo de cada apoiador.
 */

import { motion } from "framer-motion";
import NextImage from "next/image";

const SPONSORS = [
  { name: "Funcap", src: "/sponsors/funcap.png", url: "https://www.funcap.ce.gov.br/" },
  { name: "Centelha", src: "/sponsors/centelha.png", url: "https://programacentelha.com.br/ce/" },
  { name: "Sudene", src: "/sponsors/sudene.png", url: "https://www.gov.br/sudene" },
  { name: "Finep", src: "/sponsors/finep.png", url: "http://www.finep.gov.br/" },
  { name: "Cnpq", src: "/sponsors/cnpq.png", url: "https://www.gov.br/cnpq/pt-br" },
];

export default function SponsorsMarquee() {
  const items = [...SPONSORS, ...SPONSORS];

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 pointer-events-none">
      {/* Degradê acima da barra: ela derrete no vídeo em vez de aparecer como
          uma faixa colada com aresta dura. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-full h-20 bg-gradient-to-t from-black/75 to-transparent" />
      <div
        className="w-full overflow-hidden border-t border-white/[0.07]
          bg-black/50 backdrop-blur-md"
      >
        <div className="flex whitespace-nowrap py-3.5">
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            transition={{ ease: "linear", duration: 30, repeat: Infinity }}
            className="flex items-center gap-12 px-8 shrink-0"
          >
            {items.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={s.name}
                className="pointer-events-auto relative flex items-center justify-center h-12 w-[150px] shrink-0
                  opacity-90 hover:opacity-100 transition-opacity
                  [&_img]:brightness-110 [&_img]:contrast-105
                  [&_img]:drop-shadow-[0_0_10px_rgba(255,255,255,0.28)]"
              >
                <NextImage src={s.src} alt={s.name} fill unoptimized className="object-contain" sizes="150px" />
              </a>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
