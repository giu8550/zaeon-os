"use client";

import { motion } from "framer-motion";
import React, { useState, useEffect } from "react";
import NextImage from "next/image";
import {
    CpuChipIcon,
    BeakerIcon,
    ScaleIcon,
    BriefcaseIcon,
    CheckBadgeIcon,
    ChevronLeftIcon,
    ChevronRightIcon
} from "@heroicons/react/24/solid";
import { useTranslation } from "react-i18next";
import ZaeonFlowDiagram from "./ZaeonFlowDiagram";

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
// =========================================================================
const AGENTS = [
    {
        id: 'advogado',
        name: "Dr. Marcus Vance",
        role: "Advogado Societário",
        exp: "Análise de Contratos",
        company: "Vance & Associates AI",
        agentId: "ZAN-001V",
        icon: ScaleIcon,
        img: "Marcus"
    },
    {
        id: 'secretaria',
        name: "Elena Rostova",
        role: "Secretária Executiva",
        exp: "Gestão de E-mails e Agenda",
        company: "Rostova Core Solutions",
        agentId: "ZAN-002R",
        icon: BriefcaseIcon,
        img: "Elena"
    },
    {
        id: 'medico',
        name: "Dra. Sarah Lin",
        role: "Pesquisadora Médica",
        exp: "Triagem de Artigos Científicos",
        company: "Lin Neural Labs",
        agentId: "ZAN-003L",
        icon: BeakerIcon,
        img: "Sarah"
    },
    {
        id: 'orquestrador',
        name: "Zaeon Core",
        role: "Orquestrador",
        exp: "Delegação Multi-tarefas",
        company: "Zaeon Systems Corp.",
        agentId: "ZAN-CORE-00",
        icon: CpuChipIcon,
        img: "Zaeon"
    },
];

const HireAgentsSection = () => {
    const [selectedAgentIndex, setSelectedAgentIndex] = useState(0);

    const handleNext = () => {
        setSelectedAgentIndex((prev) => (prev + 1) % AGENTS.length);
    };

    const handlePrev = () => {
        setSelectedAgentIndex((prev) => (prev - 1 + AGENTS.length) % AGENTS.length);
    };

    return (
        <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-16 mt-10 mb-20 z-40 relative px-4 bg-transparent">

            {/* LADO ESQUERDO: Highlight */}
            <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="flex flex-col flex-1 gap-6 text-center lg:text-left items-center lg:items-start z-10 w-full"
            >
                <h2 className="text-[8vw] md:text-[56px] font-light tracking-tighter text-slate-900 dark:text-white leading-[1.1] max-w-xl drop-shadow-md">
                    Contrate <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600 dark:from-cyan-400 dark:to-blue-500">Agentes</span> para trabalharem consigo
                </h2>
                <p className="mt-2 text-base md:text-lg text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-lg">
                    Delegue tarefas repetitivas e complexas a especialistas neurais treinados. Explore os crachás à direita para descobrir a sua próxima contratação.
                </p>
            </motion.div>

            {/* LADO DIREITO: Stack de Crachás 3D */}
            <div className="w-full lg:w-1/2 flex items-center justify-center relative min-h-[550px]">

                {/* Botão Anterior */}
                <div className="absolute left-0 md:-left-4 z-50">
                    <button
                        onClick={handlePrev}
                        className="p-3 rounded-full bg-white/20 dark:bg-black/40 backdrop-blur-xl border border-slate-300 dark:border-white/10 text-cyan-600 dark:text-cyan-400 hover:bg-white/40 dark:hover:bg-white/10 hover:scale-110 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
                    >
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Carrossel 3D de Cartões */}
                <div className="relative w-full max-w-[360px] h-[480px] flex items-center justify-center">
                    {AGENTS.map((agent, index) => {
                        // Calcula a diferença relativa de posição para criar a pilha infinita
                        const diff = (index - selectedAgentIndex + AGENTS.length) % AGENTS.length;

                        const isSelected = diff === 0;

                        // Posições baseadas na profundidade
                        const xOffset = diff * 35;  // Deslocamento para a direita
                        const yOffset = diff * -20; // Deslocamento para cima
                        const scale = 1 - diff * 0.08; // Diminui o tamanho
                        const opacity = diff === 0 ? 1 : diff === 1 ? 0.7 : diff === 2 ? 0.3 : 0;
                        const zIndex = 10 - diff;

                        return (
                            <motion.div
                                key={agent.id}
                                animate={{ x: xOffset, y: yOffset, scale, opacity, zIndex }}
                                transition={{ duration: 0.5, type: "spring", stiffness: 120, damping: 20 }}
                                style={{ pointerEvents: isSelected ? "auto" : "none" }}
                                className="absolute w-[340px] aspect-[3/4] rounded-[3rem] bg-white/50 dark:bg-[#0a0a0f]/40 backdrop-blur-3xl border border-slate-200 dark:border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_40px_100px_rgba(0,0,0,0.6)] p-8 flex flex-col items-center text-center group overflow-hidden"
                            >
                                {/* Reflexos de Vidro Linear */}
                                <div className="absolute inset-0 bg-gradient-to-b from-white/60 dark:from-white/10 via-transparent to-transparent opacity-100 transition-opacity pointer-events-none" />
                                <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[linear-gradient(210deg,rgba(255,255,255,0.3)_15%,transparent_35%,rgba(255,255,255,0.1)_50%,transparent_65%)] dark:bg-[linear-gradient(210deg,rgba(255,255,255,0.08)_15%,transparent_35%,rgba(255,255,255,0.05)_50%,transparent_65%)] rotate-[15deg] group-hover:rotate-[25deg] transition-transform duration-1000 pointer-events-none z-0" />

                                {/* Borda Glow Neon Hover (Apenas se estiver ativo) */}
                                <div className={`absolute inset-[-1px] rounded-[3.5rem] border-[3px] border-cyan-400 transition-opacity duration-500 blur-[1px] group-hover:blur-[2px] shadow-[0_0_80px_rgba(34,211,238,0.3),inset_0_0_30px_rgba(34,211,238,0.2)] pointer-events-none ${isSelected ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'}`} />

                                {/* Textura Interna */}
                                <div className="absolute inset-6 rounded-3xl bg-slate-50/40 dark:bg-white/[0.02] backdrop-blur-md border border-slate-200 dark:border-white/5 shadow-inner pointer-events-none" />

                                {/* Clipe do Crachá Superior */}
                                <div className="absolute top-4 w-16 h-2 rounded-full bg-slate-300 dark:bg-black/40 border border-slate-400/50 dark:border-white/5 shadow-inner z-10" />

                                {/* Avatar Profiler */}
                                <div className="relative w-32 h-32 mt-8 rounded-full p-1 bg-gradient-to-tr from-cyan-400 to-blue-600 shadow-2xl z-20">
                                    <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-[#0a0a0f] flex items-center justify-center">
                                        <img src={`https://ui-avatars.com/api/?name=${agent.img}&background=random&color=fff&bold=true`} alt={agent.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="absolute bottom-2 right-2 w-6 h-6 bg-emerald-400 border-[3px] border-white dark:border-slate-950 rounded-full animate-pulse shadow-[0_0_15px_rgba(52,211,153,0.8)]" />
                                    <span className="absolute bottom-[-22px] left-1/2 -translate-x-1/2 text-[10px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 uppercase drop-shadow-md">Online</span>
                                </div>

                                {/* Informações do Agente */}
                                <div className="mt-10 flex flex-col items-center w-full relative z-20 gap-2">
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5 drop-shadow-sm dark:drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
                                        {agent.name} <CheckBadgeIcon className="w-5 h-5 text-blue-500" />
                                    </h3>
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-500/10 px-3 py-1.5 rounded-full border border-cyan-300 dark:border-cyan-500/20 flex items-center gap-1">
                                        <agent.icon className="w-3 h-3" /> {agent.role}
                                    </span>
                                    <div className="mt-4 flex flex-col gap-1 text-[11px] text-slate-600 dark:text-cyan-50/70 font-semibold leading-tight">
                                        <p>Foco: <span className="text-slate-900 dark:text-white">{agent.exp}</span></p>
                                        <p>Org: <span className="text-slate-900 dark:text-white">{agent.company}</span></p>
                                        <p className="opacity-50 mt-1 font-mono text-[9px]">{agent.agentId}</p>
                                    </div>
                                </div>

                                {/* Botão de Ação */}
                                <div className="mt-auto w-full pt-4 border-t border-slate-200 dark:border-white/10 relative z-20">
                                    <button className="w-full py-3.5 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 backdrop-blur-md border border-cyan-400/50 dark:border-cyan-500 text-cyan-700 dark:text-cyan-300 text-[10px] font-black uppercase tracking-widest hover:bg-cyan-100 dark:hover:bg-cyan-500/30 hover:text-cyan-900 dark:hover:text-white dark:hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all shadow-sm active:scale-95">
                                        Contratar Agente
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Botão Próximo */}
                <div className="absolute right-0 md:-right-4 z-50">
                    <button
                        onClick={handleNext}
                        className="p-3 rounded-full bg-white/20 dark:bg-black/40 backdrop-blur-xl border border-slate-300 dark:border-white/10 text-cyan-600 dark:text-cyan-400 hover:bg-white/40 dark:hover:bg-white/10 hover:scale-110 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
                    >
                        <ChevronRightIcon className="w-6 h-6" />
                    </button>
                </div>

            </div>
        </div>
    );
};

// =========================================================================
// CARROSSEL VERTICAL DE MARCAS IA (Infinite Ticker)
// =========================================================================
const CompaniesVerticalTicker = () => {
    const companies = [
        { name: "OpenAI", src: "/companies/openai.png" },
        { name: "Anthropic", src: "/companies/anthropic.png" },
        { name: "Google", src: "/companies/google.png" },
        { name: "Meta", src: "/companies/meta.png" },
        { name: "Mistral", src: "/companies/mistral.png" },
    ];
    const tickerItems = [...companies, ...companies, ...companies];

    return (
        <div className="w-full max-w-sm flex flex-col items-center justify-center my-10 z-40 relative h-[350px] overflow-hidden bg-transparent">
            <div className="absolute inset-0 z-20 pointer-events-none" style={{ background: 'linear-gradient(to bottom, var(--tw-gradient-stops))' }} />
            <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-b from-[#eef2f6] via-transparent to-[#eef2f6] dark:from-[#030508] dark:via-transparent dark:to-[#030508]" />

            <div className="w-full flex justify-center mb-6 z-30 absolute top-4">
                <h3 className="text-center text-[10px] font-black tracking-[0.4em] text-cyan-600 dark:text-cyan-400 uppercase bg-white/80 dark:bg-[#030508]/80 backdrop-blur-md px-6 py-2 rounded-full border border-slate-200 dark:border-white/10 shadow-sm">
                    Equipados com
                </h3>
            </div>

            <div className="relative h-full w-full flex justify-center pt-16">
                <motion.div
                    animate={{ y: ["0%", "-50%"] }}
                    transition={{ ease: "linear", duration: 15, repeat: Infinity }}
                    className="flex flex-col gap-6 w-[200px]"
                >
                    {tickerItems.map((item, i) => (
                        <div
                            key={i}
                            className="relative flex items-center justify-center w-full h-[80px] rounded-[1.5rem] border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-[#0a0a0f]/40 backdrop-blur-md shrink-0 transition-all duration-300 hover:border-cyan-400/50 group"
                        >
                            <div className="relative w-[70%] h-[50%] flex items-center justify-center grayscale group-hover:grayscale-0 transition-all duration-500 opacity-50 group-hover:opacity-100">
                                <NextImage src={item.src} alt={item.name} fill className="object-contain" />
                            </div>
                        </div>
                    ))}
                </motion.div>
            </div>
        </div>
    );
};

// --- FLUXOGRAMA "LIQUID GLASS" ---
const ProcessFlowchart = () => {
    const { t } = useTranslation();

    return (
        <div className="w-full pt-20 pb-40 px-4 flex flex-col items-center justify-center bg-transparent relative z-40">
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
                    relative w-full max-w-4xl rounded-[2rem] 
                    
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
            <section
                className="relative z-[30] w-full bg-transparent flex flex-col items-center pt-28 md:pt-36 pb-10"
            >
                {/* DIAGRAMA VIVO: entrada -> cerebro Zaeon -> saida */}
                <ZaeonFlowDiagram className="w-full max-w-6xl px-4" />

                <div className="w-full mt-10 md:mt-16">
                    <SponsorsTicker opacity={1} />
                </div>
            </section>

            {/* ========================================================= */}
            {/* SECÇÃO: CONTRATAÇÃO DE AGENTES (3D Cover Flow) E MARCAS   */}
            {/* ========================================================= */}
            <div className="relative z-40 w-full flex flex-col items-center justify-center bg-transparent pt-10">
                <HireAgentsSection />
                <CompaniesVerticalTicker />
            </div>

            {/* FLUXOGRAMA NO FINAL (Intacto) */}
            <ProcessFlowchart />
        </div>
    );
}