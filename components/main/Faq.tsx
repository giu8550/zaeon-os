"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Rotulo, TituloSecao } from "@/components/layout/secao";

/**
 * FAQ da landing — accordion acessível (baseado no padrão da ChipFlow), no visual
 * da Zaeon: vidro azul glossy no claro, esfumado no escuro. Cada item abre/fecha
 * de forma independente. <button> nativo + aria-expanded/controls pra teclado e
 * leitor de tela; altura anima pelo truque grid-rows 0fr→1fr.
 */

type QA = { q: string; a: string };

const ITENS: QA[] = [
  {
    q: "O que é a Zaeon?",
    a: "Uma plataforma de assinatura onde você acessa todas as principais IAs — GPT, Claude, Gemini, Grok e mais — num só lugar, com uma camada científica por cima: mentores por área, busca em bases acadêmicas reais e artefatos que viram estudo de verdade.",
  },
  {
    q: "Quais modelos de IA estão disponíveis?",
    a: "Os modelos de ponta das principais fornecedoras, reunidos numa interface só. Em vez de assinar cada um separado, você pluga o que faz sentido pra tarefa e a Aura orquestra tudo no mesmo fluxo.",
  },
  {
    q: "Como funciona a camada científica?",
    a: "A Sala de Pesquisa busca em bases abertas (OpenAlex, PubMed, Crossref, Europe PMC, arXiv) e responde ancorada em trabalhos reais, com citações. Os mentores dão à Aura a voz e as fontes escopadas ao seu curso.",
  },
  {
    q: "Preciso saber programar pra usar?",
    a: "Não. A Zaeon foi feita pra qualquer estudante ou pesquisador. Você conversa em linguagem natural; a parte técnica fica por baixo do capô.",
  },
  {
    q: "Meus dados e trabalhos ficam seguros?",
    a: "Suas conversas e documentos são seus. Tratamos os dados conforme a nossa Política de Privacidade e você controla o que salva. Nada de vender seus dados pra terceiros.",
  },
  {
    q: "Como começo?",
    a: "Crie sua conta, escolha a sala do seu curso e comece a conversar com a Aura. O onboarding leva menos de um minuto.",
  },
];

function Item({ item }: { item: QA }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-blue-200/60 dark:border-white/10 last:border-b-0">
      <button
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-4 px-5 py-5 text-left text-[15px] font-semibold transition-colors
          ${open ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white"}`}
      >
        <span>{item.q}</span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`flex-shrink-0 text-cyan-600 dark:text-cyan-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <p className="px-5 pb-5 pt-0 text-sm leading-relaxed text-slate-600 dark:text-white/60">
            {item.a}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Faq() {
  return (
    <section id="faq" className="relative z-40 w-full bg-transparent py-20 md:py-28 scroll-mt-24">
      <div className="zaeon-borda">
        <Rotulo>Dúvidas frequentes</Rotulo>
        <TituloSecao forte="Perguntas comuns." fraco="Respostas diretas." />

        {/* Painel vidro-azul glossy no claro; esfumado no escuro. */}
        <div className="mt-10 max-w-[760px] rounded-2xl overflow-hidden backdrop-blur-sm
          bg-gradient-to-b from-sky-100/70 to-blue-200/50 dark:from-transparent dark:to-transparent dark:bg-white/[0.04]
          border border-blue-300/60 dark:border-white/10
          shadow-[0_20px_50px_-24px_rgba(37,99,235,0.25),inset_0_1px_0_0_rgba(255,255,255,0.7)] dark:shadow-[0_20px_50px_-24px_rgba(0,0,0,0.6)]">
          {ITENS.map((it) => (
            <Item key={it.q} item={it} />
          ))}
        </div>
      </div>
    </section>
  );
}
