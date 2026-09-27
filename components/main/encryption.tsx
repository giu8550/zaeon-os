"use client";

import { motion } from "framer-motion";
import React, { useState, useEffect } from "react";
import NextImage from "next/image";
import { useTranslation } from "react-i18next";
import ZaeonFlowDiagram from "./ZaeonFlowDiagram";
import MentoresCarrossel from "./MentoresCarrossel";
import EquipadosCom from "./EquipadosCom";
import { Rotulo, TituloSecao } from "@/components/layout/secao";

// --- TICKER DE PATROCINADORES ---
const SponsorsTicker = ({ opacity }: { opacity: any }) => {
    const { t } = useTranslation();
    const sponsors = [
        { name: "Funcap", src: "/sponsors/funcap.png", url: "https://www.funcap.ce.gov.br/" },
        { name: "Centelha", src: "/sponsors/centelha.png", url: "https://programacentelha.com.br/ce/" },
        { name: "Sudene", src: "/sponsors/sudene.png", url: "https://www.gov.br/sudene" },
        { name: "Finep", src: "/sponsors/finep.png", url: "http://www.finep.gov.br/" },
        { name: "Cnpq", src: "/sponsors/cnpq.png", url: "https://www.gov.br/cnpq/pt-br" },

    ];
    const tickerItems = [...sponsors, ...sponsors, ...sponsors];

    return (
        <motion.div style={{ opacity }} className="w-full py-8 overflow-hidden relative z-50">
            <div className="w-full flex justify-center mb-8">
                <h3 className="text-center text-[10px] font-black tracking-[0.4em] text-cyan-600 dark:text-cyan-400 uppercase opacity-0">
                    {t("hero.sponsors_title", "SPONSORS:")}
                </h3>
            </div>
            <div className="relative">
                <div className="flex whitespace-nowrap">
                    <motion.div
                        animate={{ x: ["0%", "-50%"] }}
                        transition={{ ease: "linear", duration: 35, repeat: Infinity }}
                        className="flex gap-8 px-6"
                    >
                        {tickerItems.map((item, i) => (
                            <SponsorCard key={i} item={item} />
                        ))}
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
};

const SponsorCard = ({ item }: { item: { name: string; src: string; url: string } }) => {
    return (
        <motion.a
            href={item.url} target="_blank" rel="noopener noreferrer"
            whileHover={{ scale: 1.05, borderColor: "rgba(34, 211, 238, 0.4)", backgroundColor: "rgba(255, 255, 255, 0.05)" }}
            className="relative flex items-center justify-center min-w-[200px] h-[100px] rounded-[1.5rem] border border-white/5 bg-[#0a0a0f]/40 backdrop-blur-md transition-all duration-500 group overflow-hidden cursor-pointer"
        >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12)_0%,transparent_70%)]" />
            <div className="relative w-full h-full p-6 flex items-center justify-center">
                <NextImage src={item.src} alt={item.name} fill className="max-w-full max-h-full object-contain opacity-100 transition-all duration-500" />
            </div>
        </motion.a>
    );
};


// =========================================================================
// NOVO: SECÇÃO DE CONTRATAÇÃO DE AGENTES (Stack 3D e Highlight)
// ══════════════════════════════════════════════════════════════════════════
// MENTORES — os 13 reais da sala de Plugins, num carrossel
//
// O que estava aqui era uma pilha 3D de quatro AGENTES INVENTADOS ("Dr. Marcus
// Vance, Advogado Societário", "Elena Rostova, Secretária Executiva"), com
// crachá, empresa e matrícula. Ficção apresentada como catálogo numa página
// que vende ciência: quem clicasse procurando o Dr. Vance não ia achar nada.
//
// Os agentes de verdade existem e são os 13 MENTORES da camada agêntica --
// Osler (Medicina), Turing (Eng. da Computação), Noether (Matemática) e os
// outros dez -- que já vivem na sala de Plugins. Esta seção agora mostra eles.
// ══════════════════════════════════════════════════════════════════════════
const HireAgentsSection = () => {
    return (
        <div className="w-full zaeon-borda mt-10 mb-20 z-40 relative bg-transparent">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
            >
                <Rotulo>Mentores</Rotulo>
                <TituloSecao forte="Treze mentores." fraco="Um para o seu curso." />
                <p className="mt-5 max-w-[520px] text-base leading-relaxed text-slate-600 dark:text-slate-400">
                    Cada mentor é fundo na própria área — persona, fontes e artefatos
                    escopados ao curso. Você pluga o seu no chat e a Aura passa a
                    responder com a voz de quem entende do assunto.
                </p>

                <div className="mt-10">
                    <MentoresCarrossel />
                </div>

                {/* Âncora do botão "Ver os modelos" do hero: as IAs vivem aqui embaixo. */}
                <div id="modelos" className="scroll-mt-24">
                    <EquipadosCom className="mt-14" />
                </div>
            </motion.div>
        </div>
    );
};

// =========================================================================
// CARROSSEL VERTICAL DE MARCAS IA (Infinite Ticker)

// --- FLUXOGRAMA "LIQUID GLASS" ---
const ProcessFlowchart = () => {
    const { t } = useTranslation();

    return (
        <div className="w-full zaeon-borda pt-20 pb-40 flex flex-col items-center justify-center bg-transparent relative z-40">
            {/* Título */}
            <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-white/40 mb-10 transition-colors duration-300">
                {t("encryption.recognition", "Recognition")}
            </h4>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="
                    relative w-full max-w-[1200px] rounded-[2rem] 
                    
                    /* --- MODO CLARO (Preto Transparente) --- */
                    border border-slate-200 bg-white/80 backdrop-blur-xl shadow-xl
                    
                    /* --- MODO ESCURO (Azul Transparente) --- */
                    dark:border-cyan-500/50 dark:bg-[#1e3a8a]/40 dark:shadow-[0_0_30px_rgba(6,182,212,0.15)]
                    
                    flex flex-col md:flex-row items-center justify-between
                    p-8 md:p-12 gap-8 group overflow-hidden
                    hover:border-cyan-500/50 transition-all duration-500
                "
            >
                {/* --- EFEITO DE FLASH / BRILHO PASSANDO --- */}
                <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none z-0">
                    <motion.div
                        className="absolute top-0 bottom-0 w-32 bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent skew-x-[-20deg]"
                        initial={{ left: "-100%" }}
                        animate={{ left: "200%" }}
                        transition={{
                            repeat: Infinity,
                            duration: 2.5,
                            repeatDelay: 1,
                            ease: "linear"
                        }}
                    />
                </div>

                {/* Coluna da Esquerda: Ícone e Texto */}
                <div className="flex flex-col gap-6 flex-1 text-center md:text-left items-center md:items-start z-10">
                    <h3 className="text-2xl md:text-3xl font-light text-slate-900 dark:text-white leading-tight">
                        <span className="font-bold text-cyan-600 dark:text-cyan-400 drop-shadow-md dark:drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">Blockchain</span> como Tecnologia de Uso Inteligente no Ceará
                    </h3>

                    <p className="text-sm text-slate-700 dark:text-white/90 font-medium leading-relaxed max-w-lg">
                        Projeto contemplado com fomento financeiro concedido pelo{" "}
                        <a
                            href="https://programacentelha.com.br/wp-content/uploads/2025/01/CE-Lista-Final-Empresas-Contratadas.pdf"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 font-bold underline underline-offset-4 decoration-cyan-500/50 hover:decoration-cyan-300 transition-all cursor-pointer relative z-50"
                        >
                            Programa Centelha (2ª Edição)
                        </a>
                        , financiado diretamente pelo Ministério da Ciência, Tecnologia e Inovação do Governo Federal.
                    </p>
                </div>

                {/* Coluna da Direita: Logos MCTI */}
                <div className="w-full md:w-auto flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-slate-200 dark:border-white/10 pt-8 md:pt-0 md:pl-12 mt-2 md:mt-0 z-10">
                    <span className="text-[10px] text-slate-500 dark:text-white/50 uppercase tracking-widest mb-6 font-semibold">Apoio Oficial</span>

                    <div className="relative h-26 w-64 transition-all duration-300 group-hover:scale-105 opacity-90 group-hover:opacity-100">
                        <NextImage
                            src="/sponsors/MCTI_light.png"
                            alt="MCTI Logo"
                            fill
                            className="w-full h-full object-contain block dark:hidden"
                        />
                        <NextImage
                            src="/sponsors/MCTI_dark.png"
                            alt="MCTI Logo"
                            fill
                            className="w-full h-full object-contain hidden dark:block"
                        />
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL (PÁGINA) ---
export default function Encryption() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 500);
        return () => clearTimeout(timer);
    }, []);

    if (!mounted) return <div className="min-h-screen bg-transparent" />;

    return (
        <div className="w-full relative">
            <section className="relative z-[30] w-full bg-transparent pt-12 md:pt-16 pb-12">
                <div className="zaeon-borda">
                    <Rotulo>Como funciona</Rotulo>
                    <TituloSecao forte="Você chega com uma coisa." fraco="Sai com outra." />

                    {/* DIAGRAMA VIVO: entrada -> cerebro Zaeon -> saida.
                        O painel nao e enfeite: o ParticleSystem da landing corre
                        atras da pagina inteira e passava por cima do card da
                        direita. Uma chapa escura com borda de 1px devolve o
                        diagrama para um fundo calmo sem desligar o fundo. */}
                    <div className="mt-12 md:mt-16 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-[#070b11]/75 backdrop-blur-sm px-4 py-8 md:px-10 md:py-12">
                        <ZaeonFlowDiagram />
                    </div>
                </div>

                {/* o marquee e de proposito full-bleed: ele corre de borda a borda */}
                <div className="w-full mt-14 md:mt-20">
                    <SponsorsTicker opacity={1} />
                </div>
            </section>

            {/* ========================================================= */}
            {/* SECÇÃO: CONTRATAÇÃO DE AGENTES (3D Cover Flow) E MARCAS   */}
            {/* ========================================================= */}
            {/* overflow-x-clip: a pilha 3D de agentes e `absolute w-[340px]` e o leque
                empurra os cards para fora da viewport no celular -- eram 46px de
                scroll horizontal na pagina inteira. `clip` em vez de `hidden`
                porque `hidden` criaria um contexto de rolagem e mataria qualquer
                `sticky` daqui para dentro. */}
            <div className="relative z-40 w-full overflow-x-clip flex flex-col items-center justify-center bg-transparent pt-10">
                <HireAgentsSection />
            </div>

            {/* FLUXOGRAMA NO FINAL (Intacto) */}
            <ProcessFlowchart />
        </div>
    );
}