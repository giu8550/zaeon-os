"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
    SparklesIcon,
    DocumentTextIcon,
    BuildingLibraryIcon,
    UserGroupIcon,
    GlobeAltIcon,
    CpuChipIcon,
} from "@heroicons/react/24/outline";

import StarBackground from "@/components/main/star-background";

const FEATURES = [
    {
        id: 1,
        name: "Assistentes Inteligentes",
        icon: SparklesIcon,
        description: "Agentes multi-uso e multi-tarefas, modelos refinados com tecnologia das maiores empresas de IA da atualidade. Eles acompanham a sua rotina diária, relembrando o que precisa ser feito - ou fazendo por si.",
        align: "left"
    },
    {
        id: 2,
        name: "Criação de Documentos",
        icon: DocumentTextIcon,
        description: "Entregue relatórios, artigos, tarefas e muito mais, sem se preocupar com formatação. Confie a revisão aos nossos agentes e ganhe tempo na pesquisa.",
        align: "right"
    },
    {
        id: 3,
        name: "Salas de Estudo Completas",
        icon: BuildingLibraryIcon,
        description: "Organize a sua vida estudantil num único espaço: estude, assista a vídeos, anote ideias vitais e converse com especialistas neurais a qualquer momento.",
        align: "left"
    },
    {
        id: 4,
        name: "Colaboração em Grupo",
        icon: UserGroupIcon,
        description: "Trabalhos em grupo elevados ao próximo nível: debatam ideias com amigos, criem grupos de estudo e conectem-se com outros investigadores.",
        align: "right"
    },
    {
        id: 5,
        name: "Publique o Seu Conhecimento",
        icon: GlobeAltIcon,
        description: "Disponibilize os seus trabalhos, teses e pesquisas num ambiente concebido para destacar globalmente entregas de alta qualidade académica.",
        align: "left"
    },
];

// --- COMPONENTE DO MÓDULO HIGHTECH ---
const FeatureCard = ({ feature, scrollProgress, index, total }: any) => {
    const isLeft = feature.align === "left";

    // CALIBRAÇÃO FINA: Compensamos o padding do container para mapear o centro físico dos cards
    // Em um layout com 5 cards de mesmo tamanho, os centros são 10%, 30%, 50%, 70%, 90%
    const activationPoint = 0.10 + (index / (total - 1)) * 0.80;

    // A ramificação desenha-se pouco antes da linha central bater no card
    const drawStart = Math.max(0, activationPoint - 0.1);
    const drawEnd = activationPoint;

    // AÇÕES 1:1 COM O SCROLL (O Card acende quando a linha chega e PERMANECE ACESO para se destacar)
    const activeStart = Math.max(0, activationPoint - 0.05);
    const activePeak = activationPoint;

    const pathLength = useTransform(scrollProgress, [drawStart, drawEnd], [0, 1]);
    const isEnergized = useTransform(scrollProgress, [activeStart, activePeak], [0, 1]);

    // Opacidade geral da caixa permanece forte após acender
    const cardOpacity = useTransform(scrollProgress, [activeStart - 0.05, activePeak], [0.4, 1]);
    const cardScale = useTransform(scrollProgress, [activeStart, activePeak], [0.95, 1]);

    // Opacidade dos nós SVG
    const nodeStartOpacity = useTransform(pathLength, [0, 0.1], [0, 1]);
    const nodeEndOpacity = useTransform(pathLength, [0.9, 1], [0, 1]);

    const pathRight = "M 0 20 L 40 20 L 60 50 L 100 50";
    const pathLeft = "M 100 20 L 60 20 L 40 50 L 0 50";

    return (
        <div className={`relative w-full flex md:w-1/2 py-10 md:py-20 ${isLeft ? 'md:justify-end md:pr-16 md:ml-0' : 'md:justify-start md:pl-16 md:ml-auto'} px-6 md:px-0`}>

            {/* RAMIFICAÇÃO ANGULAR (SVG) */}
            <div className={`hidden md:block absolute top-1/2 -translate-y-1/2 w-16 h-32 z-0 ${isLeft ? 'right-0' : 'left-0'}`}>
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path
                        d={isLeft ? pathLeft : pathRight}
                        fill="none"
                        stroke="rgba(148, 163, 184, 0.2)"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                    />
                    <motion.path
                        d={isLeft ? pathLeft : pathRight}
                        fill="none"
                        stroke="#06b6d4" // Ciano Puro
                        strokeWidth="3"
                        vectorEffect="non-scaling-stroke"
                        style={{ pathLength }}
                        className="drop-shadow-[0_0_10px_#06b6d4]"
                    />
                    <motion.circle cx={isLeft ? 100 : 0} cy="20" r="5" fill="#06b6d4" style={{ opacity: nodeStartOpacity }} className="drop-shadow-[0_0_8px_#06b6d4]" />
                    <motion.circle cx={isLeft ? 0 : 100} cy="50" r="5" fill="#06b6d4" style={{ opacity: nodeEndOpacity }} className="drop-shadow-[0_0_15px_#06b6d4]" />
                </svg>
            </div>

            {/* O MÓDULO (CARD) */}
            <motion.div
                style={{ opacity: cardOpacity, scale: cardScale }}
                className="relative z-10 w-full max-w-[420px]"
            >
                {/* CAMADA BASE: Inativa */}
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/60 backdrop-blur-2xl border border-slate-300 dark:border-white/10 rounded-3xl" />

                {/* CAMADA ENERGIZADA: Borda Ciano & Efeito GLOW Agressivo */}
                <motion.div
                    style={{ opacity: isEnergized }}
                    className="absolute inset-0 bg-white/40 dark:bg-[#061121]/90 backdrop-blur-3xl border-2 border-cyan-400 rounded-3xl shadow-[0_0_80px_rgba(34,211,238,0.5),inset_0_0_30px_rgba(34,211,238,0.3)] transition-colors"
                />

                {/* CONTEÚDO DO CARD */}
                <div className="relative p-8 flex flex-col gap-5 z-20">

                    {/* Detalhes Tecnominimalistas (Cruzes) */}
                    <div className="absolute top-4 left-4 w-2 h-2 border-t-2 border-l-2 border-slate-400/50 dark:border-slate-500/50" />
                    <div className="absolute top-4 right-4 w-2 h-2 border-t-2 border-r-2 border-slate-400/50 dark:border-slate-500/50" />
                    <div className="absolute bottom-4 left-4 w-2 h-2 border-b-2 border-l-2 border-slate-400/50 dark:border-slate-500/50" />
                    <div className="absolute bottom-4 right-4 w-2 h-2 border-b-2 border-r-2 border-slate-400/50 dark:border-slate-500/50" />

                    {/* Brilho Superior de Vidro */}
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent" />

                    <div className="flex items-center gap-4">
                        <div className="relative w-12 h-12 flex items-center justify-center">
                            <div className="absolute inset-0 border border-slate-300 dark:border-white/20 rounded-xl bg-slate-100 dark:bg-black/30" />
                            <motion.div
                                style={{ opacity: isEnergized }}
                                className="absolute inset-0 border border-cyan-400 bg-cyan-50 dark:bg-cyan-900/40 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.6)]"
                            />
                            {/* Ícone */}
                            <feature.icon className="absolute w-6 h-6 text-slate-500 dark:text-slate-500" />
                            <motion.div style={{ opacity: isEnergized }} className="absolute">
                                <feature.icon className="w-6 h-6 text-cyan-500 dark:text-cyan-400" />
                            </motion.div>
                        </div>

                        <div className="relative flex-1">
                            {/* Título Inativo */}
                            <h3 className="text-lg font-black uppercase tracking-wider text-slate-600 dark:text-slate-500 leading-tight">
                                {feature.name}
                            </h3>
                            {/* Título Energizado: Letras destacadas e brancas brilhantes */}
                            <motion.h3
                                style={{ opacity: isEnergized }}
                                className="absolute inset-0 text-lg font-black uppercase tracking-wider text-slate-900 dark:text-white leading-tight drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]"
                            >
                                {feature.name}
                            </motion.h3>
                        </div>
                    </div>

                    <div className="relative mt-2">
                        {/* Descrição Inativa */}
                        <p className="text-[14px] font-medium text-slate-500 dark:text-slate-500 leading-relaxed">
                            {feature.description}
                        </p>
                        {/* Descrição Energizada: Ciano super claro com contraste */}
                        <motion.p
                            style={{ opacity: isEnergized }}
                            className="absolute inset-0 text-[14px] font-bold text-slate-800 dark:text-cyan-50 leading-relaxed"
                        >
                            {feature.description}
                        </motion.p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// --- PÁGINA PRINCIPAL ---
export default function FeaturesPage() {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    // 1. O SCROLL PURO DO MOUSE (Com a sensibilidade de 35% definida por você)
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start 35%", "end 40%"]
    });

    // 2. A LINHA CENTRAL (1:1 direto do rato, sem atrasos)
    const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="w-full h-screen bg-slate-50 dark:bg-[#030508] flex items-center justify-center transition-colors duration-700">
                <StarBackground />
            </div>
        );
    }

    return (
        <div className="relative bg-slate-50 dark:bg-[#030508] transition-colors duration-700 font-sans overflow-hidden min-h-screen">

            {/* Background Estrelado 100% Visível */}
            <div className="fixed inset-0 z-0 opacity-40 dark:opacity-80 pointer-events-none">
                <StarBackground />
            </div>

            {/* Cabeçalho Flutuante */}
            <div className="relative z-10 zaeon-borda pt-20 pb-12 flex flex-col items-start text-left">
                <h1 className="text-4xl md:text-5xl lg:text-[4rem] font-light tracking-tighter max-w-4xl leading-[1.1] text-slate-900 dark:text-white drop-shadow-md">
                    Crie a sua própria <br className="hidden md:block" />
                    {/* Highlight Ciano Puro */}
                    <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-600 dark:from-cyan-300 dark:to-cyan-500">
                        estação de trabalho.
                    </span>
                </h1>
            </div>

            {/* CONTEINER DE CARROSSEL / ENERGIZAÇÃO */}
            <div ref={containerRef} className="relative z-10 zaeon-borda py-10 w-full">

                {/* O FIO CENTRAL NEURAL */}
                <div className="absolute top-0 bottom-0 left-6 md:left-1/2 w-[3px] bg-slate-300 dark:bg-white/10 md:-translate-x-1/2 rounded-full z-0">
                    <motion.div
                        className="absolute top-0 left-0 w-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.6)]"
                        style={{ height: lineHeight }}
                    >
                        {/* Glow leve e elegante focado apenas na ponta da linha */}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[3px] h-24 bg-gradient-to-t from-cyan-200 to-transparent shadow-[0_5px_15px_#22d3ee]" />
                    </motion.div>
                </div>

                {/* GERAÇÃO DOS MÓDULOS DE FUNCIONALIDADE */}
                <div className="relative w-full flex flex-col">
                    {FEATURES.map((feature, idx) => (
                        <FeatureCard
                            key={feature.id}
                            feature={feature}
                            index={idx}
                            total={FEATURES.length}
                            scrollProgress={scrollYProgress}
                        />
                    ))}
                </div>
            </div>

            {/* Espaçador final para permitir que a rolagem ultrapasse totalmente o último card */}
            <div className="h-[25vh]" />
        </div>
    );
}