"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
    ajustarQualidade,
    alphaDaFase,
    avancarFaseSemGlobo,
    donoDoFundo,
    fatorLerp,
    passoNormalizado,
    perfilDoAparelho,
    type Relogio,
} from "@/lib/ui/fundoParticulas";

const SNAKE_SPEED = 0.012;
/** Rastro: fração do quadro anterior apagada a cada quadro de 60 FPS (constante → sem salto de brilho). */
const RASTRO = 0.45;

const COLORS = ["#0ea5e9", "#00f0ff", "#0066ff", "#3b82f6", "#22d3ee"];
/** a hélice LONGA (no lugar da antiga "cobra"): cores mais vivas — ciano, violeta e magenta */
const VIVAS = ["#22d3ee", "#a855f7", "#38bdf8", "#e879f9", "#67e8f9"];

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
 * Fundo de partículas: a HÉLICE LONGA (esticada na diagonal, cores vivas — era a "cobra") → o DNA principal (vertical,
 * com espinha das fitas, degraus e nós) → dispersão → … O globo saiu na landing v3. Ver `lib/ui/fundoParticulas.ts` pro porquê de
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
        let dnaShift = 0;   // quanto o DNA já subiu (a grade dos degraus anda junto com as fitas)
        const DEGRAU = 22, FREQ_DNA = 0.0085;
        const raioDna = () => Math.min(210, Math.max(120, width * 0.115));
        let relogio: Relogio = { fase: 2, timer: 0 };
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
            // DNA SIMÉTRICO: as duas fitas com as MESMAS alturas, espaçadas por igual (pares espelhados), e os
            // degraus também uniformes — nada de altura aleatória (era o que deixava a hélice rala e torta).
            const nFita = Math.floor(total * 0.45), nDegrau = total - 2 * nFita;
            const vao = height + 200;
            let k1 = 0, k2 = 0, kd = 0;
            for (let i = 0; i < total; i++) {
                const yPos = 1 - (i / (total - 1)) * 2;
                // 45% fita 1, 45% fita 2, 10% "degraus" (as barras agora também são LINHA, então os pontos vão pras
                // fitas) — por resto, pra valer em qualquer amostra (passo).
                const r = i % 20;
                const strand: 1 | 2 | 0 = r < 9 ? 1 : r < 18 ? 2 : 0;
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    size: Math.random() * 1.5 + 0.5,
                    theta: phiFactor * i,
                    phi: Math.acos(yPos),
                    dnaStrand: strand,
                    dnaY: -100 + (strand === 1 ? k1++ / nFita : strand === 2 ? k2++ / nFita : kd++ / Math.max(1, nDegrau)) * vao,
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
        const desenharLote = (alpha: number, raio: (p: Particle, i: number) => number, paleta: string[] = COLORS) => {
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
                ctx.fillStyle = paleta[c % paleta.length];
                ctx.fill(caminhos[c]);
            }
            ctx.globalAlpha = 1;
        };

        // HÉLICE LONGA: eixo na diagonal (de baixo-esquerda pra cima-direita, passando das bordas), 7 voltas, as
        // partículas escorrem pelo eixo. `u` ∈ [0,1) = onde no eixo; devolve o ponto e o ângulo (pra profundidade).
        const VOLTAS_LONGA = 7;
        const helLonga = (u: number, off: number) => {
            const sx = -0.1 * width, sy = 0.98 * height, ex = 1.1 * width, ey = 0.06 * height;
            const dx = ex - sx, dy = ey - sy, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
            const amp = Math.min(95, Math.max(55, height * 0.085));
            const ang = u * Math.PI * 2 * VOLTAS_LONGA + time * 2.2 + off;
            const c = Math.cos(ang);
            return { x: sx + dx * u + nx * c * amp, y: sy + dy * u + ny * c * amp, ang };
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
            relogio = avancarFaseSemGlobo(relogio, passo);
            if (relogio.fase === 3 || relogio.fase === 4) dnaShift += 0.8 * passo;
            time += SNAKE_SPEED * passo;
            const { fase } = relogio;
            const seguir = fatorLerp(0.08, passo);

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                let tx = p.x, ty = p.y, escala = 1;

                if (fase === 2) {
                    // HÉLICE LONGA (era a "cobra"): mesmas posições uniformes do DNA (pares espelhados), escorrendo
                    const frac = (p.dnaY + 100) / (height + 200);
                    const u = (((frac + time * 0.025) % 1) + 1) % 1;
                    if (p.dnaStrand !== 0) {
                        const h = helLonga(u, p.dnaStrand === 1 ? 0 : Math.PI);
                        tx = h.x; ty = h.y; escala = 0.6 + 0.9 * (0.5 + 0.5 * Math.sin(h.ang));
                    } else {
                        const uD = Math.round(u * 140) / 140, a = helLonga(uD, 0), b = helLonga(uD, Math.PI), t = ((i * 7) % 11) / 10;
                        tx = a.x + (b.x - a.x) * t; ty = a.y + (b.y - a.y) * t; escala = 0.6;
                    }
                } else if (fase === 3 || fase === 4) {
                    p.dnaY -= 0.8 * passo;
                    if (p.dnaY < -100) p.dnaY += height + 200;   // += (não =): o espaçamento uniforme se mantém
                    const rad = raioDna(), cX = width * 0.83;
                    if (p.dnaStrand !== 0) {
                        const off = p.dnaStrand === 1 ? 0 : Math.PI;
                        const ang = p.dnaY * FREQ_DNA + off + time;
                        tx = cX + Math.cos(ang) * rad;
                        ty = p.dnaY;
                        escala = 0.55 + 0.9 * (0.5 + 0.5 * Math.sin(ang));   // frente grande, fundo pequeno
                    } else {
                        // degrau: preso na grade (que anda com as fitas), espalhado de uma fita à outra
                        const yD = Math.round((p.dnaY + dnaShift) / DEGRAU) * DEGRAU - dnaShift;
                        const x1 = cX + Math.cos(yD * FREQ_DNA + time) * rad;
                        const x2 = cX + Math.cos(yD * FREQ_DNA + Math.PI + time) * rad;
                        tx = x1 + (x2 - x1) * (((i * 7) % 11) / 10);
                        ty = yD;
                        escala = 0.6;
                    }
                    // "Aquecido": só o TAMANHO respira, devagar e em onda. Brilho constante (sem estrobo).
                    if (fase === 4) escala *= 0.9 + 0.3 * (0.5 + 0.5 * Math.sin(time * 1.6 + i * 0.05));
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

            // DETALHES (traço em lote, atrás dos pontos; no celular só os pontos, o DNA passa atrás do texto):
            //  • a ESPINHA de cada fita (linha fina contínua), • os DEGRAUS (barras de uma fita à outra) e
            //  • os NÓS: um pontinho mais forte onde o degrau encosta na fita da FRENTE.
            if ((fase === 2 || fase === 3 || fase === 4) && width >= 640) {
                const alpha = alphaDaFase(relogio), esc = escuroRef.current;
                const espinha = new Path2D(), degraus = new Path2D(), nos = new Path2D();
                if (fase === 2) {
                    for (const off of [0, Math.PI]) for (let k = 0; k <= 260; k++) { const h = helLonga(k / 260, off); if (k === 0) espinha.moveTo(h.x, h.y); else espinha.lineTo(h.x, h.y); }
                    const fase0 = ((time * 0.025) % 1) * 140;
                    for (let k = 0; k <= 140; k++) {
                        const u = (k - (fase0 % 1)) / 140; if (u < 0) continue;
                        const a1 = helLonga(u, 0), b1 = helLonga(u, Math.PI);
                        degraus.moveTo(a1.x, a1.y); degraus.lineTo(b1.x, b1.y);
                        const f = Math.sin(a1.ang) > 0 ? a1 : b1; nos.moveTo(f.x + 1.8, f.y); nos.arc(f.x, f.y, 1.8, 0, Math.PI * 2);
                    }
                } else {
                    const rad = raioDna(), cX = width * 0.83;
                    for (const off of [0, Math.PI]) for (let y = -20; y <= height + 20; y += 8) { const x = cX + Math.cos(y * FREQ_DNA + off + time) * rad; if (y === -20) espinha.moveTo(x, y); else espinha.lineTo(x, y); }
                    const y0 = -((dnaShift % DEGRAU) + DEGRAU) % DEGRAU;
                    for (let y = y0; y < height + DEGRAU; y += DEGRAU) {
                        const a1 = y * FREQ_DNA + time, x1 = cX + Math.cos(a1) * rad, x2 = cX + Math.cos(a1 + Math.PI) * rad;
                        degraus.moveTo(x1, y); degraus.lineTo(x2, y);
                        const xf = Math.sin(a1) > 0 ? x1 : x2; nos.moveTo(xf + 2, y); nos.arc(xf, y, 2, 0, Math.PI * 2);
                    }
                }
                const cor = fase === 2 ? "#a855f7" : "#22d3ee";
                ctx.lineWidth = 1;
                ctx.strokeStyle = cor; ctx.globalAlpha = alpha * (esc ? 0.2 : 0.16); ctx.stroke(espinha);
                ctx.strokeStyle = fase === 2 ? "#e879f9" : "#22d3ee"; ctx.globalAlpha = alpha * (esc ? 0.13 : 0.11); ctx.stroke(degraus);
                ctx.fillStyle = fase === 2 ? "#f0abfc" : "#a5f3fc"; ctx.globalAlpha = alpha * (esc ? 0.55 : 0.4); ctx.fill(nos);
                ctx.globalAlpha = 1;
            }
            desenharLote(alphaDaFase(relogio), (p, i) => (p.dnaStrand !== 0 && fase >= 2 && fase <= 4 ? Math.max(p.size, 1.1) : p.size) * escalas[i], fase === 2 ? VIVAS : COLORS);
        };

        // Menos movimento pedido no sistema → fundo PARADO (o DNA estático, sem loop).
        const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
        const drawStatic = () => {
            fundo(1);
            const rad = raioDna(), cX = width * 0.83;
            for (const p of particles) {
                const off = p.dnaStrand === 2 ? Math.PI : 0;
                p.x = cX + Math.cos(p.dnaY * FREQ_DNA + off) * rad; p.y = p.dnaY;
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
