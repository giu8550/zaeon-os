"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

const PARTICLE_COUNT = 1000; // mais leve (era 1400) — fundo menos pesado
const GLOBE_RADIUS_RATIO = 0.32;
const SNAKE_THICKNESS = 45;
const SNAKE_SPEED = 0.012;

const COLORS = ["#0ea5e9", "#00f0ff", "#0066ff", "#3b82f6", "#22d3ee"];

interface Particle {
    x: number;
    y: number;
    size: number;
    color: string;
    theta: number;
    phi: number;
    angle: number;
    distance: number;
    dnaStrand: 1 | 2 | 0;
    dnaY: number;
    vx: number;
    vy: number;
}

const StarBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const { theme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!mounted) return;

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d", { alpha: false })!;
        let width = 0, height = 0;

        let particles: Particle[] = [];
        let animationId: number;
        let time = 0;

        // Fases: 0: Globo, 1: Desintegração, 2: Serpente, 3: DNA Normal, 4: DNA Overheat, 5: Desintegração
        let phase = 0;
        let phaseTimer = 0;

        const currentTheme = theme === 'system' ? resolvedTheme : theme;
        const isDark = currentTheme === 'dark';

        const applyDPR = () => {
            const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const initParticles = () => {
            particles = [];
            const phiFactor = Math.PI * (3 - Math.sqrt(5));
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const y_pos = 1 - (i / (PARTICLE_COUNT - 1)) * 2;
                let strand: 1 | 2 | 0 = 0;
                if (i < PARTICLE_COUNT * 0.4) strand = 1;
                else if (i < PARTICLE_COUNT * 0.8) strand = 2;

                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    size: Math.random() * 1.5 + 0.5,
                    color: COLORS[i % COLORS.length],
                    theta: phiFactor * i,
                    phi: Math.acos(y_pos),
                    angle: (i / PARTICLE_COUNT) * Math.PI * 25,
                    distance: Math.sqrt(i / PARTICLE_COUNT),
                    dnaStrand: strand,
                    dnaY: Math.random() * 2000,
                    vx: (Math.random() - 0.5) * 20,
                    vy: (Math.random() - 0.5) * 20,
                });
            }
        };

        const draw = () => {
            const clearOpacity = (phase === 4 || phase === 5 || phase === 1) ? 0.6 : 0.4;
            ctx.fillStyle = isDark
                ? `rgba(1, 8, 22, ${clearOpacity})`
                : `rgba(255, 255, 255, ${clearOpacity})`;

            ctx.fillRect(0, 0, width, height);
            phaseTimer++;

            // Controle das Derações
            if (phase === 0 && phaseTimer > 800) { phase = 1; phaseTimer = 0; }        // Globo
            else if (phase === 1 && phaseTimer > 60) { phase = 2; phaseTimer = 0; }        // Desintegração
            else if (phase === 2 && phaseTimer > 900) { phase = 3; phaseTimer = 0; }       // Serpente
            else if (phase === 3 && phaseTimer > 1800) { phase = 4; phaseTimer = 0; }      // DNA (Longo)
            else if (phase === 4 && phaseTimer > 600) { phase = 5; phaseTimer = 0; }       // DNA Overheat (Normal)
            else if (phase === 5 && phaseTimer > 100) { phase = 0; phaseTimer = 0; }       // Desintegração final

            time += SNAKE_SPEED;

            const centerX = width * 0.82;
            const centerY = height * 0.45;
            const globeRadius = Math.min(width, height) * GLOBE_RADIUS_RATIO;

            particles.forEach((p, i) => {
                let targetX = p.x;
                let targetY = p.y;
                let scale = 1;
                let alpha = 0.8;
                let followTarget = true;

                // GLOBO (0)
                if (phase === 0) {
                    const rotation = time * 1.2;
                    const sx = globeRadius * Math.sin(p.phi) * Math.cos(p.theta + rotation);
                    const sy = globeRadius * Math.cos(p.phi);
                    const sz = globeRadius * Math.sin(p.phi) * Math.sin(p.theta + rotation);
                    targetX = centerX + sx;
                    targetY = centerY + sy;
                    scale = Math.max(0.2, 300 / (300 - sz));
                }
                // SERPENTE (2)
                else if (phase === 2) {
                    const t = time * 2.2 - (i * 0.004);
                    const sx = Math.cos(t * 0.6) * (width * 0.38) + Math.sin(t * 1.1) * (width * 0.15);
                    const sy = Math.sin(t * 0.4) * (height * 0.35) + Math.cos(t * 1.8) * (height * 0.12);
                    targetX = (width * 0.5) + sx + Math.cos(i * 0.4) * SNAKE_THICKNESS;
                    targetY = (height * 0.5) + sy + Math.sin(i * 0.4) * SNAKE_THICKNESS;
                }
                // DNA (3 e 4)
                else if (phase === 3 || phase === 4) {
                    p.dnaY -= 0.8;
                    if (p.dnaY < -100) p.dnaY = height + 100;
                    const freq = 0.005;
                    const angle = (p.dnaY * freq) + (p.dnaStrand === 1 ? 0 : p.dnaStrand === 2 ? Math.PI : Math.PI / 2);
                    const rad = 180;
                    const cX = width * 0.83;

                    if (p.dnaStrand !== 0) {
                        targetX = cX + Math.cos(angle + time) * rad;
                        targetY = p.dnaY;
                    } else {
                        const x1 = cX + Math.cos((p.dnaY * freq) + time) * rad;
                        const x2 = cX + Math.cos((p.dnaY * freq) + Math.PI + time) * rad;
                        targetX = x1 + (x2 - x1) * ((i % 10) / 10);
                        targetY = p.dnaY;
                    }

                    if (phase === 4) { // Overheat apenas no DNA
                        const isFlash = Math.sin(time * 40 + i) > 0;
                        scale = isFlash ? 3 : 0.4;
                        alpha = isFlash ? 1 : 0.2;
                    }
                }
                // DESINTEGRAÇÃO (1 e 5)
                else if (phase === 1 || phase === 5) {
                    followTarget = false;
                    p.x += p.vx;
                    p.y += p.vy;
                    alpha = Math.max(0, 1 - phaseTimer / 100);
                }

                if (followTarget) {
                    const speed = 0.08;
                    p.x += (targetX - p.x) * speed;
                    p.y += (targetY - p.y) * speed;
                }

                ctx.fillStyle = p.color;
                ctx.globalAlpha = isDark ? alpha * 0.72 : alpha * 0.5; // fundo mais leve

                // Brilho do Overheat (Fase 4 apenas) — blur do DNA mais leve (era 6)
                if (phase === 4 && i % 4 === 0) {
                    ctx.shadowBlur = 4;
                    ctx.shadowColor = p.color;
                } else {
                    ctx.shadowBlur = 0;
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * scale, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            });

            animationId = requestAnimationFrame(draw);
        };

        applyDPR();
        initParticles();
        draw();

        // No resize, só REAJUSTA o canvas (DPR/medidas) — NÃO reinicializa as partículas.
        // Assim a animação não recomeça ao redimensionar no desktop nem ao focar/abrir o
        // teclado no mobile (que dispara 'resize'). Ela só inicia de novo se a página carregar.
        // Ignora resizes só de altura (barra de URL do mobile) pra não "piscar" o canvas.
        let lastW = window.innerWidth;
        const onResize = () => {
            const w = window.innerWidth;
            if (w === lastW) return; // mudou só a altura (URL bar mobile) → ignora
            lastW = w;
            applyDPR();
        };
        window.addEventListener("resize", onResize);
        return () => { cancelAnimationFrame(animationId); window.removeEventListener("resize", onResize); };
    }, [theme, resolvedTheme, mounted]);

    if (!mounted) return <div className="fixed inset-0 z-0 bg-[#010816]" />;
    return <div className="fixed inset-0 z-0 pointer-events-none transition-colors duration-500"><canvas ref={canvasRef} className="w-full h-full" /></div>;
};

export default StarBackground;