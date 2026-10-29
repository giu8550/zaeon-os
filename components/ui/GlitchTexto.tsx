"use client";

/**
 * GlitchTexto — o glitch do sub-header: as letras se revelam passando por "Zaeon" EM CHINÊS — 泽安, como no locale
 * zh (o dono, out/2026: "coloque todos para serem sempre 'zaeon'… coloca zaeon em chinês") — o trecho ainda não
 * revelado repete 泽安, deslizando a cada quadro, até assentar
 * na frase; e uma PALAVRA que gira (ideias → estudos → trabalhos → pesquisas) passando pelo mesmo ruído a cada
 * troca. Por cima, o recorte holográfico da casa (`.cyber-glitch`, definido no hero).
 *
 * Acessibilidade: o texto real fica em `aria-label`/sr-only; o ruído é aria-hidden. prefers-reduced-motion →
 * sem scramble (a palavra ainda troca, com fade).
 */
import { useEffect, useRef, useState } from "react";

const RUIDO = "泽安";
/** o ideograma de 泽安 na posição `i` (deslocado por `passo`: o ruído desliza) */
const letra = (i: number, passo: number) => RUIDO[(i + passo) % RUIDO.length]!;

function ruido(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += letra(i, 0);
  return s;
}

/** anima `alvo` a partir de ideogramas: cada letra assenta na ordem, em ~`ms` */
function useScramble(alvo: string, ms: number, ativo: boolean) {
  const [vis, setVis] = useState(ativo ? ruido(alvo.length) : alvo);
  const raf = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    if (!ativo) { setVis(alvo); return; }
    const t0 = performance.now();
    let quadro = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const fixas = Math.floor(k * alvo.length);
      let s = alvo.slice(0, fixas);
      quadro++;
      for (let i = fixas; i < alvo.length; i++) s += alvo[i] === " " ? " " : letra(i - fixas, Math.floor(quadro / 3));
      setVis(s);
      if (k < 1) raf.current = requestAnimationFrame(passo);
    };
    raf.current = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf.current);
  }, [alvo, ms, ativo]);
  return vis;
}

export default function GlitchTexto({ texto, palavras, className = "", classePalavra = "", delay = 0, intervalo = 2600 }: {
  texto: string;
  /** a palavra que gira depois do texto (ex.: ideias, estudos…) */
  palavras?: string[];
  className?: string;
  classePalavra?: string;
  /** segundos antes de começar a revelar */
  delay?: number;
  /** ms entre trocas de palavra */
  intervalo?: number;
}) {
  const [reduzido, setReduzido] = useState(false);
  const [comecou, setComecou] = useState(false);
  const [i, setI] = useState(0);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduzido(mq.matches);
    sync(); mq.addEventListener("change", sync);
    const t = setTimeout(() => setComecou(true), delay * 1000);
    return () => { mq.removeEventListener("change", sync); clearTimeout(t); };
  }, [delay]);
  useEffect(() => {
    if (!palavras || palavras.length < 2 || !comecou) return;
    const t = setInterval(() => setI((x) => (x + 1) % palavras.length), intervalo);
    return () => clearInterval(t);
  }, [palavras, intervalo, comecou]);

  const ativo = comecou && !reduzido;
  const frase = useScramble(texto, 1100, ativo);
  const palavra = useScramble(palavras?.[i] ?? "", 700, ativo);
  const completo = `${texto}${palavras?.length ? ` ${palavras[i]}.` : ""}`;

  return (
    <span className={className} aria-label={completo} role="text">
      <span className="sr-only">{completo}</span>
      <span aria-hidden="true" className={`cyber-glitch ${comecou ? "" : "opacity-0"} transition-opacity duration-300`} data-text={frase}>
        {frase}
      </span>
      {palavras?.length ? (
        <>
          {" "}
          <span aria-hidden="true" className={`inline-block min-w-[6ch] ${classePalavra} ${comecou ? "" : "opacity-0"} transition-opacity duration-300`}>
            {palavra}.
          </span>
        </>
      ) : null}
    </span>
  );
}
