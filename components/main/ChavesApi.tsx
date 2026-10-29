"use client";

/**
 * ChavesApi — "ou traga as chaves de API dos seus": o briefing de como as chaves de API entram na Zaeon.
 * ESBOÇO assumido (o selo "em construção" fica na tela): a Zaeon já roda sobre várias casas de modelos
 * (ver "Equipados com"); trazer a PRÓPRIA chave é o próximo passo e este é o desenho do produto. Embaixo, o card do
 * projeto vencedor da categoria blockchain (no lugar dos cards de passo a passo — o dono, out/2026).
 */
import { TituloSecao } from "@/components/layout/secao";
import TextoRevelado from "@/components/ui/TextoRevelado";
import EquipadosCom from "./EquipadosCom";
import ProjetoVencedor from "./ProjetoVencedor";

export default function ChavesApi({ className = "" }: { className?: string }) {
  return (
    <section id="chaves" aria-labelledby="chaves-titulo" className={`zaeon-borda relative z-40 w-full scroll-mt-28 ${className}`}>
      <div id="chaves-titulo" className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <TituloSecao className="font-display !mt-0" forte="ou traga as chaves de API dos seus." />
        <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-amber-600 dark:text-amber-300">
          esboço · em construção
        </span>
      </div>
      <p className="mt-5 max-w-[560px] font-display text-base md:text-lg font-light leading-relaxed text-slate-900 dark:text-white">
        <TextoRevelado texto="Os agentes da Zaeon já falam com todas as grandes casas de modelos. Se você tem a sua própria chave, ela entra aqui e os agentes passam a rodar na sua conta." delay={0.15} />
      </p>

      {/* no lugar dos cards de passo a passo: o card do PRODUTO VENCEDOR na categoria blockchain (o dono, out/2026) */}
      <ProjetoVencedor className="mt-12" />

      {/* as casas de modelos (âncora #modelos do "Ver os modelos") */}
      <div id="modelos" className="scroll-mt-24">
        <EquipadosCom className="mt-12" />
      </div>
    </section>
  );
}
