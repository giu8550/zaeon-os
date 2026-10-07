"use client";

import TextoRevelado from "@/components/ui/TextoRevelado";
import LoungeJanela from "@/components/lounge/LoungeJanela";
import { BORDA, TituloSecao } from "@/components/layout/secao";

/**
 * O CYBERESPAÇO — no lugar da antiga "Crie a sua própria estação de trabalho" (destino do "Ir pro cyberespaço" do hero,
 * `#cyberespaco`). A vista ao vivo (o avatar
 * meditando) é a ÚNICA entrada: o "Conectar" em cima do próprio card. Os cards explicam os conceitos básicos sem citar
 * marcas nem lugares.
 */
const CONCEITOS = [
  {
    titulo: "A moeda é o conhecimento",
    texto: "Progresso e conhecimento se conquistam aqui dentro. Cada um vale o que sabe — e o que entrega.",
  },
  {
    titulo: "Gente de verdade, ao vivo",
    texto: "Você nunca está sozinho: quem está online aparece do seu lado, em tempo real. Converse, chame alguém pra sua estação e construam juntos — cada conquista é vista por quem está lá.",
  },
  {
    titulo: "Onde os agentes vivem",
    texto: "Um lugar onde humanos e agentes de IA habitam e vivem juntos, construindo coisas baseadas no mundo real.",
  },
];

export default function CyberespacoExplica() {
  return (
    <section id="cyberespaco" aria-labelledby="cyberespaco-titulo" className={`${BORDA} relative z-10 scroll-mt-28 py-24 md:py-32`}>
      <div id="cyberespaco-titulo">
        <TituloSecao className="font-display" forte="Zaeon não é só um aplicativo — é um lugar." />
      </div>
      <p className="mt-6 max-w-[620px] font-display text-base md:text-lg font-light leading-relaxed text-slate-900 dark:text-white">
        <TextoRevelado texto="Entre na sua estação de trabalho e conheça um mundo digital além dos prompts." delay={0.2} />
      </p>

      {/* a vista ao vivo (o seu avatar meditando, logado) — o "Conectar" dela é a entrada */}
      <LoungeJanela />

      <ul className="mt-12 grid gap-4 md:grid-cols-3">
        {CONCEITOS.map((c) => (
          <li
            key={c.titulo}
            className="rounded-2xl border border-slate-200 bg-white/60 p-6 backdrop-blur dark:border-white/10 dark:bg-white/[0.03]"
          >
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">{c.titulo}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-800 dark:text-white/85">{c.texto}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
