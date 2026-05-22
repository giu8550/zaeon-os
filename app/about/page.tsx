"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { ArrowLeftIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import MacSplash from "@/components/ui/MacSplash";

// ─── SCRAMBLE TEXT HOOK ───────────────────────────────────────────────────────
const CHAR_POOL = ["紀", "律", "知", "識", "未", "来", "革", "新", "卓", "越", "智", "慧", "能", "力"];

const useScrambleText = (targetText: string, start: boolean) => {
    const [displayText, setDisplayText] = useState("");
    const [isComplete, setIsComplete] = useState(false);
    const stateRef = useRef<"idle" | "scrambling" | "resolving" | "holding">("idle");
    const startTimeRef = useRef<number>(0);
    const lastStateChangeTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number>();

    const animate = useCallback(
        (timestamp: number) => {
            if (!start) return;
            if (!startTimeRef.current) startTimeRef.current = timestamp;
            if (lastStateChangeTimeRef.current === 0) lastStateChangeTimeRef.current = timestamp;
            const elapsedInCurrentState = timestamp - lastStateChangeTimeRef.current;

            switch (stateRef.current) {
                case "idle":
                    stateRef.current = "scrambling";
                    lastStateChangeTimeRef.current = timestamp;
                    break;
                case "scrambling":
                    if (elapsedInCurrentState >= 3000) {
                        stateRef.current = "resolving";
                        lastStateChangeTimeRef.current = timestamp;
                    } else {
                        setDisplayText(
                            targetText
                                .split("")
                                .map((c) =>
                                    c === " " ? " " : CHAR_POOL[Math.floor(Math.random() * CHAR_POOL.length)]
                                )
                                .join("")
                        );
                    }
                    break;
                case "resolving": {
                    const progress = Math.min(elapsedInCurrentState / 2000, 1);
                    const resolved = targetText
                        .split("")
                        .map((char, i) =>
                            i < targetText.length * progress
                                ? char
                                : char === " "
                                    ? " "
                                    : CHAR_POOL[Math.floor(Math.random() * CHAR_POOL.length)]
                        )
                        .join("");
                    setDisplayText(resolved);
                    if (progress === 1) {
                        stateRef.current = "holding";
                        lastStateChangeTimeRef.current = timestamp;
                        setIsComplete(true);
                    }
                    break;
                }
                case "holding":
                    if (elapsedInCurrentState >= 3000) {
                        stateRef.current = "scrambling";
                        lastStateChangeTimeRef.current = timestamp;
                        setIsComplete(false);
                    }
                    break;
            }
            animationFrameRef.current = requestAnimationFrame(animate);
        },
        [targetText, start]
    );

    useEffect(() => {
        if (start) animationFrameRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameRef.current!);
    }, [animate, start]);

    return { displayText, isComplete };
};

// ─── CYBER TITLE ─────────────────────────────────────────────────────────────
const CyberTitle = ({
    mainText,
    secondaryText,
    scrollText,
    startAnimations,
}: {
    mainText: string;
    secondaryText: string;
    scrollText: string;
    startAnimations: boolean;
}) => {
    const { displayText: sText, isComplete: sDone } = useScrambleText(secondaryText, startAnimations);
    const { displayText: mText, isComplete: mDone } = useScrambleText(mainText, startAnimations);

    return (
        <div className="text-center mb-16 relative z-20 min-h-[200px] flex flex-col justify-center">
            <h2 className="text-lg md:text-2xl font-medium tracking-[0.3em] mb-3 font-mono uppercase h-8">
                <span className={`${sDone ? "text-cyan-400/90" : "text-white/40"} transition-all duration-1000`}>
                    {sText}
                </span>
            </h2>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter text-white font-mono uppercase h-24">
                <span
                    className={`${mDone ? "text-white drop-shadow-[0_0_30px_rgba(34,211,238,0.8)]" : "text-white/20"
                        }`}
                >
                    {mText}
                </span>
            </h1>
            <div className="mt-10 flex flex-col items-center gap-3">
                <span className="text-cyan-400 font-bold text-[10px] uppercase tracking-[0.5em] animate-pulse">
                    {scrollText}
                </span>
                <ChevronDownIcon className="w-5 h-5 text-cyan-500/70" />
            </div>
        </div>
    );
};

// ─── TEXT BLOCK ───────────────────────────────────────────────────────────────
const TextBlock = ({
    children,
    align = "left",
    glowColor = "cyan",
    direction = "none",
    customBg = "bg-black/60",
}: {
    children: React.ReactNode;
    align?: "left" | "right" | "center";
    glowColor?: "cyan" | "purple";
    direction?: "left" | "right" | "none";
    customBg?: string;
}) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: false, margin: "-15% 0px" });
    const alignClass =
        align === "left"
            ? "items-start text-left"
            : align === "right"
                ? "items-end text-right ml-auto"
                : "items-center text-center mx-auto";
    const xInitial = direction === "left" ? -150 : direction === "right" ? 150 : 0;
    const yInitial = direction === "none" ? 50 : 0;

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, x: xInitial, y: yInitial }}
            animate={isInView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: xInitial, y: yInitial }}
            transition={{ type: "spring", stiffness: 50, damping: 20, mass: 1 }}
            whileHover={{ y: -5, scale: 1.01, transition: { duration: 0.3 } }}
            className={`flex flex-col ${alignClass} max-w-4xl w-full p-10 rounded-[2.5rem]
                        backdrop-blur-xl ${customBg} border border-white/10 shadow-2xl
                        relative overflow-hidden group
                        ${glowColor === "cyan"
                    ? "hover:border-cyan-500/40 hover:shadow-[0_0_40px_rgba(34,211,238,0.2)]"
                    : "hover:border-purple-500/40 hover:shadow-[0_0_40px_rgba(168,85,247,0.2)]"
                }`}
        >
            <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.05] via-transparent to-black/20" />
            <div className="relative z-10 space-y-6 text-white leading-relaxed font-light text-lg md:text-xl drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                {children}
            </div>
        </motion.div>
    );
};

// ─── MOLECULE DATA ────────────────────────────────────────────────────────────
const MOLECULE_NODES = [
    {
        level: "01",
        title: "Crie, Contrate & Colabore",
        description:
            "Crie o seu agente perfeito para você. Defina voz, personalidade e habilidades.",
        tags: ["Designer", "Advogado", "Dev", "Professor", "Médico", "Empreendedor"],
        glowColor: "rgba(34,211,238,0.6)",
        borderClass: "border-cyan-500/50",
        bgClass: "bg-cyan-950/60",
        tagClass: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
        textClass: "text-cyan-400",
        pulseClass: "border-cyan-400/30",
    },
    {
        level: "02",
        title: "Construa Projetos",
        subtitle: "IA trabalhando ao seu lado",
        description:
            "Colabore com seus agentes em projetos reais. Automatize tarefas, gere conteúdo, analise dados e evolua a cada sessão. Tudo que você cria é protegido como sua propriedade intelectual.",
        tags: ["Automação", "Criação", "Análise", "Produtividade"],
        glowColor: "rgba(168,85,247,0.6)",
        borderClass: "border-purple-500/50",
        bgClass: "bg-purple-950/60",
        tagClass: "bg-purple-500/10 text-purple-300 border-purple-500/20",
        textClass: "text-purple-400",
        pulseClass: "border-purple-400/30",
    },
    {
        level: "03",
        title: "Compartilhe no Mural",
        subtitle: "Comunidade + IP protegido",
        description:
            "Publique experimentos, ideias e projetos no mural da plataforma. Público, privado ou apenas para o seu time — você decide. O que foi criado entre você e seu agente sempre será seu.",
        tags: ["Mural Público", "Projeto Privado", "Time", "IP Protegido"],
        glowColor: "rgba(16,185,129,0.6)",
        borderClass: "border-emerald-500/50",
        bgClass: "bg-emerald-950/60",
        tagClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
        textClass: "text-emerald-400",
        pulseClass: "border-emerald-400/30",
    },
] as const;

// ─── FLOW BOND ────────────────────────────────────────────────────────────────
// Analogia: como o fio de energia que conecta dois átomos numa molécula —
// quando o átomo de cima está ativo, elétrons fluem para o próximo.
const FlowBond = ({
    isActive,
    fromColor,
    toColor,
}: {
    isActive: boolean;
    fromColor: string;
    toColor: string;
}) => (
    <div className="relative flex justify-center items-start h-20 w-8">
        {/* Linha estática */}
        <div
            className="w-[2px] h-full rounded-full transition-all duration-1000"
            style={{
                background: isActive
                    ? `linear-gradient(to bottom, ${fromColor}, ${toColor})`
                    : "rgba(255,255,255,0.08)",
                opacity: isActive ? 1 : 0.4,
            }}
        />
        {/* Partículas fluindo */}
        {isActive && (
            <>
                <motion.div
                    animate={{ y: [0, 76] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
                    style={{ background: fromColor, boxShadow: `0 0 14px ${fromColor}` }}
                />
                <motion.div
                    animate={{ y: [0, 76] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "linear", delay: 0.7 }}
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-[5px] h-[5px] rounded-full bg-white/30"
                />
            </>
        )}
    </div>
);

// ─── MOLECULE SECTION ─────────────────────────────────────────────────────────
// 3 nós conectados por ligações com fluxo animado.
// Cada nó se acende conforme entra na viewport ao rolar a tela.
const MoleculeSection = () => {
    const node0Ref = useRef<HTMLDivElement>(null);
    const node1Ref = useRef<HTMLDivElement>(null);
    const node2Ref = useRef<HTMLDivElement>(null);

    const isNode0 = useInView(node0Ref, { once: false, margin: "-10% 0px" });
    const isNode1 = useInView(node1Ref, { once: false, margin: "-10% 0px" });
    const isNode2 = useInView(node2Ref, { once: false, margin: "-10% 0px" });

    const activeMap = [isNode0, isNode1, isNode2];
    const refs = [node0Ref, node1Ref, node2Ref];

    return (
        <div className="flex flex-col items-center w-full max-w-[1000px] mx-auto my-16 px-4 lg:px-0">
            {/* Cabeçalho */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-20"
            >
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-cyan-500/70 mb-4">
                    Como funciona
                </p>
                <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter">
                    Três camadas.{" "}
                    <span className="text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.4)]">
                        Um ecossistema.
                    </span>
                </h2>
            </motion.div>

            {/* Cadeia da molécula */}
            <div className="flex flex-col items-center w-full gap-0">
                {MOLECULE_NODES.map((node, i) => {
                    const isActive = activeMap[i];
                    const isEven = i % 2 === 0;

                    return (
                        <div key={i} className="flex flex-col items-center w-full">
                            {/* Linha do nó */}
                            <div
                                ref={refs[i]}
                                className={`flex items-center w-full gap-5 ${!isEven ? "lg:flex-row-reverse" : ""
                                    }`}
                            >
                                {/* Átomo */}
                                <motion.div
                                    animate={
                                        isActive
                                            ? {
                                                boxShadow: [
                                                    `0 0 20px ${node.glowColor}`,
                                                    `0 0 60px ${node.glowColor}`,
                                                    `0 0 20px ${node.glowColor}`,
                                                ],
                                            }
                                            : { boxShadow: "0 0 0px transparent" }
                                    }
                                    transition={{ duration: 2.5, repeat: Infinity }}
                                    className={`flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-full border-2 ${node.borderClass} ${node.bgClass} backdrop-blur-xl flex flex-col items-center justify-center relative`}
                                >
                                    <span
                                        className={`text-[7px] font-black uppercase tracking-wider transition-colors duration-700 ${isActive ? node.textClass : "text-white/20"
                                            }`}
                                    >
                                        LVL
                                    </span>
                                    <span
                                        className={`text-xl font-black transition-colors duration-700 ${isActive ? "text-white" : "text-white/20"
                                            }`}
                                    >
                                        {node.level}
                                    </span>
                                    {/* Anel pulsante de ativação */}
                                    {isActive && (
                                        <motion.div
                                            animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
                                            transition={{ duration: 2.5, repeat: Infinity }}
                                            className={`absolute inset-0 rounded-full border ${node.pulseClass}`}
                                        />
                                    )}
                                </motion.div>

                                {/* Card de conteúdo */}
                                <motion.div
                                    initial={{ opacity: 0, x: isEven ? 40 : -40 }}
                                    animate={
                                        isActive
                                            ? { opacity: 1, x: 0 }
                                            : { opacity: 0.15, x: isEven ? 18 : -18 }
                                    }
                                    transition={{ type: "spring", stiffness: 60, damping: 20 }}
                                    className={`flex-1 p-5 md:p-7 rounded-[1.8rem] backdrop-blur-xl ${node.bgClass} border ${node.borderClass} shadow-xl`}
                                >
                                    <h3 className="text-lg md:text-xl font-black text-white mt-1 mb-2 tracking-tight">
                                        {node.title}
                                    </h3>
                                    <p className="text-xs md:text-sm text-white/60 leading-relaxed">
                                        {node.description}
                                    </p>
                                </motion.div>
                            </div>

                            {/* Ligação entre nós */}
                            {i < MOLECULE_NODES.length - 1 && (
                                <FlowBond
                                    isActive={isActive}
                                    fromColor={node.glowColor}
                                    toColor={MOLECULE_NODES[i + 1].glowColor}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Rodapé da seção */}
            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                className="mt-16 text-center"
            >
                <div className="w-20 h-[2px] bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-500 mx-auto mb-5 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400">
                    Você cria. Você controla. Você decide o que compartilha.
                </p>
            </motion.div>
        </div>
    );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function AboutUsPage() {
    const { i18n } = useTranslation();
    const [mounted, setMounted] = useState(false);
    const containerRef = useRef(null);
    const missionRef = useRef(null);

    const { scrollYProgress } = useScroll({ target: containerRef });
    const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);

    const { scrollYProgress: missionProgress } = useScroll({
        target: missionRef,
        offset: ["start end", "end start"],
    });
    const missionX = useTransform(missionProgress, [0, 0.15, 0.6, 0.8], [-300, 0, 0, -300]);
    const missionOpacity = useTransform(missionProgress, [0, 0.15, 0.6, 0.8], [0, 1, 1, 0]);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !i18n.isInitialized) return <MacSplash minDurationMs={1500} />;

    return (
        <div
            ref={containerRef}
            className="relative min-h-[300vh] bg-[#030014] overflow-hidden font-sans z-[200]"
        >
            {/* ── Botão voltar ── */}
            <button
                onClick={() => window.history.back()}
                className="fixed top-28 left-10 z-[300] flex items-center gap-3 text-white/40 hover:text-cyan-400 group"
            >
                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center backdrop-blur-xl bg-white/5 transition-all shadow-xl">
                    <ArrowLeftIcon className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                </div>
                <span className="text-[10px] uppercase tracking-[0.3em] font-black opacity-0 group-hover:opacity-100 transition-all">
                    Voltar
                </span>
            </button>

            {/* ── Fundo parallax ── */}
            <motion.div className="fixed inset-0 z-[190]" style={{ y: backgroundY }}>
                <Image
                    src="/about/about-us-room.png"
                    alt="Zaeon"
                    fill
                    priority
                    className="object-cover opacity-60"
                />
                <div className="absolute inset-0 z-20 bg-gradient-to-t from-[#030014] via-[#030014]/50 to-transparent" />
            </motion.div>

            {/* ── Conteúdo ── */}
            <div className="relative z-[210] flex flex-col items-center pt-[32vh] pb-[40vh] px-6 gap-[22vh]">

                {/* Hero Title */}
                <CyberTitle
                    startAnimations={true}
                    secondaryText="PLATAFORMA DE AGENTES IA"
                    mainText="ZAEON"
                    scrollText="Descubra mais"
                />

                {/* ── Card 1: Posicionamento ── */}
                <TextBlock align="left" glowColor="cyan" direction="none" customBg="bg-black/80">
                    <h2 className="text-2xl md:text-4xl font-black text-white mb-6 tracking-tight uppercase flex items-center gap-4">
                        <span className="w-2 h-10 bg-gradient-to-b from-cyan-400 to-blue-600 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.5)]" />
                        Para qualquer profissão. Para qualquer rotina.
                    </h2>
                    <p className="font-medium text-white/95">
                        A Zaeon é onde você cria, contrata e usa agentes de inteligência artificial
                        para te ajudar no dia a dia — seja você designer, advogado, médico, professor,
                        empreendedor ou simplesmente curioso.
                    </p>
                    <p className="text-white/80">
                        Cada agente tem voz, personalidade e habilidades definidas por quem o criou.{" "}
                        <span className="text-cyan-400 font-bold drop-shadow-[0_0_5px_rgba(34,211,238,0.3)]">
                            Não existe profissão que não caiba aqui.
                        </span>
                    </p>
                </TextBlock>

                {/* ── Card 2: Mural & IP ── */}
                <div ref={missionRef} className="w-full max-w-7xl flex items-center justify-end gap-16 relative">
                    <motion.div
                        style={{ x: missionX, opacity: missionOpacity }}
                        className="hidden lg:block relative w-[460px] h-[560px] rounded-[3.5rem] overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.4)] transition-all duration-700"
                    >
                        <Image
                            src="/assets/zenitta.png"
                            alt="Zaeon Agent"
                            fill
                            className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-900/20 to-transparent mix-blend-overlay" />
                    </motion.div>

                    <TextBlock align="right" glowColor="purple" direction="right" customBg="bg-indigo-950/80">
                        <h2 className="text-2xl md:text-4xl font-black text-white mb-6 tracking-tight uppercase flex items-center justify-end gap-4">
                            Seus projetos. Sua propriedade.
                            <span className="w-2 h-10 bg-gradient-to-b from-purple-400 to-indigo-600 rounded-full shadow-[0_0_20px_rgba(168,85,247,0.5)]" />
                        </h2>
                        <p className="text-xl md:text-3xl font-extralight italic text-white drop-shadow-md">
                            Crie. Colabore. Compartilhe no seu ritmo.
                        </p>
                        <p className="text-base text-white/70 mt-4 leading-relaxed">
                            Tudo que você desenvolve com seus agentes é protegido como propriedade
                            intelectual privada. Você decide o que entra no mural da comunidade — seja
                            um experimento bem-sucedido, uma ideia em desenvolvimento ou um negócio
                            pronto para crescer.
                        </p>
                    </TextBlock>
                </div>

                {/* ── Molécula ── */}
                <MoleculeSection />

                {/* ── CTA ── */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 1.5 }}
                    className="text-center relative z-40 pb-[10vh]"
                >
                    <h2 className="text-4xl md:text-7xl font-black text-white mb-12 tracking-tighter drop-shadow-2xl opacity-90">
                        Quer ver a tecnologia na prática?
                    </h2>
                    <Link
                        href="/about/about-us"
                        className="group relative inline-block px-20 py-8 bg-black/40 border border-cyan-500/30 text-white font-black text-xl uppercase tracking-[0.3em] overflow-hidden hover:scale-105 transition-all duration-500 rounded-2xl shadow-2xl backdrop-blur-md"
                    >
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600/40 via-cyan-500/40 to-blue-600/40 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                        <span className="relative z-10 group-hover:text-cyan-100 group-hover:drop-shadow-[0_0_10px_white] transition-all">
                            Pronto para começar?
                        </span>
                    </Link>
                </motion.div>
            </div>

            <style jsx global>{`
                .perspective-1000 {
                    perspective: 1000px;
                }
            `}</style>
        </div>
    );
}
