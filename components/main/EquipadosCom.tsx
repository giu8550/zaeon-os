"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

/**
 * "Equipados com" — a fileira das casas que fornecem os modelos.
 *
 * Substitui um ticker VERTICAL que, alem de vertical, estava quebrado: ele
 * pedia `/companies/openai.png`, `/companies/anthropic.png` e mais tres — e a
 * pasta `public/companies/` nao existe no repositorio. Eram cinco cartoes
 * vazios rolando de baixo pra cima havia quem sabe quanto tempo, porque um
 * `<Image>` que da 404 nao derruba nada: so nao pinta.
 *
 * Os arquivos que EXISTEM estao em `public/assets/models/<slug>.svg`, que e a
 * mesma pasta que o mural de modelos do hero ja usa. Esta fileira passa a ler
 * de la.
 *
 * LOGO **E** NOME, nao logo NO LUGAR do nome — pela mesma razao que o mural do
 * hero: `openai.svg` e `xai.svg` ainda nao estao na pasta. Com so o glifo, a
 * fileira teria duas gramaticas misturadas (cinco desenhos e dois buracos);
 * com logo + palavra, quem nao tem arquivo simplesmente aparece como palavra e
 * ninguem percebe a falta. Quando os dois SVGs entrarem, eles aparecem
 * sozinhos, sem tocar neste arquivo.
 *
 * Nao desenhamos marca de terceiro a mao: logo de fabricante se pega no press
 * kit dele.
 */

type Casa = { slug: string; nome: string };

// Logos de fabricante que REALMENTE existem em public/assets/models/<slug>.svg.
// Não desenhamos marca de terceiro à mão (press kit only), então quem não está aqui
// aparece só com o nome — e a gente NÃO pede o arquivo (evita 404 no console).
// Ao adicionar um .svg oficial na pasta, inclua o slug aqui.
const COM_LOGO = new Set<string>(["anthropic"]);

const CASAS: Casa[] = [
    { slug: "openai", nome: "OpenAI" },
    { slug: "anthropic", nome: "Anthropic" },
    { slug: "google", nome: "Google" },
    { slug: "meta", nome: "Meta" },
    { slug: "mistral", nome: "Mistral" },
    { slug: "deepseek", nome: "DeepSeek" },
    { slug: "xai", nome: "xAI" },
];

export default function EquipadosCom({ className = "" }: { className?: string }) {
    const [semMovimento, setSemMovimento] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sync = () => setSemMovimento(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);

    // Tres copias e o minimo para a volta ser invisivel: a animacao percorre
    // exatamente UM terco e reinicia, entao o que sai pela esquerda ja esta
    // desenhado na direita quando o salto acontece.
    const fila = [...CASAS, ...CASAS, ...CASAS];

    return (
        <div className={className}>
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.28em] text-slate-800 dark:text-white/90">
                Equipados com
            </p>

            {/* NÃO pausa no hover: o mouse por cima não para (nem faz a fila saltar pro começo) */}
            <div
                className="relative mt-5 overflow-hidden"
                style={{
                    // A mascara apaga os dois extremos: sem ela, as marcas
                    // aparecem e somem com um corte reto na borda do container.
                    maskImage:
                        "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
                    WebkitMaskImage:
                        "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
                }}
            >
                <motion.div
                    className="flex w-max gap-3"
                    animate={semMovimento ? { x: "0%" } : { x: ["0%", "-33.3333%"] }}
                    transition={
                        semMovimento
                            ? { duration: 0 }
                            : { ease: "linear", duration: 34, repeat: Infinity }
                    }
                >
                    {fila.map((c, i) => (
                        <Selo key={`${c.slug}-${i}`} casa={c} />
                    ))}
                </motion.div>
            </div>
        </div>
    );
}

function Selo({ casa }: { casa: Casa }) {
    const [falhou, setFalhou] = useState(false);

    return (
        <span className="flex shrink-0 items-center gap-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] backdrop-blur-sm px-4 py-3">
            {falhou || !COM_LOGO.has(casa.slug) ? null : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={`/assets/models/${casa.slug}.svg`}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    onError={() => setFalhou(true)}
                    className="h-5 w-5 shrink-0 object-contain opacity-80 dark:brightness-0 dark:invert"
                />
            )}
            <span className="whitespace-nowrap text-sm font-medium text-slate-700 dark:text-white/80">
                {casa.nome}
            </span>
        </span>
    );
}
