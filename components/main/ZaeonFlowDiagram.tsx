"use client";

import React, { useCallback, useEffect, useState } from "react";

/**
 * Diagrama vivo: o que a pessoa traz -> a Zaeon -> o que ela leva.
 *
 * As duas listas do Martinez pareiam NA ORDEM, e isso muda o que o desenho
 * significa: não são quatro entradas e quatro saídas soltas, são QUATRO
 * TRANSFORMAÇÕES. "medo -> confiança" é a mais forte das quatro e é o motivo
 * de a interação existir — passar o dedo numa linha mostra no que ela vira.
 *
 * Tudo é SVG com viewBox, incluindo o texto. A alternativa (cards em DOM e
 * linhas por cima) exige sincronizar coordenadas a cada resize e sempre erra
 * por um ou dois pixels; aqui as linhas nascem coladas nos cards por
 * construção, em qualquer largura e em qualquer densidade de tela.
 *
 * Dois viewBox: horizontal no desktop, vertical no celular. Não é o mesmo
 * desenho encolhido — um leque de 4 linhas que funciona em 1000px de largura
 * vira um emaranhado ilegível em 360px.
 */

type Par = {
    entra: string;
    sai: string;
    tom: string;
    /** Cada fluxo tem ritmo próprio: o conjunto respira em vez de marchar. */
    duracao: number;
    atraso: number;
};

const PARES: Par[] = [
    { entra: "ideia", sai: "projeto", tom: "#22d3ee", duracao: 3.2, atraso: 0 },
    { entra: "estudo", sai: "artigo", tom: "#38bdf8", duracao: 3.9, atraso: 0.45 },
    { entra: "dúvida", sai: "TCC", tom: "#818cf8", duracao: 3.5, atraso: 0.9 },
    { entra: "medo", sai: "confiança", tom: "#2dd4bf", duracao: 4.3, atraso: 1.35 },
];

const BRAIN = "/assets/zaeon-brain-logo.png";

export default function ZaeonFlowDiagram({ className = "" }: { className?: string }) {
    const [ativo, setAtivo] = useState<number | null>(null);
    const [fixado, setFixado] = useState<number | null>(null);
    const [semMovimento, setSemMovimento] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sync = () => setSemMovimento(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);

    // Ciclo automático: no celular não existe hover, e um diagrama "interativo"
    // que só reage ao mouse fica morto justamente onde a maioria chega. Para
    // quando alguém assume o controle (hover ou toque).
    useEffect(() => {
        if (semMovimento || fixado !== null || ativo !== null) return;
        let i = 0;
        const id = setInterval(() => {
            i = (i + 1) % PARES.length;
            setAtivo(null);
            setTimeout(() => setAtivo(i), 30);
        }, 2600);
        return () => clearInterval(id);
    }, [semMovimento, fixado, ativo]);

    const destaque = fixado ?? ativo;
    const marcar = useCallback((i: number | null) => setAtivo(i), []);

    /** Opacidade de quem não é o par em foco. */
    const esmaecer = (i: number) => (destaque === null || destaque === i ? 1 : 0.28);
    const forte = (i: number) => destaque === i;

    return (
        <div className={`w-full ${className}`}>
            <style>{`
                @keyframes zaeon-particula { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
                @keyframes zaeon-cerebro   { 0%,100% { transform: scale(1); } 50% { transform: scale(1.045); } }
                @keyframes zaeon-halo      { 0% { r: 62; opacity:.55 } 70% { r: 86; opacity:0 } 100% { r: 86; opacity:0 } }
                .zaeon-particula { animation-name: zaeon-particula; animation-timing-function: linear; animation-iteration-count: infinite; }
                @media (prefers-reduced-motion: reduce) {
                    .zaeon-particula { animation: none !important; stroke-dashoffset: 50 !important; }
                }
            `}</style>

            {/* ───────────────────────── DESKTOP ───────────────────────── */}
            <svg
                viewBox="0 0 1000 440"
                className="hidden md:block w-full h-auto"
                role="img"
                aria-label="Você chega com ideia, estudo, dúvida e medo; a Zaeon devolve projeto, artigo, TCC e confiança."
            >
                <defs>
                    <filter id="zf-glow" x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="5" result="b" />
                        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>

                <CardMoldura x={30} y={70} w={250} h={300} />
                <Rotulo x={54} y={104}>você chega com</Rotulo>

                <CardMoldura x={720} y={70} w={250} h={300} />
                <Rotulo x={744} y={104}>e sai com</Rotulo>

                {/* FLUXOS — desenhados antes dos cards de texto para passarem por baixo */}
                {PARES.map((p, i) => {
                    const y = 165 + i * 50;
                    const entrada = `M280,${y} C346,${y} 372,220 425,220`;
                    const saida = `M575,220 C628,220 654,${y} 720,${y}`;
                    return (
                        <g key={p.entra} opacity={esmaecer(i)} style={{ transition: "opacity .45s ease" }}>
                            <Fluxo d={entrada} par={p} forte={forte(i)} />
                            <Fluxo d={saida} par={p} forte={forte(i)} saida />
                        </g>
                    );
                })}

                {/* ITENS */}
                {PARES.map((p, i) => {
                    const y = 165 + i * 50;
                    return (
                        <g
                            key={`itens-${p.entra}`}
                            opacity={esmaecer(i)}
                            style={{ transition: "opacity .45s ease", cursor: "pointer" }}
                            onMouseEnter={() => marcar(i)}
                            onMouseLeave={() => marcar(null)}
                            onClick={() => setFixado(fixado === i ? null : i)}
                        >
                            {/* alvo de toque generoso, invisível */}
                            <rect x={36} y={y - 22} width={238} height={44} fill="transparent" />
                            <rect x={726} y={y - 22} width={238} height={44} fill="transparent" />
                            <circle cx={58} cy={y - 5} r={4} fill={p.tom} />
                            <Texto x={76} y={y} forte={forte(i)}>{p.entra}</Texto>
                            <Texto x={744} y={y} forte={forte(i)}>{p.sai}</Texto>
                            <circle cx={946} cy={y - 5} r={4} fill={p.tom} opacity={forte(i) ? 1 : 0.55} />
                        </g>
                    );
                })}

                <Cerebro cx={500} cy={220} destaque={destaque !== null} semMovimento={semMovimento} />
            </svg>

            {/* ───────────────────────── CELULAR ───────────────────────── */}
            <svg
                viewBox="0 0 360 780"
                className="block md:hidden w-full h-auto"
                role="img"
                aria-hidden="true"
            >
                <CardMoldura x={20} y={20} w={320} h={210} />
                <Rotulo x={42} y={54}>você chega com</Rotulo>

                <CardMoldura x={20} y={550} w={320} h={210} />
                <Rotulo x={42} y={584}>e sai com</Rotulo>

                {PARES.map((p, i) => {
                    const x = 141 + i * 26;
                    const descida = `M${x},230 C${x},268 180,270 180,300`;
                    const subida = `M180,460 C180,492 ${x},494 ${x},550`;
                    return (
                        <g key={`m-${p.entra}`} opacity={esmaecer(i)} style={{ transition: "opacity .45s ease" }}>
                            <Fluxo d={descida} par={p} forte={forte(i)} />
                            <Fluxo d={subida} par={p} forte={forte(i)} saida />
                        </g>
                    );
                })}

                {PARES.map((p, i) => {
                    const y = 106 + i * 34;
                    return (
                        <g
                            key={`mi-${p.entra}`}
                            opacity={esmaecer(i)}
                            style={{ transition: "opacity .45s ease", cursor: "pointer" }}
                            onClick={() => setFixado(fixado === i ? null : i)}
                        >
                            <rect x={26} y={y - 18} width={308} height={36} fill="transparent" />
                            <rect x={26} y={y + 426} width={308} height={36} fill="transparent" />
                            <circle cx={48} cy={y - 5} r={4} fill={p.tom} />
                            <Texto x={66} y={y} forte={forte(i)}>{p.entra}</Texto>
                            <circle cx={48} cy={y + 443} r={4} fill={p.tom} />
                            <Texto x={66} y={y + 448} forte={forte(i)}>{p.sai}</Texto>
                        </g>
                    );
                })}

                <Cerebro cx={180} cy={380} destaque={destaque !== null} semMovimento={semMovimento} r={80} />
            </svg>

            <p className="mt-5 text-center text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-500">
                {destaque === null
                    ? "toque numa palavra"
                    : `${PARES[destaque].entra} vira ${PARES[destaque].sai}`}
            </p>
        </div>
    );
}

/* ── peças ────────────────────────────────────────────────────────────── */

function CardMoldura({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
    return (
        <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={18}
            className="fill-white/90 stroke-slate-300 dark:fill-slate-950/90 dark:stroke-white/20"
            strokeWidth={1}
        />
    );
}

function Rotulo({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
    return (
        <text
            x={x}
            y={y}
            className="fill-slate-500 dark:fill-slate-500 font-mono"
            fontSize={12}
            letterSpacing="2.5"
        >
            {children}
        </text>
    );
}

function Texto({ x, y, forte, children }: { x: number; y: number; forte: boolean; children: React.ReactNode }) {
    return (
        <text
            x={x}
            y={y}
            className={
                forte
                    ? "fill-slate-900 dark:fill-white font-mono"
                    : "fill-slate-600 dark:fill-slate-300 font-mono"
            }
            fontSize={17}
            style={{ transition: "fill .35s ease" }}
        >
            {children}
        </text>
    );
}

/**
 * Uma linha de fluxo: trilho apagado + uma partícula que percorre o caminho.
 *
 * `pathLength={100}` normaliza o comprimento: dasharray e dashoffset passam a
 * ser porcentagem do caminho, então a partícula tem o mesmo tamanho e a mesma
 * velocidade relativa em curvas de comprimentos diferentes. Sem isso, a linha
 * mais longa ficaria com a partícula proporcionalmente menor e mais lenta.
 */
function Fluxo({ d, par, forte, saida = false }: { d: string; par: Par; forte: boolean; saida?: boolean }) {
    return (
        <>
            <path
                d={d}
                fill="none"
                stroke={par.tom}
                strokeWidth={forte ? 1.8 : 1.2}
                opacity={forte ? 0.8 : 0.4}
                style={{ transition: "opacity .35s ease, stroke-width .35s ease" }}
            />
            <path
                className="zaeon-particula"
                d={d}
                fill="none"
                pathLength={100}
                stroke={par.tom}
                strokeWidth={forte ? 3 : 2}
                strokeLinecap="round"
                strokeDasharray="7 93"
                filter="url(#zf-glow)"
                style={{
                    animationDuration: `${forte ? par.duracao * 0.6 : par.duracao}s`,
                    animationDelay: `${par.atraso + (saida ? 0.8 : 0)}s`,
                    transition: "stroke-width .35s ease",
                }}
            />
        </>
    );
}

function Cerebro({
    cx,
    cy,
    destaque,
    semMovimento,
    r = 75,
}: {
    cx: number;
    cy: number;
    destaque: boolean;
    semMovimento: boolean;
    r?: number;
}) {
    const lado = r * 1.5;
    return (
        <g>
            {!semMovimento && (
                <circle
                    cx={cx}
                    cy={cy}
                    r={r - 13}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth={1.5}
                    style={{ animation: "zaeon-halo 2.8s ease-out infinite" }}
                />
            )}
            <circle
                cx={cx}
                cy={cy}
                r={r}
                className="fill-white/60 stroke-cyan-400/40 dark:fill-white/[0.04] dark:stroke-cyan-300/30"
                strokeWidth={1}
            />
            <g
                style={{
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    animation: semMovimento
                        ? undefined
                        : `zaeon-cerebro ${destaque ? 1.6 : 3.4}s ease-in-out infinite`,
                }}
            >
                <image
                    href={BRAIN}
                    x={cx - lado / 2}
                    y={cy - lado / 2}
                    width={lado}
                    height={lado}
                    preserveAspectRatio="xMidYMid meet"
                />
            </g>
        </g>
    );
}
