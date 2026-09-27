import React from "react";
import MolecularText from "@/components/ui/MolecularText";

/**
 * Regras de alinhamento da landing.
 *
 * O problema que isto resolve: cada secao tinha o seu proprio `max-w-*` e o seu
 * proprio `px-*`, entao em 1440px o H1 comecava em 96px, o H2 da secao seguinte
 * em 66px e um H3 mais abaixo em 321px. Quatro margens esquerdas diferentes na
 * mesma pagina. O olho nao mede, mas percebe.
 *
 * `BORDA` (a classe `.zaeon-borda`, definida em app/globals.css) e uma so
 * margem: o padding lateral e calculado para que o conteudo comece exatamente
 * onde comecaria um container de 1200px centralizado com 56px de calha. O
 * fundo continua sangrando de borda a borda -- o que e centralizado e o
 * conteudo, nao o elemento -- entao da para aplicar direto na secao sem
 * espremer StarBackground, marquee ou gradiente.
 */
export const BORDA = "zaeon-borda";

/** Largura confortavel de leitura: ~65 caracteres. */
export const LEITURA = "max-w-[520px]";

/** Rotulo mono em caixa alta que abre cada secao. */
export function Rotulo({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <p
            className={// cyan-700, nao 600: medido no navegador, cyan-600 sobre branco da 3,68:1 em
// 11px, e a AA exige 4,5:1 para texto pequeno. cyan-700 da 5,36:1. No escuro
// o problema nao existe (cyan-400 sobre quase-preto), entao so o claro muda.
        `font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-400/80 ${className}`}
        >
            {children}
        </p>
    );
}

/**
 * Titulo de secao em duas linhas: a primeira afirma, a segunda completa em tom
 * mais baixo. Mesma escala tipografica em toda a pagina (50px/1.04, -0.018em).
 */
export function TituloSecao({
    forte,
    fraco,
    className = "",
}: {
    forte: React.ReactNode;
    fraco?: React.ReactNode;
    className?: string;
}) {
    return (
        <h2
            className={`mt-4 max-w-[760px] text-[2rem] md:text-[3.125rem] font-semibold leading-[1.04] tracking-[-0.018em] text-slate-900 dark:text-white ${className}`}
        >
            {typeof forte === "string" ? <MolecularText text={forte} /> : forte}
            {fraco ? (
                <>
                    <br />
                    <span className="text-slate-500 dark:text-slate-400">
                        {typeof fraco === "string" ? <MolecularText text={fraco} delay={0.18} /> : fraco}
                    </span>
                </>
            ) : null}
        </h2>
    );
}
