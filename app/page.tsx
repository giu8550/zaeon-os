"use client";

import { useState, useEffect, useLayoutEffect, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";

import HeroPage, { type HeroVariant } from "@/components/sub/hero-content";
import Encryption from "@/components/main/encryption";
import StudyRoomsPage from "@/app/study-rooms/page";
import IntroOverlay from "@/src/components/main/intro-overlay";
import { Footer } from "@/components/main/footer";

const ParticleSystem = dynamic(
    () => import("@/components/main/ParticleSystem"),
    { ssr: false }
);

export default function Home() {
    const { i18n } = useTranslation();
    const [showIntro, setShowIntro] = useState(true);
    const [startContent, setStartContent] = useState(false);
    
    // NOVO: Estado para blindar contra o Hydration Error
    const [mounted, setMounted] = useState(false);

    // Duas versoes do H1 vivendo juntas so pra decidir olhando. O default e a
    // variante atual ("Todas as IAs"); ?hero=sozinho mostra a outra. Leitura do
    // window depois do mount, que ja e onde este componente se protege de
    // hydration error -- sem Suspense, sem useSearchParams.
    const [heroVariant, setHeroVariant] = useState<HeroVariant>("ias");

    useEffect(() => {
        const v = new URLSearchParams(window.location.search).get("hero");
        if (v === "sozinho" || v === "b") setHeroVariant("sozinho");
    }, []);

    const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

    useEffect(() => {
        setMounted(true); // Confirma que estamos no cliente (Navegador)
    }, []);

    useEffect(() => {
        if (showIntro) {
            document.body.style.overflow = "hidden";
            window.scrollTo(0, 0);
        } else {
            const t = setTimeout(() => { document.body.style.overflow = ""; }, 100);
            return () => clearTimeout(t);
        }
    }, [showIntro]);

    useIsomorphicLayoutEffect(() => {
        window.history.scrollRestoration = "manual";
    }, []);

    const handleIntroComplete = () => {
        setShowIntro(false);
        setTimeout(() => {
            setStartContent(true);
        }, 400);
    };

    return (
        <main className="h-full w-full relative">
            <AnimatePresence mode="wait">
                {showIntro && (
                    <IntroOverlay key="intro-overlay" onDone={handleIntroComplete} />
                )}
            </AnimatePresence>

            {/* O conteúdo escondido SÓ renderiza após o mount. Isso elimina 100% o Hydration Error */}
            {mounted && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: startContent ? 1 : 0 }}
                    transition={{ duration: 1.5 }}
                    className="relative flex flex-col h-full z-10"
                    style={{ pointerEvents: startContent ? "auto" : "none" }}
                >
                    <ParticleSystem />

                    {/* Navbar removida daqui, pois agora ela mora e persiste no layout.tsx */}

                    {/* CORREÇÃO DE LAYOUT: O pt-[110px] empurra a página pra baixo da Navbar */}
                    <div className="flex flex-col gap-20 pt-[110px] w-full">
                        <HeroPage variant={heroVariant} />
                        <Encryption />
                        <div id="study-rooms" className="w-full">
                            <Suspense fallback={null}>
                                <StudyRoomsPage />
                            </Suspense>
                        </div>
                    </div>

                    <Footer />

                    {/* Chave de comparacao dos dois H1. So existe em dev: em
                        producao este bloco nao e renderizado. */}
                    {process.env.NODE_ENV === "development" && (
                        <a
                            href={heroVariant === "ias" ? "?hero=sozinho" : "?hero=ias"}
                            className="fixed bottom-4 right-4 z-[200] rounded-full border border-cyan-500/40 bg-background/80 px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-cyan-600 dark:text-cyan-400 backdrop-blur-md shadow-lg"
                        >
                            hero: {heroVariant} · trocar
                        </a>
                    )}
                </motion.div>
            )}
        </main>
    );
}