"use client";

import React from "react";
import { motion } from "framer-motion";

/**
 * Animação "molecular" de título: cada letra se materializa com fade + um leve deslocamento, em cascata
 * (stagger). SÓ fade-in, uma vez (`once: true`): o texto fica na página ao rolar de volta — sem blur nem
 * will-change, pra não pesar no navegador.
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
                  className="inline-block"
                  initial={{ opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}   // SÓ entra (fade-in): anima uma vez e fica — sem fade-out ao subir a página
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
