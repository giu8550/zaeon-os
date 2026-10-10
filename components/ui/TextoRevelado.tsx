"use client";

import React from "react";
import { motion } from "framer-motion";

/**
 * Texto MENOR animado (parágrafos, selos, legendas): aparece PALAVRA por palavra (fade + subida), mais leve que o
 * MolecularText (letra a letra). SÓ fade-in, uma vez (`once: true`): o texto fica na página ao rolar de volta.
 * Palavra é `inline-block`, mas o espaço entre elas fica livre pra quebrar linha normalmente.
 */
export default function TextoRevelado({
  texto,
  className = "",
  delay = 0,
  passo = 0.025,
}: {
  texto: string;
  className?: string;
  delay?: number;
  passo?: number;
}) {
  const palavras = (texto ?? "").split(" ");
  return (
    <span className={className}>
      <span className="sr-only">{texto}</span>
      <span aria-hidden="true">
        {palavras.map((p, i) => (
          <React.Fragment key={i}>
            <motion.span
              className="inline-block"
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.45, ease: "easeOut", delay: delay + i * passo }}
            >
              {p}
            </motion.span>
            {i < palavras.length - 1 ? " " : null}
          </React.Fragment>
        ))}
      </span>
    </span>
  );
}
