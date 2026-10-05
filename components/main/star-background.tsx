"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
    ajustarQualidade,
    alphaDaFase,
    avancarFase,
    donoDoFundo,
    escalaPerspectiva,
    fatorLerp,
    passoNormalizado,
    perfilDoAparelho,
    type Relogio,
} from "@/lib/ui/fundoParticulas";

const GLOBE_RADIUS_RATIO = 0.32;
const SNAKE_THICKNESS = 45;
const SNAKE_SPEED = 0.012;
/** Rastro: fração do quadro anterior apagada a cada quadro de 60 FPS (constante → sem salto de brilho). */
const RASTRO = 0.45;

const COLORS = ["#0ea5e9", "#00f0ff", "#0066ff", "#3b82f6", "#22d3ee"];

interface Particle {
    x: number;
    y: number;
    size: number;
    theta: number;
    phi: number;
    dnaStrand: 1 | 2 | 0;
    dnaY: number;
    vx: number;
    vy: number;
}

/**
 * Fundo de partículas (globo → serpente → DNA). Ver `lib/ui/fundoParticulas.ts` pro porquê de
 * cada regra: uma instância só desenha, tempo real (não por quadro), qualidade pelo aparelho,
 * sem estrobo e parado pra quem pede menos movimento.
 */
const StarBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const { theme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [dono, setDono] = useState(false);
    const escuroRef = useRef(true);
    const redesenharRef = useRef<() => void>(() => {});

    // Tema lido por ref: trocar o tema NÃO reinicia a animação.
    const temaAtual = theme === "system" ? resolvedTheme : theme;
    useEffect(() => {
        escuroRef.current = temaAtual !== "light";
        redesenharRef.current();
    }, [temaAtual]);

    useEffect(() => {
        setMounted(true);
        const id = Symbol("fundo");
        const sync = () => setDono(donoDoFundo.ehDono(id));
        const parar = donoDoFundo.ouvir(sync);
        donoDoFundo.entrar(id);
        sync();
        return () => { parar(); donoDoFundo.sair(id); };
    }, []);

    useEffect(() => {
        if (!mounted || !dono) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { alpha: false });
        if (!canvas || !ctx) return;

        const perfil = perfilDoAparelho({
            nucleos: navigator.hardwareConcurrency,
            memoriaGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
            largura: window.innerWidth,
        });
        const total = perfil.particulas;
        let ativas = total;

        let width = 0, height = 0;
        let particles: Particle[] = [];
        let animationId = 0;
        let time = 0;
        let relogio: Relogio = { fase: 0, timer: 0 };
        let ultimo = 0;
        let mediaPasso = 1, amostras = 0;
        const escalas = new Float32Array(total);

        const applyDPR = () => {
            const dpr = Math.max(1, Math.min(perfil.dprMax, window.devicePixelRatio || 1));
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        const initParticles = () => {
            particles = [];
            const phiFactor = Math.PI * (3 - Math.sqrt(5));
            for (let i = 0; i < total; i++) {
                const yPos = 1 - (i / (total - 1)) * 2;
                // 40% fita 1, 40% fita 2, 20% "degraus" — por resto, pra valer em qualquer amostra (passo).
                const r = i % 5;
                const strand: 1 | 2 | 0 = r < 2 ? 1 : r < 4 ? 2 : 0;
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    size: Math.random() * 1.5 + 0.5,
                    theta: phiFactor * i,
                    phi: Math.acos(yPos),
                    dnaStrand: strand,
                    dnaY: Math.random() * 2000,
                    vx: (Math.random() - 0.5) * 12,
                    vy: (Math.random() - 0.5) * 12,
                });
            }
        };

        const fundo = (opacidade: number) => {
            ctx.globalAlpha = 1;
            ctx.fillStyle = escuroRef.current
                ? `rgba(1, 8, 22, ${opacidade})`
                : `rgba(255, 255, 255, ${opacidade})`;
            ctx.fillRect(0, 0, width, height);
        };

        // Desenho em LOTE: um path por cor (5 fills por quadro em vez de ~1000+).
        const caminhos = COLORS.map(() => new Path2D());
        const desenharLote = (alpha: number, raio: (p: Particle, i: number) => number) => {
            for (let c = 0; c < COLORS.length; c++) caminhos[c] = new Path2D();
            const passo = Math.max(1, Math.round(total / ativas));
            for (let i = 0; i < particles.length; i += passo) {
                const p = particles[i];
                const r = raio(p, i);
                const path = caminhos[i % COLORS.length];
                path.moveTo(p.x + r, p.y);
                path.arc(p.x, p.y, r, 0, Math.PI * 2);
            }
            ctx.globalAlpha = escuroRef.current ? alpha * 0.72 : alpha * 0.5;
            for (let c = 0; c < COLORS.length; c++) {
                ctx.fillStyle = COLORS[c];
                ctx.fill(caminhos[c]);
            }
            ctx.globalAlpha = 1;
        };

        const posicaoGlobo = (p: Particle, rotacao: number) => {
            const globeRadius = Math.min(width, height) * GLOBE_RADIUS_RATIO;
            const sx = globeRadius * Math.sin(p.phi) * Math.cos(p.theta + rotacao);
            const sy = globeRadius * Math.cos(p.phi);
            const sz = globeRadius * Math.sin(p.phi) * Math.sin(p.theta + rotacao);
            return { x: width * 0.82 + sx, y: height * 0.45 + sy, escala: escalaPerspectiva(sz, globeRadius) };
        };

        const draw = (agora: number) => {
            animationId = requestAnimationFrame(draw);
            const dtMs = ultimo ? agora - ultimo : 0;
            // Teto de FPS no aparelho fraco: pula o quadro se ainda não deu o intervalo.
            if (ultimo && dtMs < perfil.intervaloMinMs - 1) return;
            ultimo = agora;
            const passo = passoNormalizado(dtMs);
            if (passo === 0) return;

            // Mede o FPS real e corta partículas se o aparelho não estiver dando conta.
            mediaPasso = mediaPasso * 0.95 + passo * 0.05;
            if (++amostras % 120 === 0) ativas = ajustarQualidade(ativas, mediaPasso);

            fundo(fatorLerp(RASTRO, passo));
            relogio = avancarFase(relogio, passo);
            time += SNAKE_SPEED * passo;
            const { fase } = relogio;
            const seguir = fatorLerp(0.08, passo);

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                let tx = p.x, ty = p.y, escala = 1;

                if (fase === 0) {
                    const g = posicaoGlobo(p, time * 1.2);
                    tx = g.x; ty = g.y; escala = g.escala;
                } else if (fase === 2) {
                    const t = time * 2.2 - i * 0.004;
                    const sx = Math.cos(t * 0.6) * (width * 0.38) + Math.sin(t * 1.1) * (width * 0.15);
                    const sy = Math.sin(t * 0.4) * (height * 0.35) + Math.cos(t * 1.8) * (height * 0.12);
                    tx = width * 0.5 + sx + Math.cos(i * 0.4) * SNAKE_THICKNESS;
                    ty = height * 0.5 + sy + Math.sin(i * 0.4) * SNAKE_THICKNESS;
                } else if (fase === 3 || fase === 4) {
                    p.dnaY -= 0.8 * passo;
                    if (p.dnaY < -100) p.dnaY = height + 100;
                    const freq = 0.005;
                    const rad = 180;
                    const cX = width * 0.83;
                    if (p.dnaStrand !== 0) {
                        const off = p.dnaStrand === 1 ? 0 : Math.PI;
                        tx = cX + Math.cos(p.dnaY * freq + off + time) * rad;
                    } else {
                        const x1 = cX + Math.cos(p.dnaY * freq + time) * rad;
                        const x2 = cX + Math.cos(p.dnaY * freq + Math.PI + time) * rad;
                        tx = x1 + (x2 - x1) * ((i % 10) / 10);
                    }
                    ty = p.dnaY;
                    // "Aquecido": só o TAMANHO respira, devagar e em onda. Brilho constante (sem estrobo).
                    if (fase === 4) escala = 0.9 + 0.3 * (0.5 + 0.5 * Math.sin(time * 1.6 + i * 0.05));
                }

                if (fase === 1 || fase === 5) {
                    p.x += p.vx * passo;
                    p.y += p.vy * passo;
                } else {
                    p.x += (tx - p.x) * seguir;
                    p.y += (ty - p.y) * seguir;
                }
                escalas[i] = escala;
            }

            desenharLote(alphaDaFase(relogio), (p, i) => p.size * escalas[i]);
        };

        // Menos movimento pedido no sistema → fundo PARADO (globo estático, sem loop).
        const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
        const drawStatic = () => {
            fundo(1);
            for (const p of particles) {
                const g = posicaoGlobo(p, 0);
                p.x = g.x; p.y = g.y;
            }
            desenharLote(0.6, (p) => p.size);
        };
        const iniciar = () => {
            cancelAnimationFrame(animationId);
            ultimo = 0;
            if (mq?.matches) drawStatic();
            else animationId = requestAnimationFrame(draw);
        };
        redesenharRef.current = () => { if (mq?.matches) drawStatic(); };

        applyDPR();
        initParticles();
        iniciar();

        // Resize só reajusta o canvas (não reinicia as partículas) e ignora mudança só de altura
        // (barra de URL do celular), com debounce pra não refazer o buffer a cada pixel arrastado.
        let lastW = window.innerWidth;
        let espera = 0;
        const onResize = () => {
            window.clearTimeout(espera);
            espera = window.setTimeout(() => {
                const w = window.innerWidth;
                if (w === lastW) return;
                lastW = w;
                applyDPR();
                if (mq?.matches) drawStatic();
            }, 150);
        };
        window.addEventListener("resize", onResize);
        mq?.addEventListener?.("change", iniciar);
        return () => {
            cancelAnimationFrame(animationId);
            window.clearTimeout(espera);
            window.removeEventListener("resize", onResize);
            mq?.removeEventListener?.("change", iniciar);
            redesenharRef.current = () => {};
        };
    }, [mounted, dono]);

    if (!mounted) return <div className="fixed inset-0 z-0 bg-white dark:bg-[#010816]" />;
    if (!dono) return null;
    return <div className="fixed inset-0 z-0 pointer-events-none"><canvas ref={canvasRef} className="w-full h-full" /></div>;
};

export default StarBackground;
