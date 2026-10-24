"use client";

/**
 * ZaeonDocumentos — a AVATAR da IA no lugar dos documentos do laboratório (out/2026). O dono: "os arquivos ficam na
 * seção do ícone da pasta; se jogarmos um arquivo na avatar, ela apenas reage lendo aquilo ou pensando; o tablet é uma
 * tela holográfica sem nada escrito; a avatar sempre tem animações; a troca de avatar é no seletor do canto superior
 * esquerdo, sem deixar a anterior presa em alguma tarefa" — e "a geração 3D não pode compartilhar essa thread".
 * Por isso este componente NÃO desenha nada: a cena inteira (components/research/avatarCena) roda num WEB WORKER
 * (avatar.worker) num OffscreenCanvas; aqui só o <canvas>, o tamanho/visibilidade e os sinais do chat viram mensagens.
 * Sem OffscreenCanvas com WebGL (navegador antigo), o retrato estático dela — nunca o 3D na thread principal.
 */
import { useEffect, useRef, useState } from "react";
import { EVT_ZAEON_ESCREVENDO, nomeDaPersona, type PersonaId } from "@/lib/research/zaeonEventos";
import type { DaCena, ParaCena } from "./avatarMensagens";

const CIANO = "#7fe8ff";
/** dá pra rodar a cena num worker? (OffscreenCanvas transferível + WebGL nele) */
function temOffscreen(): boolean {
  if (typeof window === "undefined" || typeof OffscreenCanvas === "undefined" || !("transferControlToOffscreen" in HTMLCanvasElement.prototype)) return false;
  try { return !!new OffscreenCanvas(1, 1).getContext("webgl2"); } catch { return false; }
}

export default function ZaeonDocumentos({ persona, lendo = false, reagir = 0 }: {
  persona: PersonaId;
  /** um documento em análise agora (ela lê) */
  lendo?: boolean;
  /** cresce a cada arquivo jogado NELA: ela reage (lê ou pensa) */
  reagir?: number;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const nome = nomeDaPersona(persona);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro" | "estatico">("carregando");
  const [escrevendo, setEscrevendo] = useState(false);
  const worker = useRef<Worker | null>(null);
  const enviar = (m: ParaCena, transferir?: Transferable[]) => worker.current?.postMessage(m, transferir ?? []);
  const personaRef = useRef(persona);

  // o WORKER: nasce com o canvas transferido e morre com o painel
  useEffect(() => {
    const el = caixa.current; if (!el) return;
    if (!temOffscreen()) { setEstado("estatico"); return; }
    // o canvas nasce AQUI (um por montagem: um canvas só se transfere uma vez)
    const cv = document.createElement("canvas"); cv.className = "absolute inset-0 block h-full w-full"; el.prepend(cv);
    const w = new Worker(new URL("./avatar.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e: MessageEvent<DaCena>) => {
      const m = e.data;
      if (m.tipo === "estado") setEstado(m.estado);
      else if (m.tipo === "diag" && process.env.NODE_ENV !== "production") (window as unknown as { __avatarDiag?: DaCena }).__avatarDiag = m;
    };
    w.onerror = (ev) => { console.warn("[avatar] o worker caiu:", ev.message); setEstado("erro"); };
    const off = cv.transferControlToOffscreen();
    w.postMessage({ tipo: "iniciar", canvas: off, largura: el.clientWidth, altura: el.clientHeight, dpr: window.devicePixelRatio || 1, persona: personaRef.current } satisfies ParaCena, [off]);
    // o TAMANHO e a VISIBILIDADE (fora da tela ou aba escondida: a cena para de desenhar)
    const ro = new ResizeObserver(() => w.postMessage({ tipo: "tamanho", largura: el.clientWidth, altura: el.clientHeight } satisfies ParaCena));
    ro.observe(el);
    let naTela = true;
    const avisar = () => w.postMessage({ tipo: "visivel", visivel: naTela && !document.hidden } satisfies ParaCena);
    const io = new IntersectionObserver(([en]) => { naTela = !!en?.isIntersecting; avisar(); }, { threshold: 0.01 }); io.observe(el);
    document.addEventListener("visibilitychange", avisar);
    if (process.env.NODE_ENV !== "production") (window as unknown as { __avatarWorker?: Worker }).__avatarWorker = w;
    return () => {
      ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", avisar);
      w.postMessage({ tipo: "fim" } satisfies ParaCena); setTimeout(() => w.terminate(), 500); worker.current = null; cv.remove();
    };
  }, []);

  // QUEM está no painel (a troca: o worker solta o corpo anterior na hora)
  useEffect(() => { personaRef.current = persona; enviar({ tipo: "persona", persona }); }, [persona]);
  // o que ela está fazendo
  useEffect(() => { enviar({ tipo: "sinais", lendo, escrevendo }); }, [lendo, escrevendo]);
  useEffect(() => {
    const ev = (e: Event) => setEscrevendo(!!(e as CustomEvent).detail);
    window.addEventListener(EVT_ZAEON_ESCREVENDO, ev); return () => window.removeEventListener(EVT_ZAEON_ESCREVENDO, ev);
  }, []);
  const reagiu = useRef(reagir);
  useEffect(() => { if (reagir !== reagiu.current) { reagiu.current = reagir; enviar({ tipo: "reagir" }); } }, [reagir]);

  return (
    <div ref={caixa} className="relative h-full min-h-[320px] w-full overflow-hidden" style={{ background: `radial-gradient(ellipse 80% 60% at 50% 45%, ${CIANO}14, transparent 70%)` }}>
      {estado === "estatico" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/avatars/${persona}/idle.webp`} alt={nome} className="absolute inset-x-0 bottom-0 mx-auto h-[88%] w-auto object-contain object-bottom" />
      )}
      <button type="button" aria-label={`Falar com a ${nome}`} title={nome} onClick={() => enviar({ tipo: "gesto" })} className="absolute inset-x-[18%] bottom-[20%] top-[2%] z-[1] cursor-pointer rounded-full" />
      {escrevendo && <p className="pointer-events-none absolute inset-x-0 bottom-3 z-[2] text-center text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200/70">a {nome} está escrevendo…</p>}
      {(estado === "carregando" || estado === "erro") && <p className="pointer-events-none absolute inset-x-0 bottom-3 z-[2] text-center text-[9px] font-black uppercase tracking-[0.2em] text-white/35">{estado === "erro" ? `a ${nome} não carregou` : `a ${nome} está chegando…`}</p>}
    </div>
  );
}
