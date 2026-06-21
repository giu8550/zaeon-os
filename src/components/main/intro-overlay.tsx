"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sun, Moon, Mic } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useVoiceMode } from "@/lib/voice/voiceMode";

const TIMELINE = {
    AUDIO_SRC: "/assets/sounds/boot-track.mp3",
    TOTAL_DURATION: 7.0,
    STAGE_2_BAR_APPEARS: 0.1,
    STAGE_3_MOD_1_START: 1.8,
    STAGE_4_MOD_2_START: 3.6,
    STAGE_5_MOD_3_START: 5.4,
};

type Props = {
    show?: boolean;
    onDone?: () => void;
};

const PT_TEXT = "Iniciar";
const ZH_CHARS = "点击进入系统链接世界网络数据启动矩阵核心希望之星日月星辰";

function GlitchChar({ originalChar, targetLang, index, hasStarted }: { originalChar: string, targetLang: 'pt' | 'zh', index: number, hasStarted: boolean }) {
    const [char, setChar] = useState(originalChar);
    const [isGlitching, setIsGlitching] = useState(false);

    // Keep a stable random chinese char for this instance
    const [zhChar] = useState(() => ZH_CHARS[Math.floor(Math.random() * ZH_CHARS.length)]);

    useEffect(() => {
        if (hasStarted) {
            setChar(originalChar);
            setIsGlitching(false);
            return;
        }

        let t1: NodeJS.Timeout, t2: NodeJS.Timeout;

        const delay = index * 40; // Wave propagation delay

        t1 = setTimeout(() => {
            setIsGlitching(true);
            t2 = setTimeout(() => {
                setChar(targetLang === 'pt' ? originalChar : zhChar);
                setIsGlitching(false);
            }, 300); // peak of blur
        }, delay);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [targetLang, hasStarted, originalChar, zhChar, index]);

    return (
        <motion.span
            animate={{ 
                filter: isGlitching ? "blur(3px)" : "blur(0px)",
                opacity: isGlitching ? 0.3 : 1,
                scale: isGlitching ? 0.85 : 1
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="inline-block"
        >
            {char}
        </motion.span>
    );
}

function GlitchText({ text, targetLang, hasStarted }: { text: string, targetLang: 'pt' | 'zh', hasStarted: boolean }) {
    const words = text.split(' ');
    let globalIndex = 0;

    return (
        <>
            {words.map((word, wIdx) => (
                <span key={wIdx} className="inline-flex whitespace-nowrap mx-[3px] sm:mx-[5px]">
                    {word.split('').map((char, cIdx) => {
                        const currentIndex = globalIndex++;
                        return (
                            <GlitchChar 
                                key={cIdx} 
                                originalChar={char} 
                                targetLang={targetLang} 
                                index={currentIndex} 
                                hasStarted={hasStarted} 
                            />
                        );
                    })}
                </span>
            ))}
        </>
    );
}

export default function MacSplash({ show = true, onDone }: Props) {
    const { theme, setTheme } = useTheme();
    const router = useRouter();
    const { i18n } = useTranslation();
    const [voiceMode, setVoiceMode] = useVoiceMode(); // modo voz (passivo|ativo), disponível já na tela inicial
    const [mounted, setMounted] = useState(false);

    const [hasStarted, setHasStarted] = useState(false);
    const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);
    const [visible, setVisible] = useState(show);
    const [opacity, setOpacity] = useState(0);

    const [targetLang, setTargetLang] = useState<'pt' | 'zh'>('pt');

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);

    const isAudioPlaying = useRef(false);
    const startTimeRef = useRef<number | null>(null);
    const exitingRef = useRef(false);
    const phaseRef = useRef<0 | 1 | 2 | 3 | 4>(0);

    const onDoneRef = useRef(onDone);
    useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

    useEffect(() => {
        setMounted(true);
    }, []);

    // LOADING FUNCIONAL: enquanto a intro roda, pré-carrega de verdade o código das salas
    // (sobretudo a Sala de Pesquisa) → quando o usuário entra, já está pronto, sem espera.
    useEffect(() => {
        try {
            router.prefetch("/research-lab");
            router.prefetch("/workstation");
            router.prefetch("/plugin-store");
        } catch { /* ignore */ }
    }, [router]);

    // Wave Glitch Cycle
    useEffect(() => {
        if (hasStarted) return;
        
        let t1: NodeJS.Timeout, t2: NodeJS.Timeout;
        
        const cycle = () => {
            setTargetLang('zh');
            t1 = setTimeout(() => {
                setTargetLang('pt');
                t2 = setTimeout(cycle, 4000); // Fica em Português por 4s
            }, 2500); // Fica em Chinês por 2.5s (dá tempo pra onda ir e voltar)
        };

        t2 = setTimeout(cycle, 1500);

        return () => { 
            clearTimeout(t1); 
            clearTimeout(t2); 
        };
    }, [hasStarted]);

    useEffect(() => {
        if (!show) return;
        setVisible(true);
        const openT = setTimeout(() => setOpacity(1), 10);
        return () => clearTimeout(openT);
    }, [show]);

    useEffect(() => {
        if (!show || !hasStarted) return;
        let raf = 0;
        const loop = () => {
            const realTimeElapsed = (performance.now() - (startTimeRef.current || performance.now())) / 1000;
            const audio = (window as any).zaeonAudio;
            const audioTime = (isAudioPlaying.current && audio && !audio.ended)
                ? audio.currentTime : realTimeElapsed;
            const time = Math.max(audioTime, realTimeElapsed);

            let currentGlobalPercent = 0;
            if (time >= TIMELINE.STAGE_5_MOD_3_START) {
                if (phaseRef.current < 4) { phaseRef.current = 4; setPhase(4); }
                const elapsed = time - TIMELINE.STAGE_5_MOD_3_START;
                currentGlobalPercent = 75 + Math.min((elapsed / 1.6) * 25, 25);
            } else if (time >= TIMELINE.STAGE_4_MOD_2_START) {
                if (phaseRef.current < 3) { phaseRef.current = 3; setPhase(3); }
                const elapsed = time - TIMELINE.STAGE_4_MOD_2_START;
                currentGlobalPercent = 40 + Math.min((elapsed / 1.8) * 35, 35);
            } else if (time >= TIMELINE.STAGE_3_MOD_1_START) {
                if (phaseRef.current < 2) { phaseRef.current = 2; setPhase(2); }
                const elapsed = time - TIMELINE.STAGE_3_MOD_1_START;
                currentGlobalPercent = Math.min((elapsed / 1.8) * 40, 40);
            } else if (time >= TIMELINE.STAGE_2_BAR_APPEARS) {
                if (phaseRef.current < 1) { phaseRef.current = 1; setPhase(1); }
                currentGlobalPercent = 1;
            }

            if (progressBarRef.current) progressBarRef.current.style.width = `${currentGlobalPercent}%`;

            if (time < TIMELINE.TOTAL_DURATION && !exitingRef.current) {
                raf = requestAnimationFrame(loop);
            } else if (!exitingRef.current) {
                exitingRef.current = true;
                if (progressBarRef.current) progressBarRef.current.style.width = `100%`;

                setTimeout(() => {
                    setOpacity(0);
                    setTimeout(() => {
                        onDoneRef.current?.();
                        setVisible(false);
                    }, 500);
                }, 800);
            }
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [show, hasStarted]);

    const handleInitiate = () => {
        if (hasStarted) return;
        startTimeRef.current = performance.now();
        const audio = (window as any).zaeonAudio;

        if (audio) {
            audio.play().then(() => {
                isAudioPlaying.current = true;
                setHasStarted(true);
                window.dispatchEvent(new CustomEvent("zaeon-music-sync"));
                // Música inicial: toca ~60s no volume CHEIO e só então faz um fade-out LENTO
                // (~10s, curva suave) e pausa. Antes ela fadeava desde o 1º segundo (15s) →
                // parecia curta/cortada. Os timers sobrevivem ao fim do intro de propósito.
                const startVol = typeof audio.volume === "number" ? audio.volume : 0.4;
                const HOLD_MS = 33_000;
                const FADE_MS = 10_000;
                const steps = 60;
                setTimeout(() => {
                    let i = 0;
                    const fade = setInterval(() => {
                        i++;
                        const k = 1 - i / steps;
                        audio.volume = Math.max(0, startVol * k * k); // ease-out, sem degrau
                        if (i >= steps) {
                            clearInterval(fade);
                            try { audio.pause(); } catch { /* ignore */ }
                            isAudioPlaying.current = false;
                        }
                    }, FADE_MS / steps);
                }, HOLD_MS);
            }).catch((err: any) => {
                console.warn("Bloqueio de áudio:", err);
                setHasStarted(true);
            });
        } else {
            setHasStarted(true);
        }
    };

    if (!visible) return null;

    const zhPhrase = phase >= 4 ? "世界之希望已诞生" : phase >= 3 ? "日月星辰皆为吾家" : phase >= 1 ? "万物归一" : "";

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-black transition-opacity duration-500" style={{ opacity }}>
            <div className="flex flex-col items-center justify-center px-6 w-full">
                
                {/* Sem AnimatePresence/exit aqui: ao iniciar, o "Iniciar" some na hora —
                    antes ele "piscava" (o glitch resetava pra PT) durante a saída. */}
                {!hasStarted && (
                    <motion.button
                        key="start-btn"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8 }}
                        onClick={handleInitiate}
                        className="flex flex-col items-center justify-center transition-all duration-300 relative w-full cursor-pointer hover:scale-105"
                    >
                        <span className="text-black dark:text-white tracking-[0.1em] sm:tracking-[0.15em] text-lg sm:text-2xl font-mono min-h-[40px] flex flex-wrap items-center justify-center drop-shadow-md">
                            <GlitchText text={PT_TEXT} targetLang={targetLang} hasStarted={hasStarted} />
                        </span>
                    </motion.button>
                )}

                <div className="h-[90px] flex flex-col items-center justify-start mt-6 w-full">
                    <AnimatePresence mode="wait">
                        {!hasStarted ? (
                            <motion.div 
                                key="start-info"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.8 }}
                                className="flex flex-col items-center w-full"
                            >
                                <div className="text-center text-[11px] tracking-widest text-sky-600 dark:text-sky-400/80 font-light mt-4 uppercase animate-pulse">
                                    para uma melhor experiencia, recomendados que conecte fones de ouvido.
                                </div>

                                {/* Botões mais próximos e bonitos */}
                                {mounted && (
                                    <div className="flex flex-row gap-6 mt-8 justify-center items-center">
                                        <div 
                                            className="flex items-center justify-center w-11 h-11 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 backdrop-blur-xl cursor-pointer transition-all border border-black/10 dark:border-white/10 shadow-sm hover:scale-110 active:scale-95"
                                            onClick={(e) => { e.stopPropagation(); setTheme(theme === "dark" ? "light" : "dark"); }}
                                        >
                                            {theme === 'dark' ? <Sun className="w-[18px] h-[18px] text-white/80" /> : <Moon className="w-[18px] h-[18px] text-black/80" />}
                                        </div>

                                        {/* MODO VOZ — entre tema e idioma. Ativa a voz da Zaeon (conversa) já daqui. */}
                                        <div
                                            title={voiceMode === "active" ? "Modo voz: ATIVO (a Zaeon conversa e fala)" : "Modo voz: passivo — toque para ativar"}
                                            aria-pressed={voiceMode === "active"}
                                            className={`flex items-center justify-center w-11 h-11 rounded-full backdrop-blur-xl cursor-pointer transition-all border shadow-sm hover:scale-110 active:scale-95 ${voiceMode === "active" ? "text-white border-cyan-300/50" : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border-black/10 dark:border-white/10"}`}
                                            style={voiceMode === "active" ? { background: "linear-gradient(135deg,#7c3aed,#06b6d4)" } : undefined}
                                            onClick={(e) => { e.stopPropagation(); setVoiceMode(voiceMode === "active" ? "passive" : "active"); }}
                                        >
                                            <Mic className={`w-[18px] h-[18px] ${voiceMode === "active" ? "text-white" : "text-black/80 dark:text-white/80"}`} />
                                        </div>

                                        {/* Idioma = cores da bandeira (PT → Brasil, EN → EUA), sem texto */}
                                        <div
                                            title={(i18n.language || '').startsWith('en') ? "Idioma: Inglês — clique para Português" : "Idioma: Português — clique para Inglês"}
                                            aria-label="Trocar idioma"
                                            className="w-11 h-11 rounded-full cursor-pointer transition-all border border-black/10 dark:border-white/10 shadow-sm hover:scale-110 active:scale-95 overflow-hidden"
                                            style={{
                                                background: (i18n.language || '').startsWith('en')
                                                    ? "linear-gradient(135deg,#b22234 0%,#b22234 38%,#ffffff 38%,#ffffff 62%,#3c3b6e 62%)"
                                                    : "linear-gradient(135deg,#009b3a 0%,#009b3a 36%,#fedf00 36%,#fedf00 64%,#002776 64%)",
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const currentLang = i18n.language || '';
                                                const newLang = currentLang.startsWith('en') ? 'pt' : 'en';
                                                i18n.changeLanguage(newLang);
                                            }}
                                        />
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="loading-bar"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 1 }}
                                className="flex flex-col items-center w-full mt-4"
                            >
                                <div className={`flex items-center gap-2.5 transition-opacity duration-500 ${phase >= 1 ? 'opacity-100' : 'opacity-0'}`}>
                                    <div className="w-[200px] h-[3px] rounded-full bg-black/20 dark:bg-white/15 overflow-hidden">
                                        <div ref={progressBarRef} className="h-full rounded-full bg-black dark:bg-white shadow-[0_0_8px_rgba(0,0,0,0.35)] dark:shadow-[0_0_8px_rgba(255,255,255,0.35)]" style={{ width: "0%", transition: "none" }} />
                                    </div>
                                    <span aria-hidden="true" className="text-cyan-500 dark:text-cyan-300 text-sm leading-none animate-[spin_4s_linear_infinite] motion-reduce:animate-none" style={{ filter: "drop-shadow(0 0 5px rgba(34,211,238,0.6))" }}>&#10177;</span>
                                </div>

                                {zhPhrase && <div className="mt-6 text-center text-[10px] tracking-widest text-sky-600 dark:text-sky-400/90 font-light">{zhPhrase}</div>}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}