"use client";

import React, { useCallback, useEffect, useState } from "react";

/**
 * Diagrama vivo: o que a pessoa traz -> a Zaeon -> o que ela leva.
 *
 * As duas listas pareiam NA ORDEM: sao TRES TRANSFORMACOES, uma por pilar
 * da Zaeon (ideias, estudos, negocios). Quando o
 * fluxo chega no cerebro, saltam dele as AREAS que aquela funcao cobre (Pops) --
 * passar o dedo numa linha fixa o par e as palavras continuam saltando.
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
    /** As palavras que SALTAM do cérebro quando o fluxo chega nele: o que aquela função da Zaeon cobre. */
    pops: string[];
    /** Em vez da lista fixa, GERA as palavras de cada rodada (ex.: ideia → "SaaS de agronomia"). */
    gerar?: (rodada: number, n: number) => string[];
    tom: string;
    /** Ritmo do trafego. Cada fluxo tem o seu: o conjunto respira em vez de marchar. */
    duracao: number;
    /** Fase inicial do trafego. */
    atraso: number;
    /** Periodo da ondulacao transversal, proposital sem multiplo comum com os vizinhos. */
    onda: number;
};

// IDEIAS mostra as ÁREAS DE CONHECIMENTO de onde PROJETOS nascem (não ideias prontas): só as áreas mais propensas a
// projetar/construir — engenharias, arquitetura e urbanismo, design, computação, tecnologia, agrárias técnicas.
// Embaralhada UMA vez (semente fixa); cada visita mostra as próximas 4, então TODAS aparecem antes de alguma repetir.
// Determinístico: desktop e celular batem.
export const AREAS_CONHECIMENTO = [
    "engenharia civil", "engenharia elétrica", "engenharia mecânica", "engenharia química", "engenharia ambiental",
    "engenharia de produção", "engenharia de software", "engenharia de computação", "engenharia aeroespacial",
    "engenharia biomédica", "engenharia de materiais", "engenharia agrícola", "engenharia naval",
    "engenharia de automação", "engenharia de energia", "arquitetura e urbanismo", "design de produto",
    "design gráfico", "design de interiores", "ciência da computação", "sistemas de informação", "ciência de dados",
    "inteligência artificial", "mecatrônica", "robótica", "eletrônica", "eletrotécnica", "telecomunicações",
    "agronomia", "biotecnologia", "construção civil", "game design", "paisagismo", "edificações",
];
/** gerador pseudo-aleatório pequeno com semente (mulberry32) */
const sorteio = (semente: number) => () => {
    let t = (semente += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ORDEM_AREAS = (() => {   // Fisher–Yates com semente fixa
    const rnd = sorteio(2026), a = [...AREAS_CONHECIMENTO];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
    return a;
})();
/** as n áreas da rodada: percorre a lista inteira antes de repetir */
export function areasDaRodada(rodada: number, n: number): string[] {
    const N = ORDEM_AREAS.length;
    return Array.from({ length: n }, (_, k) => ORDEM_AREAS[(((rodada * n + k) % N) + N) % N]!);
}

// TRÊS PILARES (no plural): ideias → projetos (as áreas de conhecimento que projetam), estudos → pesquisas (cada
// nível de estudo ligado à sua produção principal: TCC, artigo, relatório) e negócios → crescimento.
const PARES: Par[] = [
    { entra: "ideias", sai: "projetos", tom: "#22d3ee", duracao: 3.2, atraso: 0, onda: 7.0,
      pops: ["engenharia", "arquitetura", "design", "computação"], gerar: areasDaRodada },
    { entra: "estudos", sai: "pesquisas", tom: "#818cf8", duracao: 3.7, atraso: 0.6, onda: 9.3,
      pops: [
          // "nível|produção": a produção (TCC, artigo, relatório) sai em destaque — preto no claro, branco no escuro
          "graduação|TCC", "pós-graduação|artigo", "mestrado|artigo", "graduação|relatório",
          "doutorado|artigo", "pós-graduação|TCC", "graduação|artigo", "mestrado|relatório",
      ] },
    { entra: "negócios", sai: "crescimento", tom: "#2dd4bf", duracao: 4.3, atraso: 1.2, onda: 10.7,
      pops: ["marketing", "vendas", "finanças", "gestão", "e-commerce", "empreendedorismo", "atendimento", "estratégia", "contabilidade", "operações"] },
];

/** Quantas palavras saltam por vez e onde (graus em volta do cérebro): em cima e embaixo no desktop (os fluxos
 *  entram e saem pelos lados); dos lados no celular (os fluxos entram e saem por cima e por baixo). */
const POPS_POR_VEZ = 4;
const ANG_POP_D = [-128, -52, 52, 128];
const ANG_POP_M = [-158, -22, 22, 158];

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
    // linhas CENTRADAS no card (funciona com 3 ou 4 pares)
    linha: (i: number) => 154.5 + (i - (PARES.length - 1) / 2) * 62,
    saida: (i: number) => 154.5 + (i - (PARES.length - 1) / 2) * 62,
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
    linha: (i: number) => 101 + (i - (PARES.length - 1) / 2) * 38,
    saida: (i: number) => 479 + (i - (PARES.length - 1) / 2) * 38,
    /** x de onde cada fluxo deixa o card: leque distribuido na largura. */
    coluna: (i: number) => 180 + (i - (PARES.length - 1) / 2) * 90,
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

    // POPS: a cada chegada do fluxo no cérebro (uma "rodada"), saltam POPS_POR_VEZ palavras do par em foco; a
    // rodada seguinte pega as próximas da lista — a vitrine gira.
    // Um contador POR PAR: cada visita ao par avança a vitrine dele em uma rodada (com um contador só, cada
    // visita pulava as rodadas dos outros pares e a lista de áreas não era percorrida inteira).
    const [rodadas, setRodadas] = useState<number[]>(() => PARES.map(() => 0));
    useEffect(() => {
        if (destaque === null || semMovimento) return;
        const avancar = () => setRodadas((rs) => rs.map((r, i) => (i === destaque ? r + 1 : r)));
        avancar();
        const id = setInterval(avancar, 2600);
        return () => clearInterval(id);
    }, [destaque, semMovimento]);
    const rodada = destaque === null ? 0 : rodadas[destaque] ?? 0;
    const marcar = useCallback((i: number | null) => setSobre(i), []);
    const fixar = useCallback((i: number) => setFixado((f) => (f === i ? null : i)), []);

    /** Opacidade de quem nao e o par em foco. Nao pode sumir: o fundo da landing
     *  tem particulas proprias e abaixo de ~0.35 a linha apagada some nelas. */
    const esmaecer = (i: number) => (destaque === null || destaque === i ? 1 : 0.65);   // sem "acinzentar" demais quem não está em foco
    const forte = (i: number) => destaque === i;

    const corpo = (mobile: boolean, sufixo: string) => {
        const G = mobile ? M : D;
        const dEntrada = mobile ? entradaM : entradaD;
        const dSaida = mobile ? saidaM : saidaD;
        const eixo = mobile ? "x" : "y";

        return (
            <>
                {/* os cards: AZULADOS, tingidos pela cor do fluxo que está passando no cérebro agora */}
                <CardMoldura {...G.cardE} tom={destaque === null ? "#22d3ee" : PARES[destaque].tom} sufixo={sufixo} />
                <CardMoldura {...G.cardS} tom={destaque === null ? "#22d3ee" : PARES[destaque].tom} sufixo={sufixo} />

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

                {/* POPS: as palavras que saltam do cérebro quando o fluxo chega */}
                {destaque !== null && (
                    <Pops
                        key={`pop-${destaque}-${rodada}-${sufixo}`}
                        par={PARES[destaque]}
                        rodada={rodada}
                        cx={G.cerebro.cx}
                        cy={G.cerebro.cy}
                        r={G.cerebro.r}
                        mobile={mobile}
                        estatico={semMovimento}
                    />
                )}

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
                @keyframes zf-pop     { 0% { opacity: 0; transform: translate(0, 0) scale(.55) } 18% { opacity: 1 } 78% { opacity: 1 } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1) } }
                .zf-pop { animation: zf-pop 2.4s cubic-bezier(.2,.7,.2,1) both; transform-box: fill-box; transform-origin: center }

                .zf-pacote { animation-name: zf-pacote; animation-timing-function: linear; animation-iteration-count: infinite }
                .zf-trilha { animation-name: zf-trilha; animation-timing-function: linear; animation-iteration-count: infinite }
                .zf-onda-y { animation-name: zf-onda-y; animation-timing-function: ease-in-out; animation-iteration-count: infinite }
                .zf-onda-x { animation-name: zf-onda-x; animation-timing-function: ease-in-out; animation-iteration-count: infinite }
                .zf-no     { animation-name: zf-no;     animation-timing-function: ease-in-out; animation-iteration-count: infinite }
                .zf-porta  { animation-name: zf-porta;  animation-timing-function: ease-in-out; animation-iteration-count: infinite }

                @media (prefers-reduced-motion: reduce) {
                    .zf-pacote, .zf-trilha, .zf-onda-y, .zf-onda-x, .zf-no, .zf-porta { animation: none !important }
                    .zf-pacote { stroke-dashoffset: 55 !important }
                    .zf-pop { animation: none !important; opacity: 1 }
                }
            `}</style>

            <svg
                viewBox={D.vb}
                className="hidden md:block w-full h-auto"
                role="img"
                aria-label="Ideias viram projetos, estudos viram pesquisas e negócios viram crescimento."
            >
                <Defs sufixo="d" />
                {corpo(false, "d")}
            </svg>

            <svg
                viewBox={M.vb}
                className="block md:hidden w-full h-auto"
                role="img"
                aria-label="Ideias viram projetos, estudos viram pesquisas e negócios viram crescimento."
            >
                <Defs sufixo="m" />
                {corpo(true, "m")}
            </svg>

        </div>
    );
}

/* ── pecas ──────────────────────────────────────────────────────────────── */

/**
 * As palavras que SALTAM do cérebro: nascem na borda dele e escorregam pra fora (em cima/embaixo no desktop,
 * dos lados no celular), com um halo escuro atrás do texto pra ler por cima das partículas do fundo. Cada rodada
 * mostra as próximas POPS_POR_VEZ palavras da lista do par, em cascata.
 */
/** celular: rótulo longo quebra em 2 linhas, no espaço mais perto do meio ("engenharia / aeroespacial") */
function quebrar(t: string): [string, string] {
    if (t.length <= 12 || !t.includes(" ")) return [t, ""];
    let melhor = -1;
    for (let i = 0; i < t.length; i++) if (t[i] === " " && (melhor < 0 || Math.abs(i - t.length / 2) < Math.abs(melhor - t.length / 2))) melhor = i;
    return [t.slice(0, melhor), t.slice(melhor + 1)];
}

function Pops({
    par, rodada, cx, cy, r, mobile, estatico,
}: { par: Par; rodada: number; cx: number; cy: number; r: number; mobile: boolean; estatico: boolean }) {
    const angs = mobile ? ANG_POP_M : ANG_POP_D;
    const n = par.pops.length;
    const gerado = par.gerar?.(rodada, angs.length);
    return (
        <g aria-hidden="true" pointerEvents="none">
            {angs.map((g, k) => {
                const palavra = gerado ? gerado[k]! : par.pops[(rodada * POPS_POR_VEZ + k) % n];
                // DESKTOP: na faixa livre acima e abaixo do cérebro (2 linhas em cima, 2 embaixo, centradas) — cabe
                // frase longa sem cruzar os cards. CELULAR: dos lados, e a frase quebra em 2 linhas ("app de / saúde").
                let x: number, y: number, dx: number, dy: number, ancora: "middle" | "start" | "end";
                if (!mobile) {
                    const emCima = k < 2, fila = k % 2;
                    x = cx; y = emCima ? cy - r : cy + r;
                    dx = 0; dy = emCima ? -(26 + fila * 24) : 22 + fila * 24;
                    ancora = "middle";
                } else {
                    const a = (g * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
                    x = cx + cos * r * 0.92; y = cy + sin * r * 0.92;
                    dx = cos * r * 0.35; dy = sin * r * 0.9;
                    ancora = cos < 0 ? "end" : "start";
                }
                const par2 = palavra.includes("|") ? palavra.split("|") as [string, string] : null;   // "nível|produção"
                const [l1, l2] = par2 ? (mobile ? par2 : [palavra, ""]) : mobile ? quebrar(palavra) : [palavra, ""];
                const destaque = (t: string) => <tspan className="fill-slate-900 dark:fill-white" fontWeight={800}>{t}</tspan>;
                return (
                    <text
                        key={k}
                        x={x}
                        y={y}
                        textAnchor={ancora}
                        dominantBaseline="middle"
                        fontSize={mobile ? (Math.max(l1.length, l2.length) > 13 ? 10.2 : 11.5) : 15}
                        fontWeight={600}
                        fill={par.tom}
                        className="zf-pop font-mono [stroke:rgba(255,255,255,0.92)] dark:[stroke:rgba(2,6,23,0.85)]"
                        strokeWidth={4}
                        paintOrder="stroke"
                        style={{
                            ["--dx" as string]: `${dx.toFixed(1)}px`,
                            ["--dy" as string]: `${dy.toFixed(1)}px`,
                            animationDelay: estatico ? undefined : `${k * 0.18}s`,
                            filter: `drop-shadow(0 0 6px ${par.tom})`,
                        } as React.CSSProperties}
                    >
                        {l2
                            ? (<><tspan x={x} dy="-0.55em">{l1}</tspan><tspan x={x} dy="1.15em">{par2 ? destaque(l2) : l2}</tspan></>)
                            : par2 ? (<>{par2[0]} {destaque(par2[1])}</>) : palavra}
                    </text>
                );
            })}
        </g>
    );
}

function Defs({ sufixo }: { sufixo: string }) {
    return (
        <defs>
            {/* sombra/brilho suave dos cards */}
            <filter id={`zf-card-${sufixo}`} x="-10%" y="-10%" width="120%" height="125%">
                <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#0b1d4a" floodOpacity="0.45" />
            </filter>
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

function CardMoldura({ x, y, w, h, tom, sufixo }: { x: number; y: number; w: number; h: number; tom: string; sufixo: string }) {
    // base azul-marinho translúcida + véu da cor do fluxo em foco + borda nessa cor (tudo transiciona junto)
    return (
        <g filter={`url(#zf-card-${sufixo})`}>
            <rect x={x} y={y} width={w} height={h} rx={14} fill="rgba(10,22,52,0.82)" />
            <rect x={x} y={y} width={w} height={h} rx={14} fill={tom} opacity={0.13} style={{ transition: "fill .6s ease" }} />
            <rect
                x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} rx={14}
                fill="none" stroke={tom} strokeOpacity={0.55} strokeWidth={1.2}
                style={{ transition: "stroke .6s ease" }}
            />
        </g>
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
                    : "fill-slate-800 dark:fill-white/80 font-mono"
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
