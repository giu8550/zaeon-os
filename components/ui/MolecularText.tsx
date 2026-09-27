"use client";

import React from "react";
import { motion } from "framer-motion";

/**
 * Animação "molecular" de título: cada letra se materializa com blur + fade + um
 * leve deslocamento, em cascata (stagger). Dá a sensação de átomos se assentando
 * na palavra. Dispara quando o título entra na viewport (`whileInView`, once),
 * então cada seção anima na hora em que você rola até ela.
 *
 * Acessibilidade: o texto real fica no `aria-label` do container; as letras são
 * `aria-hidden`, então o leitor de tela lê a palavra inteira, não letra a letra.
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
  const chars = Array.from(text);
  return (
    <motion.span
      className={className}
      style={{ display: "inline-block" }}
      aria-label={text}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
      transition={{ staggerChildren: stagger, delayChildren: delay }}
    >
      {chars.map((c, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className="inline-block whitespace-pre will-change-[transform,filter,opacity]"
          variants={{
            hidden: { opacity: 0, filter: "blur(8px)", y: 6 },
            show: { opacity: 1, filter: "blur(0px)", y: 0 },
          }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {c === " " ? " " : c}
        </motion.span>
      ))}
    </motion.span>
  );
}
