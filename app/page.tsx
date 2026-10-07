"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";

import HeroPage from "@/components/sub/hero-content";
import Encryption from "@/components/main/encryption";
import Faq from "@/components/main/Faq";
import CyberespacoExplica from "@/components/main/CyberespacoExplica";
import IntroOverlay from "@/src/components/main/intro-overlay";
import { Footer } from "@/components/main/footer";

export default function Home() {
    const { i18n } = useTranslation();
    const [showIntro, setShowIntro] = useState(true);
    const [startContent, setStartContent] = useState(false);
    
    // NOVO: Estado para blindar contra o Hydration Error
    const [mounted, setMounted] = useState(false);

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

    // NAVBAR → SEÇÃO: chegando com âncora (/#como-funciona, /#mentores, /#cyberespaco) pula a intro e rola até a
    // seção assim que ela existir (as seções montam com atraso). Vale também pra trocar de âncora já na página.
    useEffect(() => {
        const irPraAncora = () => {
            const id = decodeURIComponent(window.location.hash.slice(1));
            if (!id) return;
            setShowIntro(false); setStartContent(true);
            const ate = Date.now() + 4000;
            const tentar = () => {
                const el = document.getElementById(id);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                else if (Date.now() < ate) setTimeout(tentar, 120);
            };
            setTimeout(tentar, 150);
        };
        irPraAncora();
        window.addEventListener("hashchange", irPraAncora);
        return () => window.removeEventListener("hashchange", irPraAncora);
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
                    {/* Fundo de partículas: UM só, o do hero (StarBackground). O antigo ParticleSystem
                        era uma cópia da mesma animação rodando por baixo — dois/três canvases
                        defasados piscavam juntos e pesavam em máquina fraca. */}

                    {/* Navbar removida daqui, pois agora ela mora e persiste no layout.tsx */}

                    {/* CORREÇÃO DE LAYOUT: O pt-[110px] empurra a página pra baixo da Navbar */}
                    <div className="flex flex-col pt-[110px] w-full">
                        <HeroPage />
                        <Encryption />
                        {/* No lugar da antiga "Crie a sua própria estação de trabalho": o que é e como funciona o
                            CYBERESPAÇO (com a vista ao vivo + Conectar) — destino do "Ir pro cyberespaço" do hero. */}
                        <div id="study-rooms" className="w-full">
                            <CyberespacoExplica />
                        </div>
                        <Faq />
                    </div>

                    <Footer />

                </motion.div>
            )}
        </main>
    );
}