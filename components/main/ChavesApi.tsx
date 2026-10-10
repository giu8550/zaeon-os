"use client";

/**
 * ChavesApi — "ou traga as chaves de API dos seus": o briefing de como as chaves de API entram na Zaeon.
 * ESBOÇO assumido (o selo "em construção" fica na tela): a Zaeon já roda sobre várias casas de modelos
 * (ver "Equipados com"); trazer a PRÓPRIA chave é o próximo passo e este é o desenho do produto.
 */
import { motion } from "framer-motion";
import { TituloSecao } from "@/components/layout/secao";
import TextoRevelado from "@/components/ui/TextoRevelado";
import IconeCredencial, { type NomeIcone } from "@/components/solana/IconesCredencial";
import EquipadosCom from "./EquipadosCom";

const PASSOS: { icone: NomeIcone; t: string; d: string }[] = [
  { icone: "portavel", t: "Cole a sua chave", d: "OpenAI, Anthropic, Google, xAI, Mistral, DeepSeek… a chave entra uma vez, cifrada, e nunca aparece de novo na tela." },
  { icone: "identidade", t: "Escolha quem usa", d: "Quais agentes, salas e mentores rodam com a sua chave — e quais seguem na conta da Zaeon. Troca quando quiser." },
  { icone: "economia", t: "Pague só o seu uso", d: "Os tokens que saem da sua chave são cobrados pelo seu provedor, no seu painel. A Zaeon não cobra por eles." },
  { icone: "privacidade", t: "Sai do servidor só pra chamar o modelo", d: "A chave fica guardada no servidor e viaja só na chamada ao provedor. Pode revogar a qualquer hora, do seu lado." },
];

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

      <ol className="mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {PASSOS.map((p, i) => (
          <motion.li
            key={p.t}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-40px" }}
            transition={{ duration: 0.45, delay: i * 0.07 }}
            className="dark relative flex flex-col gap-3 rounded-2xl border border-cyan-400/25 bg-[#0f1f44]/80 backdrop-blur-md p-5 shadow-[0_0_24px_rgba(6,182,212,0.12)]"
          >
            <span className="flex items-center justify-between">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-300">
                <IconeCredencial name={p.icone} size={20} />
              </span>
              <span className="font-mono text-[10px] text-white/40">0{i + 1}</span>
            </span>
            <span className="font-display text-[15px] font-semibold leading-tight text-white">{p.t}</span>
            <span className="text-[13px] leading-snug text-white/75">{p.d}</span>
          </motion.li>
        ))}
      </ol>

      {/* as casas de modelos (âncora #modelos do "Ver os modelos") */}
      <div id="modelos" className="scroll-mt-24">
        <EquipadosCom className="mt-12" />
      </div>
    </section>
  );
}
