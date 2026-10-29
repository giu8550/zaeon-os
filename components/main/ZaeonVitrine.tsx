"use client";

/**
 * ZaeonVitrine — a ZAEON no hero da landing fazendo o que ela faz nas conversas (out/2026, o dono: "uma animação que
 * use as poses que ela faz durante as conversas — pensa, analisa, pesquisa, gera um output, alimenta a árvore — mas
 * aqui encaixando blueprints de entregáveis: foguete, motor, PCB, fontes, bateria, energia solar… isso dá fluidez e
 * dinamismo na tela inicial; ela gera, descansa e continua gerando").
 * A MESMA cena da avatar do laboratório (components/research/avatarCena — o open-annie com os clipes CC0, as sequências
 * da geração) no MODO VITRINE: o roteiro em laço de lib/research/roteiroVitrine e os blueprints de
 * components/research/blueprints. Roda num WEB WORKER (OffscreenCanvas): o 3D não divide a thread com a página.
 * Leve com a página: só no computador (ponteiro fino, tela a partir de 768 px), depois da intro, com a página ociosa;
 * fora da tela, para de desenhar. Sem OffscreenCanvas com WebGL: o retrato estático dela.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { DaCena, ParaCena } from "@/components/research/avatarMensagens";

/** o que ela fala quando clicam nela: as 3 saudações + as 10 falas da landing (scripts/avatars/gerar-saudacao.mjs
 *  zaeon-landing — o dono: "ela tem que falar outras frases, e não apenas essa") */
const VOZES = [
  ...[1, 2, 3].map((n) => `/avatars/zaeon/voz/saudacao-0${n}.wav`),
  ...Array.from({ length: 10 }, (_, i) => `/avatars/zaeon/voz/fala-${String(i + 1).padStart(2, "0")}.wav`),
];
/** um SACO embaralhado: passa por todas antes de repetir (e a primeira da volta nova não é a última da anterior) */
function sacoDeFalas() {
  let saco: string[] = [], ultima = "";
  return () => {
    if (!saco.length) { saco = [...VOZES].sort(() => Math.random() - 0.5); if (saco[0] === ultima) saco.push(saco.shift()!); }
    ultima = saco.shift()!; return ultima;
  };
}
/** o enquadramento fechado: do peito pra cima (m a partir do topo da cabeça) */
const QUADRO = 0.66;

function podeMostrar() {
  if (typeof window === "undefined") return false;
  return (window.matchMedia?.("(pointer: fine)").matches ?? false) && window.innerWidth >= 768;
}
function temOffscreen(): boolean {
  if (typeof window === "undefined" || typeof OffscreenCanvas === "undefined" || !("transferControlToOffscreen" in HTMLCanvasElement.prototype)) return false;
  try { return !!new OffscreenCanvas(1, 1).getContext("webgl2"); } catch { return false; }
}

export default function ZaeonVitrine({ className = "" }: { className?: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const worker = useRef<Worker | null>(null);
  const [podeIniciar, setPodeIniciar] = useState(false);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro" | "estatico">("carregando");
  const audio = useRef<{ ctx: AudioContext; an: AnalyserNode; buf: Uint8Array } | null>(null);
  const falando = useRef(false);
  const proximaFala = useRef(sacoDeFalas());

  // CLICAR NELA: um gesto e a voz dela (uma saudação), com a boca no volume — o volume vai pro worker a cada quadro
  const falar = useCallback(async () => {
    const w = worker.current; if (!w || falando.current) return;
    w.postMessage({ tipo: "gesto" } satisfies ParaCena);
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audio.current) { const ctx = new Ctx(), an = ctx.createAnalyser(); an.fftSize = 512; an.connect(ctx.destination); audio.current = { ctx, an, buf: new Uint8Array(an.fftSize) }; }
      const { ctx, an, buf } = audio.current; if (ctx.state === "suspended") await ctx.resume();
      const el = new Audio(proximaFala.current());
      const src = ctx.createMediaElementSource(el); src.connect(an);
      falando.current = true;
      const medir = () => {
        if (!falando.current) return;
        an.getByteTimeDomainData(buf as Uint8Array<ArrayBuffer>); let s = 0; for (const v of buf) s += Math.abs(v - 128);
        worker.current?.postMessage({ tipo: "fala", v: Math.min(1, s / buf.length / 18), falando: true } satisfies ParaCena);
        requestAnimationFrame(medir);
      };
      el.onended = () => { falando.current = false; src.disconnect(); worker.current?.postMessage({ tipo: "fala", v: 0, falando: false } satisfies ParaCena); };
      await el.play(); requestAnimationFrame(medir);
    } catch { falando.current = false; }
  }, []);
  useEffect(() => () => { falando.current = false; void audio.current?.ctx.close(); audio.current = null; }, []);

  // REGRA: o 3D (~19 MB de VRM + movimento) só começa depois da intro, com a página ociosa
  useEffect(() => {
    if (!podeMostrar()) { setEstado("estatico"); return; }
    let cancelado = false, id = 0;
    const t = window.setTimeout(() => {
      const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      const ok = () => { if (!cancelado) setPodeIniciar(true); };
      id = ric ? ric(ok, { timeout: 2500 }) : window.setTimeout(ok, 800);
    }, 700);
    return () => { cancelado = true; clearTimeout(t); const cic = (window as unknown as { cancelIdleCallback?: (n: number) => void }).cancelIdleCallback; if (cic) cic(id); else clearTimeout(id); };
  }, []);

  useEffect(() => {
    const el = caixa.current; if (!el || !podeIniciar) return;
    if (!temOffscreen()) { setEstado("estatico"); return; }
    const cv = document.createElement("canvas"); cv.className = "absolute inset-0 block h-full w-full"; el.prepend(cv);
    const w = new Worker(new URL("../research/avatar.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e: MessageEvent<DaCena>) => {
      const m = e.data;
      if (m.tipo === "estado") setEstado(m.estado);
      else if (m.tipo === "diag" && process.env.NODE_ENV !== "production") (window as unknown as { __vitrineDiag?: DaCena }).__vitrineDiag = m;
    };
    w.onerror = (ev) => { console.warn("[vitrine] o worker caiu:", ev.message); setEstado("erro"); };
    const off = cv.transferControlToOffscreen();
    w.postMessage({ tipo: "iniciar", canvas: off, largura: el.clientWidth, altura: el.clientHeight, dpr: window.devicePixelRatio || 1, persona: "zaeon", vitrine: true, quadro: QUADRO } satisfies ParaCena, [off]);
    const ro = new ResizeObserver(() => w.postMessage({ tipo: "tamanho", largura: el.clientWidth, altura: el.clientHeight } satisfies ParaCena));
    ro.observe(el);
    let naTela = true;
    const avisar = () => w.postMessage({ tipo: "visivel", visivel: naTela && !document.hidden } satisfies ParaCena);
    const io = new IntersectionObserver(([en]) => { naTela = !!en?.isIntersecting; avisar(); }, { threshold: 0.01 }); io.observe(el);
    document.addEventListener("visibilitychange", avisar);
    // o CURSOR: em coordenadas do canvas (−1..1; passa disso fora dele), no máximo um aviso por quadro
    let pendente: { x: number; y: number } | null = null, raf = 0;
    const mexe = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pendente = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1) };
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (pendente) w.postMessage({ tipo: "olhar", x: Math.max(-8, Math.min(8, pendente.x)), y: Math.max(-6, Math.min(6, pendente.y)) } satisfies ParaCena); });
    };
    const sai = () => w.postMessage({ tipo: "olhar", x: null, y: null } satisfies ParaCena);
    window.addEventListener("pointermove", mexe, { passive: true }); document.documentElement.addEventListener("pointerleave", sai);
    if (process.env.NODE_ENV !== "production") (window as unknown as { __vitrineWorker?: Worker }).__vitrineWorker = w;
    return () => {
      ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", avisar);
      window.removeEventListener("pointermove", mexe); document.documentElement.removeEventListener("pointerleave", sai); if (raf) cancelAnimationFrame(raf);
      w.postMessage({ tipo: "fim" } satisfies ParaCena); setTimeout(() => w.terminate(), 500); worker.current = null; cv.remove();
    };
  }, [podeIniciar]);

  return (
    <div ref={caixa} className={`relative ${className}`}>
      {(estado === "estatico" || !podeIniciar || estado === "erro") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/avatars/zaeon/idle.webp" alt="Zaeon" className="absolute inset-x-0 bottom-0 mx-auto h-[86%] w-auto object-contain object-bottom opacity-90" />
      )}
      {/* clicar NELA (o miolo do card, onde ela está): ela fala */}
      {estado === "pronto" && (
        <button type="button" onClick={() => void falar()} aria-label="Falar com a Zaeon" title="Falar com a Zaeon" className="pointer-events-auto absolute inset-x-[32%] bottom-[8%] top-[6%] z-[1] cursor-pointer rounded-[40%]" />
      )}
    </div>
  );
}
