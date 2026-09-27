"use client";

import React from "react";
import { motion } from "framer-motion";

/**
 * Animação "molecular" de título: cada letra se materializa com blur + fade + um
 * leve deslocamento, em cascata (stagger).
 *
 * IMPORTANTE (bug corrigido): as letras são `inline-block`, o que cria um ponto de
 * quebra em CADA letra — sem cuidado, a palavra quebra no meio no fim da linha.
 * Por isso agrupamos por PALAVRA (cada palavra é um `inline-block whitespace-nowrap`,
 * atômica) e deixamos só o ESPAÇO entre palavras como ponto de quebra. A cascata é
 * por um índice global de letra (delay = i * stagger), não `staggerChildren`, pra
 * funcionar mesmo com as letras aninhadas dentro das palavras.
 */
export default function MolecularText({
  text,
  className = "",
  delay = 0,
  stagger = 0.028,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const words = (text ?? "").split(" ");
  let i = 0;
  return (
    <span className={className} aria-label={text}>
      {words.map((word, wi) => (
        <React.Fragment key={wi}>
          <span className="inline-block whitespace-nowrap" aria-hidden="true">
            {Array.from(word).map((c) => {
              const d = delay + i++ * stagger;
              return (
                <motion.span
                  key={d}
                  className="inline-block will-change-[transform,filter,opacity]"
                  initial={{ opacity: 0, filter: "blur(8px)", y: 6 }}
                  whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: d }}
                >
                  {c}
                </motion.span>
              );
            })}
          </span>
          {wi < words.length - 1 ? " " : null}
        </React.Fragment>
      ))}
    </span>
  );
}
