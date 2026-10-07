"use client";

import React from "react";
import { motion } from "framer-motion";

/**
 * Texto MENOR animado (parágrafos, selos, legendas): aparece PALAVRA por palavra (fade + leve desfoque + subida),
 * mais leve que o MolecularText (letra a letra), e anima nos DOIS sentidos — entra ao aparecer e sai ao deixar a
 * tela, descendo ou subindo a página (`once: false`). Palavra é `inline-block`, mas o espaço entre elas fica livre
 * pra quebrar linha normalmente.
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
              className="inline-block will-change-[opacity,transform]"
              initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: false, amount: 0.4 }}
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
