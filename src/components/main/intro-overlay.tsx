"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import SponsorsMarquee from "@/components/main/SponsorsMarquee";
import LiquidGlassButton from "@/components/ui/LiquidGlassButton";
import { musica } from "@/lib/audio/musica";

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



export default function MacSplash({ show = true, onDone }: Props) {
    const router = useRouter();
    const { i18n } = useTranslation();
    const [mounted, setMounted] = useState(false);

    const [hasStarted, setHasStarted] = useState(false);
    const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);
    const [visible, setVisible] = useState(show);
    const [opacity, setOpacity] = useState(0);


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

            // Os estagios continuam marcando o tempo do intro...
            if (time >= TIMELINE.STAGE_5_MOD_3_START) {
                if (phaseRef.current < 4) { phaseRef.current = 4; setPhase(4); }
            } else if (time >= TIMELINE.STAGE_4_MOD_2_START) {
                if (phaseRef.current < 3) { phaseRef.current = 3; setPhase(3); }
            } else if (time >= TIMELINE.STAGE_3_MOD_1_START) {
                if (phaseRef.current < 2) { phaseRef.current = 2; setPhase(2); }
            } else if (time >= TIMELINE.STAGE_2_BAR_APPEARS) {
                if (phaseRef.current < 1) { phaseRef.current = 1; setPhase(1); }
            }

            // ...mas a BARRA e uma funcao continua do tempo, nao uma escada por
            // estagio. Antes cada estagio tinha a sua propria rampa com o proprio
            // teto, entao a barra ficava PRESA em 1% durante todo o estagio 2,
            // RECUAVA para 0 ao entrar no estagio 3, e so ali comecava a andar --
            // e voltava a congelar sempre que uma rampa batia no teto antes do
            // estagio seguinte comecar. Era exatamente isso que fazia ela "nao
            // parecer como deveria, so no comeco".
            //
            // Uma unica interpolacao do instante em que ela aparece ate o fim do
            // intro e monotonica por construcao: nao ha degrau, nao ha recuo, e o
            // que ela mostra passa a ser verdade (quanto falta de fato).
            const inicioBarra = TIMELINE.STAGE_2_BAR_APPEARS;
            const bruto = (time - inicioBarra) / (TIMELINE.TOTAL_DURATION - inicioBarra);
            const currentGlobalPercent = Math.max(0, Math.min(1, bruto)) * 100;

            if (progressBarRef.current) progressBarRef.current.style.width = `${currentGlobalPercent}%`;

            if (time < TIMELINE.TOTAL_DURATION && !exitingRef.current) {
                raf = requestAnimationFrame(loop);
            } else if (!exitingRef.current) {
                exitingRef.current = true;

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
        // O "Iniciar" é o gesto que libera áudio no navegador: o DONO ÚNICO da música (lib/audio/musica) toca a faixa
        // em loop durante a intro, segura ~33 s no volume cheio e então faz um fade-out LENTO (10 s) — nada de corte.
        const m = musica();
        m.destravar();
        void m.tocar(TIMELINE.AUDIO_SRC, { loop: true }).then((ok) => {
            isAudioPlaying.current = ok;
            setHasStarted(true);
            if (!ok) return;
            const HOLD_MS = 33_000, FADE_MS = 10_000;
            setTimeout(() => {
                // só fecha a faixa da INTRO (se a pessoa trocou de faixa no miniplayer, não mexe)
                if (m.estado === "tocando" && m.elemento().src.endsWith(TIMELINE.AUDIO_SRC)) void m.parar(FADE_MS).then(() => { isAudioPlaying.current = false; });
            }, HOLD_MS);
        });
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black text-white transition-opacity duration-500" style={{ opacity }}>
            {/* FUNDO — loop costurado dos dois vídeos (último frame = primeiro, então
                não pisca ao repetir). Escurecido, desfocado e com vinheta ASSADOS no
                arquivo: o navegador só decodifica no hardware, não roda filtro por
                frame. Custa 404 KB; a versão sem tratamento custava 4,1 MB.
                muted + playsInline não são opcionais — sem os dois o iOS recusa o
                autoplay. A faixa já vem sem áudio do arquivo original. */}
            <div className="absolute inset-0 overflow-hidden bg-black" aria-hidden="true">
                {/* Vídeo E poster REMOVIDOS. O poster era um frame exportado do vídeo
                    antigo — sem o vídeo, ele ficava como "papel de parede" e parecia que
                    o vídeo continuava ali. Agora é fundo preto com um brilho navy sutil
                    no centro (tom da marca), sem imagem nenhuma. */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(30,58,95,0.35)_0%,rgba(0,0,0,0)_60%)]" />
                {/* Véu: garante contraste do "Iniciar". */}
                <div className="absolute inset-0 bg-black/45" />
                {/* Vinheta: as bordas morrem no preto em vez de terminarem num corte. */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.78)_100%)]" />
            </div>
            {/* Sponsors rolando na borda inferior da tela inicial */}
            <SponsorsMarquee />
            <div className="flex flex-col items-center justify-center px-6 w-full">
                
                {/* Sem AnimatePresence/exit aqui: ao iniciar, o "Iniciar" some na hora —
                    antes ele "piscava" (o glitch resetava pra PT) durante a saída. */}
                {!hasStarted && (
                    <motion.div
                        key="start-btn"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                    >
                        {/* O rótulo aqui é texto puro. Vidro líquido e caractere
                            piscando são duas estéticas que competem no mesmo elemento,
                            e o glitch PT/ZH que existia aqui saiu junto com os
                            caracteres chineses do intro. */}
                        <LiquidGlassButton superficie="escura" onClick={handleInitiate}>
                            {PT_TEXT}
                        </LiquidGlassButton>
                    </motion.div>
                )}

                <div className="h-[64px] flex flex-col items-center justify-start mt-8 w-full">
                    <AnimatePresence>
                        {!hasStarted ? (
                            <motion.div 
                                key="start-info"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.8 }}
                                className="flex flex-col items-center w-full"
                            >

                                
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
                                        <div ref={progressBarRef} className="h-full rounded-full bg-black dark:bg-white shadow-[0_0_8px_rgba(0,0,0,0.35)] dark:shadow-[0_0_8px_rgba(255,255,255,0.35)]" style={{ width: "0%", transition: "width 0.12s linear" }} />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
            <style jsx global>{`
                /* barra agora é controlada por JS (largura = relógio do intro) */
            `}</style>
        </div>
    );
}