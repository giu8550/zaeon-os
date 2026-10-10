"use client";

import TextoRevelado from "@/components/ui/TextoRevelado";
import { motion } from "framer-motion";
import React, { useState, useEffect } from "react";
import NextImage from "next/image";
import { useTranslation } from "react-i18next";
import ZaeonFlowDiagram from "./ZaeonFlowDiagram";
import MentoresCarrossel from "./MentoresCarrossel";
import SolanaPrivacidade from "./SolanaPrivacidade";
import ChavesApi from "./ChavesApi";
import { TituloSecao } from "@/components/layout/secao";
import MolecularText from "@/components/ui/MolecularText";

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
                <h3 className="text-center text-[11px] font-black tracking-[0.35em] text-white uppercase">
                    <TextoRevelado texto="Financiado e apoiado por:" />
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
            // o card fica ESCURO nos dois temas: as logos (a da Funcap é branca) foram feitas pra fundo escuro — no claro, com o
            // card cinza-translúcido, a Funcap sumia e as outras ficavam lavadas (incidente em produção, out/2026)
            className="relative flex items-center justify-center min-w-[200px] h-[100px] rounded-[1.5rem] border border-black/10 dark:border-white/5 bg-[#0a0a0f]/90 dark:bg-[#0a0a0f]/40 backdrop-blur-md transition-all duration-500 group overflow-hidden cursor-pointer"
        >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12)_0%,transparent_70%)]" />
            <div className="relative w-full h-full p-6 flex items-center justify-center">
                {/* `unoptimized`: as logos são PNGs pequenos e locais; sem passar pelo /_next/image (que já falhou em
                    produção e deixava os cards vazios — o next/image esconde a imagem quebrada com color:transparent). O service
                    worker guarda /sponsors/* (stale-while-revalidate), então elas carregam mesmo com a rede ruim */}
                <NextImage src={item.src} alt={item.name} fill unoptimized className="max-w-full max-h-full object-contain opacity-100 transition-all duration-500" />
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
        <div id="mentores" className="w-full zaeon-borda mt-10 mb-20 z-40 relative bg-transparent scroll-mt-28">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
            >
                <TituloSecao className="font-display" forte="Estude com os melhores e mais modernos agentes de IA." />

                {/* carrossel LEVE: só foto, nome e função; quem passa pelo meio da tela ganha a borda destacada */}
                <div className="mt-10">
                    <MentoresCarrossel semRotulo leve />
                </div>
            </motion.div>

            {/* "ou traga as chaves de API dos seus" + o briefing das chaves (+ as casas de modelos, #modelos) */}
            <ChavesApi className="mt-16 md:mt-20" />
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
            {/* o card é AZUL nos dois temas → o conteúdo dele usa o estilo escuro (texto claro, logo do MCTI escuro) */}
            {/* Título */}
            <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300 mb-10 transition-colors duration-300">
                <TextoRevelado texto="Produto vencedor" />
            </h4>

            <div className="dark w-full max-w-[1200px]">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="
                    relative w-full max-w-[1200px] rounded-[2rem] 
                    
                    /* --- AZUL nos dois temas (destaque) --- */
                    border border-cyan-500/50 bg-[#1e3a8a]/85 backdrop-blur-md shadow-[0_0_30px_rgba(6,182,212,0.25)]
                    
                    /* --- MODO ESCURO (Azul Transparente) --- */
                    dark:border-cyan-500/50 dark:bg-[#1e3a8a]/85 dark:shadow-[0_0_30px_rgba(6,182,212,0.15)]
                    
                    flex flex-col items-center justify-center text-center
                    p-8 md:p-12 gap-8 group overflow-hidden
                    hover:border-cyan-500/50 transition-all duration-500
                "
            >
                {/* Coluna da Esquerda: Ícone e Texto */}
                <div className="flex flex-col gap-4 text-center items-center z-10 max-w-2xl">
                    <h3 className="text-2xl md:text-3xl font-light text-slate-900 dark:text-white leading-tight">
                        <span className="font-bold text-cyan-600 dark:text-cyan-400 drop-shadow-md dark:drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">Blockchain</span> como Tecnologia de Uso Inteligente no Ceará
                    </h3>

                    <p className="text-sm text-slate-700 dark:text-white/90 font-medium leading-relaxed max-w-lg mx-auto">
                        <a
                            href="https://programacentelha.com.br/wp-content/uploads/2025/01/CE-Lista-Final-Empresas-Contratadas.pdf"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 font-bold underline underline-offset-4 decoration-cyan-500/50 hover:decoration-cyan-300 transition-all cursor-pointer relative z-50"
                        >
                            Programa Centelha (2ª Edição).
                        </a>
                    </p>
                </div>

                {/* Coluna da Direita: Logos MCTI */}
                <div className="w-full flex flex-col items-center justify-center border-t border-slate-200 dark:border-white/10 pt-8 z-10">
                    <span className="text-[10px] text-slate-800 dark:text-white/90 uppercase tracking-widest mb-6 font-semibold">Apoio Oficial</span>

                    {/* `h-26` não existe no Tailwind → a caixa tinha altura 0 e o logo (fill) nunca aparecia.
                        O PNG é 1200×297 (~4:1); as versões _alpha são as oficiais com o fundo (branco/preto) virado transparência. */}
                    <div className="relative h-16 w-64 transition-all duration-300 group-hover:scale-105 opacity-95 group-hover:opacity-100">
                        <NextImage
                            src="/sponsors/MCTI_light_alpha.png"
                            alt="Ministério da Ciência, Tecnologia e Inovação — Governo do Brasil"
                            fill
                            sizes="256px"
                            className="w-full h-full object-contain block dark:hidden" unoptimized />
                        <NextImage
                            src="/sponsors/MCTI_dark_alpha.png"
                            alt="Ministério da Ciência, Tecnologia e Inovação — Governo do Brasil"
                            fill
                            sizes="256px"
                            className="w-full h-full object-contain hidden dark:block" unoptimized />
                    </div>
                </div>
            </motion.div>
            </div>
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
            <section id="como-funciona" className="relative z-[30] w-full bg-transparent pt-12 md:pt-16 pb-12 scroll-mt-28">
                <div className="zaeon-borda">
                    <TituloSecao className="font-display" forte="Feito pra quem estuda, trabalha ou empreende." />

                    {/* DIAGRAMA VIVO: entrada -> cerebro Zaeon -> saida.
                        O painel nao e enfeite: o ParticleSystem da landing corre
                        atras da pagina inteira e passava por cima do card da
                        direita. Uma chapa escura com borda de 1px devolve o
                        diagrama para um fundo calmo sem desligar o fundo. */}
                    {/* CLARO: vidro AZUL glossy (gradiente + brilho no topo), estilo do botão
                        "Iniciar", no lugar do branco lavado. ESCURO: segue o navy de sempre. */}
                    {/* Sem o card grande em volta: só os cards do diagrama, AZULADOS e tingidos pelo fluxo em foco.
                        `dark` força o estilo escuro dentro (texto claro sobre os cards azulados) nos dois temas. */}
                    <div className="dark mt-12 md:mt-16">
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
            {/* NO LUGAR dos agentes: a Solana cobrindo a digital — privacidade e credenciais (v4) */}
            <SolanaPrivacidade />

            <div className="relative z-40 w-full overflow-x-clip flex flex-col items-center justify-center bg-transparent pt-10">
                <HireAgentsSection />
            </div>

            {/* PENÚLTIMO: o fomento (Centelha), centralizado no desktop */}
            <ProcessFlowchart />
        </div>
    );
}