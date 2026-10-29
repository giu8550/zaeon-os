"use client";

import ZaeonVitrine from "@/components/main/ZaeonVitrine";

/**
 * A moldura da Zaeon no hero (Figma zaeon-design, out/2026): só o card de vidro escuro e ela — o dono pediu "algo mais
 * liso": sem as fitas em volta e sem o pedestal com o botão. Dentro, a Zaeon na VITRINE (components/main/ZaeonVitrine):
 * pensando, pesquisando e gerando os blueprints dos entregáveis em laço; a cena vaza pelas bordas do card (os
 * hologramas), o card é o palco.
 */
export default function ZaeonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none ${className}`}>
      {/* o card */}
      <div className="absolute inset-x-[10%] bottom-[4%] top-[2%] overflow-hidden rounded-[22px] border border-white/10 bg-gradient-to-b from-[#12304a]/70 via-[#0c1726]/70 to-[#0a0f18]/40 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur-[2px]">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(103,216,242,0.22),transparent_65%)]" />
      </div>

      {/* a Zaeon e a cena dela: maior que o card (os blueprints vazam pelos lados), some em degradê no pé do card */}
      <ZaeonVitrine className="!absolute -inset-x-[32%] bottom-[4%] top-[-2%] [mask-image:linear-gradient(to_bottom,black_80%,transparent)]" />
    </div>
  );
}
