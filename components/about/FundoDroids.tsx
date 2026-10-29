"use client";

/**
 * FundoDroids — o FUNDO do "Sobre nós": os droids passeando pelo Templo Cósmico (a cena: components/about/cenaFundoDroids),
 * no lugar da imagem PNG — que continua como reserva: aparece até a cena ficar pronta (e some em fade) e fica sozinha no
 * celular, em tela pequena, sem WebGL ou com "reduzir movimento". A cena só baixa no computador, com a página ociosa, e
 * para de desenhar fora da tela / com a aba escondida.
 */
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

function podeAnimar() {
  if (typeof window === "undefined") return false;
  const mm = (q: string) => window.matchMedia?.(q).matches ?? false;
  if (!mm("(pointer: fine)") || window.innerWidth < 1024 || mm("(prefers-reduced-motion: reduce)")) return false;
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}

export default function FundoDroids({ png, className = "" }: { /** a imagem de reserva (a de sempre) */ png: string; className?: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    const el = caixa.current; if (!el || !podeAnimar()) return;
    let cancelado = false, cena: import("./cenaFundoDroids").FundoDroids | null = null;
    let ro: ResizeObserver | null = null, io: IntersectionObserver | null = null, naTela = true;
    const avisar = () => cena?.visivel(naTela && !document.hidden);
    const iniciar = async () => {
      const { criarFundoDroids } = await import("./cenaFundoDroids");
      if (cancelado) return;
      // (o canvas fica ATRÁS da imagem: ela some em fade por cima dele; a cena um pouco apagada, como a imagem era)
      const cv = document.createElement("canvas"); cv.className = "absolute inset-0 block h-full w-full opacity-75"; el.prepend(cv);
      try { cena = criarFundoDroids(cv, { largura: el.clientWidth, altura: el.clientHeight }); }
      catch (e) { console.warn("[sobre] o fundo 3D não montou:", e); cv.remove(); return; }
      if (process.env.NODE_ENV !== "production") (window as unknown as { __fundoDroids?: unknown }).__fundoDroids = cena;
      ro = new ResizeObserver(() => cena?.tamanho(el.clientWidth, el.clientHeight)); ro.observe(el);
      io = new IntersectionObserver(([en]) => { naTela = !!en?.isIntersecting; avisar(); }, { threshold: 0 }); io.observe(el);
      document.addEventListener("visibilitychange", avisar);
      // (um respiro pros primeiros quadros antes de trocar a imagem pela cena)
      setTimeout(() => { if (!cancelado) setPronto(true); }, 600);
    };
    const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const id = ric ? ric(() => void iniciar(), { timeout: 2000 }) : window.setTimeout(() => void iniciar(), 800);
    return () => {
      cancelado = true;
      const cic = (window as unknown as { cancelIdleCallback?: (n: number) => void }).cancelIdleCallback; if (cic) cic(id); else clearTimeout(id);
      ro?.disconnect(); io?.disconnect(); document.removeEventListener("visibilitychange", avisar);
      cena?.destruir(); el.querySelector("canvas")?.remove();
    };
  }, []);

  return (
    <div ref={caixa} className={`absolute inset-0 ${className}`}>
      <Image src={png} alt="" aria-hidden fill priority className={`object-cover transition-opacity duration-1000 ${pronto ? "opacity-0" : "opacity-60"}`} />
    </div>
  );
}
