"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useSession } from "next-auth/react";
import { UserIcon } from "@heroicons/react/24/outline";

// Componentes Internos
import MenuNavigation from "@/components/sub/MenuNavigation";
import LiquidGlassButton from "@/components/ui/LiquidGlassButton";
import StarBackground from "@/components/main/star-background";

// Mural de modelos (v2): as IAs que o público já conhece, num lugar só.
// Texto, não logos oficiais (limpo + evita marca de terceiros). Os "extras"
// ficam mais discretos que os quatro principais.
const MODELS_MAIN = [
  { name: "GPT", org: "OpenAI", slug: "openai" },
  { name: "Claude", org: "Anthropic", slug: "anthropic" },
  { name: "Gemini", org: "Google", slug: "google" },
  { name: "Grok", org: "xAI", slug: "xai" },
];
const MODELS_MORE = [
  { name: "Llama", slug: "meta" },
  { name: "DeepSeek", slug: "deepseek" },
  { name: "Mistral", slug: "mistral" },
];

/**
 * Logo do provedor, com o nome como rede de segurança.
 *
 * Os arquivos oficiais entram em `public/assets/models/<slug>.svg`. Enquanto não
 * estiverem lá, o `onError` devolve o texto e a página não quebra — então este
 * componente pode subir antes dos assets.
 *
 * NÃO desenhamos marca de terceiro à mão: logo de fabricante se pega no press
 * kit dele, não se aproxima no olho.
 *
 * `dark:brightness-0 dark:invert` pinta tudo de branco no escuro, o que deixa os
 * sete coerentes entre si. Algumas diretrizes de marca proíbem recolorir — se
 * for o caso de alguma, é só tirar essas duas classes.
 */
function LogoModelo({ slug, name, org }: { slug: string; name: string; org?: string }) {
  const [falhou, setFalhou] = useState(false);

  // Logo E nome, não logo NO LUGAR do nome. Duas razões concretas, descobertas
  // olhando o resultado: (1) nem toda marca tem glifo disponível — GPT e Grok
  // ficaram sem, e a fileira virou duas gramáticas misturadas; (2) glifo sozinho
  // funciona pra quem já conhece a marca, e some pra quem não conhece, que é
  // justamente o público que o mural existe pra impressionar.
  return (
    <span className="inline-flex items-center gap-2">
      {falhou ? null : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/assets/models/${slug}.svg`}
          alt=""
          aria-hidden="true"
          onError={() => setFalhou(true)}
          loading="lazy"
          className="h-4 w-4 shrink-0 object-contain opacity-90 dark:brightness-0 dark:invert"
        />
      )}
      <span className="font-medium">{name}</span>
      {org ? <span className="text-slate-400 dark:text-slate-500">· {org}</span> : null}
    </span>
  );
}

// Variante B do H1 — "Ninguém ___ sozinho.". O verbo gira, o remate fica parado.
// Ordem: do concreto (o que a pessoa faz hoje) pro abstrato (onde ela quer chegar).
const VERBOS = [
  "trabalha",
  "estuda",
  "pesquisa",
  "escreve",
  "publica",
  "evolui",
  "cresce",
  "prospera",
];
// Frase inteira, estável, para leitor de tela: um H1 não pode depender de qual
// verbo estava na tela no instante da leitura.
const FRASE_COMPLETA =
  "Aqui ninguém trabalha, estuda, pesquisa, escreve, publica, evolui, cresce ou prospera sozinho.";

export default function HeroPage() {
  const { t } = useTranslation();
  const { status } = useSession();

  const [showChatbox, setShowChatbox] = useState(false);
  const [verboIndex, setVerboIndex] = useState(0);
  const [semMovimento, setSemMovimento] = useState(false);

  // Quem pediu menos movimento no sistema não recebe carrossel: fica no primeiro
  // verbo, parado. Vale pra acessibilidade e pra bateria.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setSemMovimento(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (semMovimento) return;
    const id = setInterval(
      () => setVerboIndex((i) => (i + 1) % VERBOS.length),
      2600
    );
    return () => clearInterval(id);
  }, [semMovimento]);

  // Redireciona diretamente para o chat caso já esteja logado
  useEffect(() => {
    if (status === "authenticated") {
      setShowChatbox(true);
    }
  }, [status]);

  return (
    <main className="w-full flex flex-col items-start justify-start relative zaeon-borda pt-10 md:pt-16 pb-12 md:pb-16 overflow-hidden transition-colors duration-700 font-sans">

      {/* BACKGROUND LIMPO - Apenas o StarBackground visível */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <StarBackground />
      </div>

      {/* ========================================= */}
      {/* HERO v2 — TODAS AS IAS, FEITO PRA CIÊNCIA */}
      {/* ========================================= */}
      <motion.div
        animate={{
          scale: showChatbox ? 0.9 : 1,
          y: showChatbox ? -30 : 0,
          opacity: 1,
        }}
        transition={{ type: "spring", stiffness: 90, damping: 20 }}
        className="flex flex-col items-start text-left max-w-4xl z-10 w-full origin-left"
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative flex flex-col items-start justify-center"
        >
            <h1 className="text-[2rem] sm:text-4xl md:text-[3.5rem] font-light tracking-tighter text-slate-900 dark:text-white leading-[1.15] z-10 relative">
              <span className="sr-only">{FRASE_COMPLETA}</span>
              <span aria-hidden="true">
                Aqui ninguém
                {/* Slot em grid: TODOS os verbos ocupam a MESMA célula, então a largura
                    do slot é a do verbo mais longo e o "sozinho." nunca pula quando o
                    verbo troca. Sem número mágico, sem medir fonte.
                    `justify-items-center` centraliza a palavra dentro do slot: sem isso
                    um verbo curto encosta à esquerda e abre um buraco só de um lado,
                    que é o que dava o aspecto torto. A margem em `em` afasta de AMBAS
                    as palavras, então a folga vira espaçamento deliberado em vez de
                    sobra de layout — e escala junto com o tamanho da fonte. */}
                <span className="relative inline-grid justify-items-center align-baseline mx-[0.4em]">
                  {VERBOS.map((v) => (
                    <span
                      key={v}
                      className="col-start-1 row-start-1 invisible font-semibold"
                    >
                      {v}
                    </span>
                  ))}
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={VERBOS[verboIndex]}
                      initial={{ opacity: 0, filter: "blur(8px)", y: 8 }}
                      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                      exit={{ opacity: 0, filter: "blur(8px)", y: -8 }}
                      transition={{ duration: 0.45, ease: "easeInOut" }}
                      className="cyber-glitch col-start-1 row-start-1 font-semibold text-cyan-600 dark:text-cyan-400"
                      data-text={VERBOS[verboIndex]}
                    >
                      {VERBOS[verboIndex]}
                    </motion.span>
                  </AnimatePresence>
                </span>
                sozinho.
              </span>
            </h1>

          <AnimatePresence>
            {!showChatbox && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 24 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                  <p className="max-w-2xl text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-400 font-light leading-relaxed">
                    Todas as IAs num lugar só — GPT, Claude, Gemini, Grok e mais — num
                    sistema onde você não só conversa, você{" "}
                    <span className="text-slate-800 dark:text-slate-200 font-normal">
                      produz conhecimento
                    </span>
                    .
                  </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* CTAs */}
        <AnimatePresence>
          {!showChatbox && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mt-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-center justify-start"
            >
              {/* Mesmo material do "Iniciar", em vidro TINGIDO: vidro incolor aqui
                  derrubaria a hierarquia e este é o primário da página. */}
              <LiquidGlassButton
                onClick={() => setShowChatbox(true)}
                tom="destaque"
                tamanho="md"
                className="w-full sm:w-auto"
              >
                <UserIcon className="w-4 h-4" />
                Começar grátis
              </LiquidGlassButton>
              <a
                href="#modelos"
                className="group relative flex items-center justify-center gap-3 px-10 py-4 rounded-full border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 font-medium uppercase tracking-[0.18em] text-[11px] transition-all hover:border-cyan-400 hover:scale-105 bg-transparent"
              >
                Ver os modelos
              </a>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MURAL DE MODELOS */}
        <AnimatePresence>
          {!showChatbox && (
            <motion.div
              id="modelos"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="mt-14 w-full max-w-3xl scroll-mt-28"
            >
              <div className="flex flex-wrap gap-3">
                {MODELS_MAIN.map((m) => (
                  <span
                    key={m.name}
                    className="flex items-center text-xs text-slate-700 dark:text-slate-200 border border-slate-300/60 dark:border-white/12 rounded-lg px-3.5 py-2 bg-white/40 dark:bg-white/[0.03] backdrop-blur-sm"
                  >
                    <LogoModelo slug={m.slug} name={m.name} org={m.org} />
                  </span>
                ))}
                {MODELS_MORE.map((m) => (
                  <span
                    key={m.name}
                    className="flex items-center text-xs text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-white/10 rounded-lg px-3.5 py-2 bg-white/30 dark:bg-white/[0.02]"
                  >
                    <LogoModelo slug={m.slug} name={m.name} />
                  </span>
                ))}
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ========================================= */}
      {/* CHATBOX (Aparece ao logar / clicar começar) */}
      {/* ========================================= */}
      <AnimatePresence>
        {showChatbox && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: -20, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
            className="w-full max-w-[760px] z-20 mt-0 relative origin-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-full max-w-[500px] shrink-0">
                <MenuNavigation />
              </div>
              {/* Convite NAO volta pra ca: o main moveu ele pra dentro de Opcoes,
                  no menu, e MenuNavigation ja o renderiza. Dois pontos de convite
                  na mesma tela ficaria repetido. Se um dia o card aqui for a
                  escolha, e tirar de lá primeiro. */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSS do Glitch Holográfico Elegante (assinatura da casa) */}
      <style jsx global>{`
        .cyber-glitch {
          position: relative;
        }

        .cyber-glitch::before,
        .cyber-glitch::after {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: transparent;
          pointer-events: none;
        }

        .cyber-glitch::before {
          left: 1px;
          text-shadow: -1px 0 rgba(6, 182, 212, 0.8);
          clip-path: polygon(0 0, 100% 0, 100% 10%, 0 10%);
          animation: glitch-elegant-1 3.5s infinite linear alternate-reverse;
        }

        .cyber-glitch::after {
          left: -1px;
          text-shadow: 1px 0 rgba(255, 255, 255, 0.3);
          clip-path: polygon(0 80%, 100% 80%, 100% 100%, 0 100%);
          animation: glitch-elegant-2 4s infinite linear alternate-reverse;
        }

        @keyframes glitch-elegant-1 {
          0% { clip-path: polygon(0 15%, 100% 15%, 100% 25%, 0 25%); transform: translate(0); }
          10% { clip-path: polygon(0 45%, 100% 45%, 100% 50%, 0 50%); transform: translate(-1px, 1px); }
          20% { clip-path: polygon(0 85%, 100% 85%, 100% 90%, 0 90%); transform: translate(1px, -1px); }
          30% { clip-path: polygon(0 10%, 100% 10%, 100% 20%, 0 20%); transform: translate(0); }
          40% { clip-path: polygon(0 60%, 100% 60%, 100% 70%, 0 70%); transform: translate(-1px, 0); }
          50% { clip-path: polygon(0 30%, 100% 30%, 100% 40%, 0 40%); transform: translate(0); }
          60%, 100% { clip-path: polygon(0 0, 0 0, 0 0, 0 0); transform: translate(0); }
        }

        @keyframes glitch-elegant-2 {
          0%, 40% { clip-path: polygon(0 0, 0 0, 0 0, 0 0); transform: translate(0); }
          50% { clip-path: polygon(0 20%, 100% 20%, 100% 30%, 0 30%); transform: translate(1px, 0); }
          60% { clip-path: polygon(0 75%, 100% 75%, 100% 80%, 0 80%); transform: translate(-1px, 1px); }
          70% { clip-path: polygon(0 40%, 100% 40%, 100% 55%, 0 55%); transform: translate(0); }
          80% { clip-path: polygon(0 80%, 100% 80%, 100% 90%, 0 90%); transform: translate(1px, -1px); }
          90% { clip-path: polygon(0 5%, 100% 5%, 100% 15%, 0 15%); transform: translate(-1px, 0); }
          100% { clip-path: polygon(0 60%, 100% 60%, 100% 65%, 0 65%); transform: translate(0); }
        }
      `}</style>
    </main>
  );
}
