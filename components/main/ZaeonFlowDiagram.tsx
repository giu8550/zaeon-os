"use client";

import React, { useCallback, useEffect, useState } from "react";

/**
 * Diagrama vivo: o que a pessoa traz -> a Zaeon -> o que ela leva.
 *
 * As duas listas do Martinez pareiam NA ORDEM, e isso muda o que o desenho
 * significa: nao sao quatro entradas e quatro saidas soltas, sao QUATRO
 * TRANSFORMACOES. "medo -> confianca" e a mais forte das quatro e e o motivo
 * de a interacao existir -- passar o dedo numa linha mostra no que ela vira.
 *
 * Tudo e SVG com viewBox, incluindo o texto. A alternativa (cards em DOM e
 * linhas por cima) exige sincronizar coordenadas a cada resize e sempre erra
 * por um ou dois pixels; aqui as linhas nascem coladas nos cards por
 * construcao, em qualquer largura e em qualquer densidade de tela.
 *
 * Dois viewBox: horizontal no desktop, vertical no celular. Nao e o mesmo
 * desenho encolhido -- um leque de 4 linhas que funciona em 1000px de largura
 * vira um emaranhado ilegivel em 360px.
 *
 * ── Por que os conectores sao assim ──────────────────────────────────────
 * Uma linha com um pontinho correndo em cima le como "diagrama com animacao".
 * O que da a impressao de sistema em funcionamento sao tres coisas juntas:
 *
 * 1. TRILHA PONTILHADA QUE ANDA. O proprio caminho e tracejado e o tracejado
 *    escorre devagar. Mesmo a linha fora de foco continua sendo um barramento
 *    com dados passando, nao um risco parado.
 * 2. TRAFEGO, NAO UM PONTO. Tres pacotes por linha, com fases distribuidas ao
 *    longo do ciclo (atrasos negativos, entao a linha ja nasce cheia) e
 *    espessuras diferentes: um lider grosso e dois satelites finos.
 * 3. ONDULACAO FORA DE FASE. Cada grupo oscila alguns pixels no eixo
 *    transversal, com periodo proprio. E o que tira o aspecto de tabela: o
 *    conjunto respira em vez de marchar.
 *
 * Os periodos sao deliberadamente sem multiplo comum (3.2 / 3.9 / 3.5 / 4.3s
 * de trafego, 7 a 10.7s de ondulacao). Periodos multiplos voltam a coincidir a
 * cada poucos segundos e o olho percebe a batida; sem multiplo comum levam
 * minutos para repetir a mesma configuracao.
 */

type Par = {
    entra: string;
    sai: string;
    tom: string;
    /** Ritmo do trafego. Cada fluxo tem o seu: o conjunto respira em vez de marchar. */
    duracao: number;
    /** Fase inicial do trafego. */
    atraso: number;
    /** Periodo da ondulacao transversal, proposital sem multiplo comum com os vizinhos. */
    onda: number;
};

const PARES: Par[] = [
    { entra: "ideia", sai: "projeto", tom: "#22d3ee", duracao: 3.2, atraso: 0, onda: 7.0 },
    { entra: "estudo", sai: "artigo", tom: "#38bdf8", duracao: 3.9, atraso: 0.45, onda: 9.3 },
    { entra: "dúvida", sai: "TCC", tom: "#818cf8", duracao: 3.5, atraso: 0.9, onda: 8.1 },
    { entra: "medo", sai: "confiança", tom: "#2dd4bf", duracao: 4.3, atraso: 1.35, onda: 10.7 },
];

const BRAIN = "/assets/zaeon-brain-logo.png";

/** Quantos pacotes correm em cada trilha ao mesmo tempo, e com que peso. */
const PACOTES = [
    { fracao: 0, peso: 1, brilho: 1 },
    { fracao: 1 / 3, peso: 0.58, brilho: 0.7 },
    { fracao: 2 / 3, peso: 0.42, brilho: 0.5 },
];

/* ── geometria: computada, nunca escrita a mao ──────────────────────────── */

/** Desktop: 4 linhas saindo da borda do card ate a beirada do cerebro. */
const D = {
    vb: "0 0 1000 310",
    cardE: { x: 20, y: 36, w: 290, h: 237 },
    cardS: { x: 690, y: 36, w: 290, h: 237 },
    cerebro: { cx: 500, cy: 155, r: 92 },
    linha: (i: number) => 72 + i * 55,
    saida: (i: number) => 72 + i * 55,
};

/**
 * Onde cada fluxo encosta no cerebro. As quatro linhas NAO chegam no mesmo
 * ponto: elas atracam em quatro portas distribuidas no arco, com o angulo
 * derivado do indice. Convergir tudo num ponto so empilha as curvas nos ultimos
 * 80px e o leque vira um borrao justamente onde o olho esta olhando.
 */
const ABERTURA = 0.34; // radianos entre portas vizinhas

const porta = (
    c: { cx: number; cy: number; r: number },
    base: number,
    i: number,
    n = PARES.length
) => {
    const ang = base + (i - (n - 1) / 2) * ABERTURA;
    return { x: c.cx + c.r * Math.cos(ang), y: c.cy + c.r * Math.sin(ang) };
};

/** Porta esquerda (entrada) e direita (saida) do cerebro no desktop. */
export const portaEntradaD = (i: number) => porta(D.cerebro, Math.PI, PARES.length - 1 - i);
export const portaSaidaD = (i: number) => porta(D.cerebro, 0, i);

const entradaD = (i: number) => {
    const y = D.linha(i);
    const x0 = D.cardE.x + D.cardE.w;
    const p = portaEntradaD(i);
    const meio = x0 + (p.x - x0) * 0.55;
    return `M${x0},${y} C${meio},${y} ${p.x - 55},${p.y} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
};

const saidaD = (i: number) => {
    const y = D.saida(i);
    const x1 = D.cardS.x;
    const p = portaSaidaD(i);
    const meio = p.x + (x1 - p.x) * 0.45;
    return `M${p.x.toFixed(1)},${p.y.toFixed(1)} C${p.x + 55},${p.y} ${meio},${y} ${x1},${y}`;
};

/** Mobile: o leque abre pela borda de baixo do card, nao pela lateral. */
const M = {
    vb: "0 0 360 580",
    cardE: { x: 20, y: 20, w: 320, h: 162 },
    cardS: { x: 20, y: 398, w: 320, h: 162 },
    cerebro: { cx: 180, cy: 290, r: 64 },
    linha: (i: number) => 50 + i * 34,
    saida: (i: number) => 428 + i * 34,
    /** x de onde cada fluxo deixa o card: leque distribuido na largura. */
    coluna: (i: number) => 66 + i * 76,
};

/** Portas de cima (entrada) e de baixo (saida) do cerebro no celular. */
export const portaEntradaM = (i: number) => porta(M.cerebro, -Math.PI / 2, i);
export const portaSaidaM = (i: number) => porta(M.cerebro, Math.PI / 2, PARES.length - 1 - i);

const entradaM = (i: number) => {
    const x = M.coluna(i);
    const y0 = M.cardE.y + M.cardE.h;
    const p = portaEntradaM(i);
    const meio = y0 + (p.y - y0) * 0.55;
    return `M${x},${y0} C${x},${meio} ${p.x},${p.y - 45} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
};

const saidaM = (i: number) => {
    const x = M.coluna(i);
    const y1 = M.cardS.y;
    const p = portaSaidaM(i);
    const meio = p.y + (y1 - p.y) * 0.45;
    return `M${p.x.toFixed(1)},${p.y.toFixed(1)} C${p.x},${p.y + 45} ${x},${meio} ${x},${y1}`;
};

/* ── componente ─────────────────────────────────────────────────────────── */

export default function ZaeonFlowDiagram({ className = "" }: { className?: string }) {
    /** Quem o ciclo automatico esta mostrando. */
    const [auto, setAuto] = useState<number | null>(null);
    /** Quem o ponteiro/foco esta apontando. */
    const [sobre, setSobre] = useState<number | null>(null);
    /** Quem ficou preso por clique. */
    const [fixado, setFixado] = useState<number | null>(null);
    const [semMovimento, setSemMovimento] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sync = () => setSemMovimento(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);

    // Ciclo automatico: no celular nao existe hover, e um diagrama "interativo"
    // que so reage ao mouse fica morto justamente onde a maioria chega.
    //
    // O estado do ciclo e separado do estado do usuario de proposito: se fosse
    // um so, o setInterval se veria a si mesmo como "usuario assumiu o
    // controle", o efeito sairia cedo na re-execucao e o ciclo morreria depois
    // de um unico passo.
    useEffect(() => {
        if (semMovimento || fixado !== null || sobre !== null) return;
        const id = setInterval(() => {
            setAuto((i) => (i === null ? 0 : (i + 1) % PARES.length));
        }, 2600);
        return () => clearInterval(id);
    }, [semMovimento, fixado, sobre]);

    const destaque = fixado ?? sobre ?? auto;
    const marcar = useCallback((i: number | null) => setSobre(i), []);
    const fixar = useCallback((i: number) => setFixado((f) => (f === i ? null : i)), []);

    /** Opacidade de quem nao e o par em foco. Nao pode sumir: o fundo da landing
     *  tem particulas proprias e abaixo de ~0.35 a linha apagada some nelas. */
    const esmaecer = (i: number) => (destaque === null || destaque === i ? 1 : 0.38);
    const forte = (i: number) => destaque === i;

    const corpo = (mobile: boolean, sufixo: string) => {
        const G = mobile ? M : D;
        const dEntrada = mobile ? entradaM : entradaD;
        const dSaida = mobile ? saidaM : saidaD;
        const eixo = mobile ? "x" : "y";

        return (
            <>
                <CardMoldura {...G.cardE} />
                <CardMoldura {...G.cardS} />

                {/* FLUXOS primeiro: passam por baixo dos cards e do texto. */}
                {PARES.map((p, i) => (
                    <g
                        key={p.entra}
                        opacity={esmaecer(i)}
                        style={{ transition: "opacity .45s ease" }}
                    >
                        <Fluxo d={dEntrada(i)} par={p} forte={forte(i)} eixo={eixo} glow={sufixo} />
                        <Fluxo
                            d={dSaida(i)}
                            par={p}
                            forte={forte(i)}
                            eixo={eixo}
                            glow={sufixo}
                            fase={p.duracao * 0.5}
                        />
                    </g>
                ))}

                <Cerebro
                    cx={G.cerebro.cx}
                    cy={G.cerebro.cy}
                    r={G.cerebro.r}
                    destaque={destaque !== null}
                    semMovimento={semMovimento}
                    tom={destaque === null ? "#22d3ee" : PARES[destaque].tom}
                />

                {/* PORTAS por cima do cerebro: onde cada linha atraca. */}
                {PARES.map((p, i) => (
                    <g key={`p-${p.entra}`} opacity={esmaecer(i)} style={{ transition: "opacity .45s ease" }}>
                        <Porta
                            p={mobile ? portaEntradaM(i) : portaEntradaD(i)}
                            par={p}
                            forte={forte(i)}
                        />
                        <Porta
                            p={mobile ? portaSaidaM(i) : portaSaidaD(i)}
                            par={p}
                            forte={forte(i)}
                        />
                    </g>
                ))}

                {/* TEXTO por cima, com a area de toque do par inteiro. */}
                {PARES.map((p, i) => {
                    const yE = G.linha(i);
                    const yS = G.saida(i);
                    return (
                        <g
                            key={`t-${p.entra}`}
                            opacity={esmaecer(i)}
                            onMouseEnter={() => marcar(i)}
                            onMouseLeave={() => marcar(null)}
                            onClick={() => fixar(i)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    fixar(i);
                                }
                            }}
                            onFocus={() => marcar(i)}
                            onBlur={() => marcar(null)}
                            style={{ transition: "opacity .45s ease", cursor: "pointer" }}
                            tabIndex={0}
                            role="button"
                            aria-label={`${p.entra} vira ${p.sai}`}
                        >
                            {/* alvo de toque: a linha inteira, nao so as letras */}
                            <rect
                                x={G.cardE.x + 6}
                                y={yE - 18}
                                width={G.cardE.w - 12}
                                height={36}
                                fill="transparent"
                            />
                            <rect
                                x={G.cardS.x + 6}
                                y={yS - 18}
                                width={G.cardS.w - 12}
                                height={36}
                                fill="transparent"
                            />
                            <No cx={G.cardE.x + 28} cy={yE} par={p} forte={forte(i)} />
                            <Texto x={G.cardE.x + 48} y={yE} forte={forte(i)} mobile={mobile}>
                                {p.entra}
                            </Texto>
                            <No cx={G.cardS.x + 28} cy={yS} par={p} forte={forte(i)} />
                            <Texto x={G.cardS.x + 48} y={yS} forte={forte(i)} mobile={mobile}>
                                {p.sai}
                            </Texto>
                        </g>
                    );
                })}
            </>
        );
    };

    return (
        <div className={`w-full ${className}`}>
            <style>{`
                @keyframes zf-pacote  { from { stroke-dashoffset: 100 } to { stroke-dashoffset: 0 } }
                @keyframes zf-trilha  { from { stroke-dashoffset: 0 }   to { stroke-dashoffset: -15 } }
                @keyframes zf-onda-y  { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
                @keyframes zf-onda-x  { 0%,100% { transform: translateX(0) } 50% { transform: translateX(4px) } }
                @keyframes zf-no      { 0%,100% { r: 3.4; opacity: .5 } 50% { r: 4.8; opacity: 1 } }
                @keyframes zf-porta   { 0%,100% { r: 2.2; opacity: .55 } 50% { r: 3.6; opacity: 1 } }
                @keyframes zf-cerebro { 0%,100% { transform: scale(1) } 50% { transform: scale(1.045) } }
                @keyframes zf-halo    { 0% { transform: scale(.84); opacity: .5 } 70% { transform: scale(1.2); opacity: 0 } 100% { transform: scale(1.2); opacity: 0 } }

                .zf-pacote { animation-name: zf-pacote; animation-timing-function: linear; animation-iteration-count: infinite }
                .zf-trilha { animation-name: zf-trilha; animation-timing-function: linear; animation-iteration-count: infinite }
                .zf-onda-y { animation-name: zf-onda-y; animation-timing-function: ease-in-out; animation-iteration-count: infinite }
                .zf-onda-x { animation-name: zf-onda-x; animation-timing-function: ease-in-out; animation-iteration-count: infinite }
                .zf-no     { animation-name: zf-no;     animation-timing-function: ease-in-out; animation-iteration-count: infinite }
                .zf-porta  { animation-name: zf-porta;  animation-timing-function: ease-in-out; animation-iteration-count: infinite }

                @media (prefers-reduced-motion: reduce) {
                    .zf-pacote, .zf-trilha, .zf-onda-y, .zf-onda-x, .zf-no, .zf-porta { animation: none !important }
                    .zf-pacote { stroke-dashoffset: 55 !important }
                }
            `}</style>

            <svg
                viewBox={D.vb}
                className="hidden md:block w-full h-auto"
                role="img"
                aria-label="Você chega com ideia, estudo, dúvida e medo; a Zaeon devolve projeto, artigo, TCC e confiança."
            >
                <Defs sufixo="d" />
                {corpo(false, "d")}
            </svg>

            <svg
                viewBox={M.vb}
                className="block md:hidden w-full h-auto"
                role="img"
                aria-label="Você chega com ideia, estudo, dúvida e medo; a Zaeon devolve projeto, artigo, TCC e confiança."
            >
                <Defs sufixo="m" />
                {corpo(true, "m")}
            </svg>

            <p
                className="mt-6 font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-500"
                aria-hidden="true"
            >
                {destaque === null
                    ? "quatro entradas · quatro saídas"
                    : `${PARES[destaque].entra} vira ${PARES[destaque].sai}`}
            </p>
        </div>
    );
}

/* ── pecas ──────────────────────────────────────────────────────────────── */

function Defs({ sufixo }: { sufixo: string }) {
    return (
        <defs>
            <filter id={`zf-glow-${sufixo}`} x="-70%" y="-70%" width="240%" height="240%">
                <feGaussianBlur stdDeviation="3.5" result="b" />
                <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
    );
}

function CardMoldura({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
    return (
        <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={14}
            className="fill-white/90 stroke-slate-300 dark:fill-slate-950/90 dark:stroke-white/20"
            strokeWidth={1}
        />
    );
}


function Texto({
    x,
    y,
    forte,
    mobile,
    children,
}: {
    x: number;
    y: number;
    forte: boolean;
    mobile: boolean;
    children: React.ReactNode;
}) {
    return (
        <text
            x={x}
            y={y}
            className={
                forte
                    ? "fill-slate-900 dark:fill-white font-mono"
                    : "fill-slate-600 dark:fill-slate-300 font-mono"
            }
            fontSize={mobile ? 16 : 19}
            dominantBaseline="middle"
            style={{ transition: "fill .35s ease" }}
        >
            {children}
        </text>
    );
}

/** O ponto ao lado da palavra. Respira no ritmo do proprio fluxo. */
function No({ cx, cy, par, forte }: { cx: number; cy: number; par: Par; forte: boolean }) {
    return (
        <circle
            className="zf-no"
            cx={cx}
            cy={cy}
            r={3.4}
            fill={par.tom}
            style={{
                animationDuration: `${par.duracao}s`,
                animationDelay: `${-par.atraso}s`,
                filter: forte ? "brightness(1.3)" : undefined,
            }}
        />
    );
}

/** A porta onde um fluxo atraca no cerebro. Pisca no ritmo do proprio trafego. */
function Porta({
    p,
    par,
    forte,
}: {
    p: { x: number; y: number };
    par: Par;
    forte: boolean;
}) {
    return (
        <circle
            className="zf-porta"
            cx={p.x}
            cy={p.y}
            r={2.4}
            fill={par.tom}
            style={{
                animationDuration: `${par.duracao}s`,
                animationDelay: `${-(par.atraso + par.duracao * 0.5)}s`,
                filter: forte ? "brightness(1.35)" : undefined,
            }}
        />
    );
}

/**
 * Um conector. Tres camadas: trilha pontilhada que escorre, tres pacotes com
 * fases distribuidas, e o grupo inteiro ondulando fora de fase com os vizinhos.
 *
 * `pathLength={100}` normaliza o comprimento: dasharray e dashoffset viram
 * porcentagem do caminho, entao o pacote tem o mesmo tamanho e a mesma
 * velocidade relativa em curvas de comprimentos diferentes. Sem isso, a linha
 * mais longa ficaria com o pacote proporcionalmente menor e mais lento.
 */
function Fluxo({
    d,
    par,
    forte,
    eixo,
    glow,
    fase = 0,
}: {
    d: string;
    par: Par;
    forte: boolean;
    eixo: "x" | "y";
    glow: string;
    fase?: number;
}) {
    const dur = forte ? par.duracao * 0.55 : par.duracao;

    return (
        <g
            className={eixo === "y" ? "zf-onda-y" : "zf-onda-x"}
            style={{
                animationDuration: `${par.onda}s`,
                animationDelay: `${-par.atraso * 2}s`,
            }}
        >
            {/* trilha: pontilhada e escorrendo, entao a linha parada tambem tem transito */}
            <path
                className="zf-trilha"
                d={d}
                fill="none"
                stroke={par.tom}
                strokeWidth={forte ? 1.6 : 1.1}
                strokeDasharray="1.6 5.5"
                strokeLinecap="round"
                opacity={forte ? 0.95 : 0.5}
                style={{
                    animationDuration: `${par.onda * 0.5}s`,
                    transition: "opacity .35s ease, stroke-width .35s ease",
                }}
            />

            {PACOTES.map((pk, k) => (
                <path
                    key={k}
                    className="zf-pacote"
                    d={d}
                    fill="none"
                    pathLength={100}
                    stroke={par.tom}
                    strokeWidth={(forte ? 3.2 : 2.2) * pk.peso + 0.7}
                    strokeLinecap="round"
                    strokeDasharray={`${4 + k} ${96 - k}`}
                    opacity={(forte ? 1 : 0.7) * pk.brilho}
                    filter={k === 0 ? `url(#zf-glow-${glow})` : undefined}
                    style={{
                        animationDuration: `${dur}s`,
                        animationDelay: `${-(par.atraso + fase + pk.fracao * dur)}s`,
                        transition: "stroke-width .35s ease, opacity .35s ease",
                    }}
                />
            ))}
        </g>
    );
}

function Cerebro({
    cx,
    cy,
    r,
    destaque,
    semMovimento,
    tom,
}: {
    cx: number;
    cy: number;
    r: number;
    destaque: boolean;
    semMovimento: boolean;
    tom: string;
}) {
    return (
        <g>
            {!semMovimento && (
                <circle
                    cx={cx}
                    cy={cy}
                    r={r * 1.02}
                    fill="none"
                    stroke={tom}
                    strokeWidth={1.2}
                    style={{
                        transformBox: "fill-box",
                        transformOrigin: "center",
                        animation: "zf-halo 2.6s ease-out infinite",
                        transition: "stroke .5s ease",
                    }}
                />
            )}
            <circle
                cx={cx}
                cy={cy}
                r={r}
                className="fill-white/90 dark:fill-slate-950/90"
                stroke={tom}
                strokeWidth={destaque ? 1.6 : 1}
                opacity={0.95}
                style={{ transition: "stroke .5s ease, stroke-width .35s ease" }}
            />
            <g
                style={{
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    animation: semMovimento ? undefined : "zf-cerebro 3.4s ease-in-out infinite",
                }}
            >
                <image
                    href={BRAIN}
                    x={cx - r * 0.62}
                    y={cy - r * 0.62}
                    width={r * 1.24}
                    height={r * 1.24}
                    preserveAspectRatio="xMidYMid meet"
                />
            </g>
        </g>
    );
}
