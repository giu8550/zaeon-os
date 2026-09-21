"use client";

/**
 * MagazineAnswerView — a resposta da Aura como página de revista (Sala de Estudos).
 *
 * Variante de renderização do MESMO `StructuredAnswer` que o StructuredAnswerView
 * desenha; não substitui nada. Se qualquer coisa falhar aqui, quem chama cai no
 * renderer antigo (ver `podeVirarRevista` + try/catch no StudyCoworkChat).
 *
 * Divisão de trabalho, que é o ponto do plano:
 *   • o harness decide O QUE dizer, quais termos importam, qual artefato entra;
 *   • esta camada decide ONDE cada letra nasce — e não raciocina sobre nada.
 *
 * Como o texto e o artefato convivem: o artefato continua sendo o componente React de
 * sempre (MoleculeView e cia), posicionado em cima do canvas; o motor só reserva o
 * espaço dele como obstáculo e o texto flui em volta. Nada é redesenhado dentro do
 * canvas — seria refazer o Studio inteiro em 2D.
 *
 * Acessibilidade: o canvas é `aria-hidden` e existe SEMPRE uma cópia em DOM do texto.
 * Durante o stream ela fica invisível (leitor de tela lê); no fim, o canvas some e a
 * cópia assume, posicionada palavra a palavra nas MESMAS coordenadas — aí o texto é
 * selecionável e encontrável pelo Ctrl+F.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { StructuredAnswer } from "@/lib/agent/contracts";
import StudioBlock, { type StudioBlockData } from "@/components/studio/StudioBlock";
import MoleculeView from "@/components/studio/MoleculeView";
import { agendarChegada, chegadaInstantanea, DURACAO_LETRA } from "@/lib/magazine/chegada";
import { familiaDaVariavel, fonteCanvas, aplicarFonte, QUEDA_CORPO, QUEDA_DISPLAY } from "@/lib/magazine/fontes";
import {
  montarLayout, obstaculoCapitular, obstaculoArtefato, topoDaLinha, baselineNaLinha,
  type Obstaculo, type Resultado, type Metricas,
} from "@/lib/magazine/layout";
import { medirTexto, emParagrafos, contarPalavras, normalizar, type TextoMedido } from "@/lib/magazine/medir";

/* ─────────────────────────── critério de ativação (§10) ─────────────────────────── */

/**
 * Piso, não meta. 120 palavras deixou o Modo Revista invisível; 70 deixou ele
 * INTERMITENTE, que é pior — a mesma sala mudava de cara a cada resposta e parecia
 * defeito. Agora só a resposta de uma linha ("pode ser", "isso mesmo") fica no balão;
 * o resto é sempre página. Consistência vale mais que a página perfeita.
 */
export const MIN_PALAVRAS_REVISTA = 25;

/**
 * Com artefato o piso cai, mas não some. `temArtefato ||` sozinho mandava pra página
 * QUALQUER resposta com molécula, inclusive "A cafeína é um alcaloide." — e uma página
 * de revista com cinco palavras não é uma página, é uma legenda perdida. Doze palavras
 * é o mínimo pra existir texto contornando a figura.
 */
export const MIN_PALAVRAS_COM_ARTEFATO = 12;

/**
 * O corpo da página. `desenvolvimento` é opcional no contrato e SÓ o intent
 * `explicar_conceito` o exige — `conversa` e `duvida_rapida` mandam apenas `nucleo`.
 * Exigir desenvolvimento deixava o Modo Revista praticamente desligado na prática.
 */
export function corpoDaResposta(a: StructuredAnswer | undefined): string {
  return (a?.desenvolvimento?.trim() || a?.nucleo?.trim() || "");
}

export function podeVirarRevista(a: StructuredAnswer | undefined, temArtefato: boolean): boolean {
  const corpo = corpoDaResposta(a);
  if (!corpo) return false;
  const palavras = contarPalavras(corpo);
  return palavras >= (temArtefato ? MIN_PALAVRAS_COM_ARTEFATO : MIN_PALAVRAS_REVISTA);
}

/* ─────────────────────────────────── tipografia ─────────────────────────────────── */

// Para o DOM (CSS de verdade resolve `var()` sem problema).
const FAMILIA_CORPO = 'var(--font-revista-corpo), Georgia, "Times New Roman", serif';
const FAMILIA_DISPLAY = 'var(--font-revista-display), Georgia, serif';

/**
 * Para o CANVAS, que NÃO resolve `var()` — ver lib/magazine/fontes.ts. Resolvidas uma vez
 * por render a partir do <html>; se a custom property ainda não existe (SSR, fonte não
 * carregada), cai em Georgia e a medição continua honesta, só com outra fonte.
 */
function familiasDoCanvas() {
  return {
    corpo: familiaDaVariavel("--font-revista-corpo", QUEDA_CORPO),
    display: familiaDaVariavel("--font-revista-display", QUEDA_DISPLAY),
  };
}

function metricasPara(
  largura: number,
  fam: { corpo: string; display: string } = familiasDoCanvas(),
): Metricas & { corpo: string; enfase: string; capitular: string } {
  const tamanho = largura < 560 ? 17 : 19;
  const entrelinha = Math.round(tamanho * 1.6);
  return {
    tamanho,
    entrelinha,
    espaco: 0, // preenchido pela medição
    corpo: fonteCanvas(400, tamanho, fam.corpo),
    enfase: fonteCanvas(600, tamanho, fam.corpo),
    capitular: fonteCanvas(600, entrelinha * 3.05, fam.display),
  };
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

type Cores = { tinta: string; suave: string; ciano: string; marca: string };

function lerCores(el: HTMLElement): Cores {
  const s = getComputedStyle(el);
  // A tinta sai da cor herdada: assim o texto do canvas segue o tema do app sem
  // precisar de token novo. O resto tem par claro/escuro.
  const escuro = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return {
    tinta: s.color || (escuro ? "#E4ECEA" : "#18222D"),
    suave: escuro ? "#8FA1AD" : "#5C6B78",
    ciano: escuro ? "#3FD3E6" : "#0B9FB3",
    marca: escuro ? "rgba(242,210,60,.26)" : "rgba(242,210,60,.55)",
  };
}

/* ────────────────────────────────── componente ────────────────────────────────── */

export default function MagazineAnswerView({
  answer,
  streaming = false,
  recemChegada = false,
  artefato,
  onNext,
  agente = "Aura",
}: {
  answer: StructuredAnswer;
  streaming?: boolean;
  /** Resposta que acabou de chegar (o `fresh` da mensagem) → materializa as letras. */
  recemChegada?: boolean;
  artefato?: StudioBlockData | null;
  onNext?: (passo: string) => void;
  agente?: string;
}) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const cv = useRef<HTMLCanvasElement | null>(null);
  const slotArtefato = useRef<HTMLDivElement | null>(null);

  const [largura, setLargura] = useState(0);
  const [assentado, setAssentado] = useState(false);
  const [dica, setDica] = useState<{ x: number; y: number; termo: string; def: string } | null>(null);

  const medidoRef = useRef<TextoMedido | null>(null);
  /** Altura real do cartão do artefato, medida no DOM (não chutada). */
  const alturaArtefatoRef = useRef(0);
  const layoutRef = useRef<Resultado | null>(null);
  const nascimentoRef = useRef<Float64Array | null>(null);
  const coresRef = useRef<Cores | null>(null);
  const [alturaBloco, setAlturaBloco] = useState(0);
  const [palavrasDom, setPalavrasDom] = useState<Resultado["palavras"]>([]);

  const semMovimento = useMemo(
    () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const paragrafos = useMemo(() => emParagrafos(corpoDaResposta(answer)), [answer]);
  /** Molécula tem tratamento próprio: vira figura, não cartão. */
  const ehMolecula = artefato?.studioKind === "molecule" && !!artefato?.data?.sdf;
  // Quando o corpo JÁ É o núcleo, mostrar o núcleo de novo em cima seria eco.
  const temLinhaFina = !!answer.desenvolvimento?.trim() && !!answer.nucleo?.trim();
  const conceitos = useMemo(() => answer.conceitos ?? [], [answer.conceitos]);

  /* ── medir + posicionar ──────────────────────────────────────────────────────── */
  const recalcular = useCallback(() => {
    const canvas = cv.current;
    const caixa = wrap.current;
    if (!canvas || !caixa) return;
    const W = Math.round(caixa.clientWidth);
    if (W <= 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const m = metricasPara(W);
    const medido = medirTexto(ctx, paragrafos, { corpo: m.corpo, enfase: m.enfase }, conceitos);
    medidoRef.current = medido;

    const metricas: Metricas = { tamanho: m.tamanho, entrelinha: m.entrelinha, espaco: medido.espaco };
    const obstaculos: Obstaculo[] = [];

    // capitular
    if (medido.capitular) {
      aplicarFonte(ctx, m.capitular, QUEDA_DISPLAY);
      obstaculos.push(obstaculoCapitular(ctx.measureText(medido.capitular).width + 12, metricas));
    }

    // artefato: mora na direita, mais ou menos na altura da 7ª linha, como na referência
    // DUAS FORMAS, porque são duas coisas diferentes.
    //
    // Molécula entra NUA (sem o cartão do Studio): é um quadrado com a estrutura girando
    // e uma legenda fina dentro. Aí o círculo é honesto e o texto contorna de verdade.
    // Foi fingir que o CARTÃO era redondo que quebrou a página antes — cartão tem
    // cabeçalho, botões e ficha, e nada disso cabe num círculo.
    //
    // Qualquer outro artefato continua sendo cartão, e cartão é retângulo: a altura vem
    // medida do DOM (ResizeObserver abaixo), nunca chutada.
    // PASSO 1 — quanto de página o texto ocupa SOZINHO.
    //
    // O artefato tinha tamanho e posição fixos (7ª linha, raio 150px) enquanto o texto
    // tem o tamanho que tiver. Numa resposta curta o resultado era três linhas de texto,
    // um buraco de 17 linhas e a molécula boiando no meio dele — nada "quebrado", só
    // feio de um jeito que parece quebrado. A figura agora é medida CONTRA o texto.
    const alturaTexto = montarLayout(
      medido.paragrafos.map((palavras) => ({ palavras, completo: !streaming })),
      obstaculos,
      W,
      metricas,
    ).altura;
    const LINHA_DE_REFERENCIA = 7; // a 7ª linha, como na página de revista que serviu de modelo

    let caixaArtefato: { x: number; y: number; w: number; h: number } | null = null;
    if (artefato) {
      const largo = W < 560;
      if (ehMolecula && !largo) {
        // Raio: o teto de sempre, mas nunca maior que o texto que ele acompanha. O piso
        // de 64px impede o outro extremo — uma molécula do tamanho de uma miniatura.
        const r = Math.round(clamp(alturaTexto * 0.45, 64, Math.min(W * 0.21, 150)));
        const cx = clamp(W * 0.7, r, W - r);
        // Texto curto: a figura acompanha o texto (centro no meio dele). Texto longo:
        // a 7ª linha de sempre, que é onde ela fica bonita numa página cheia.
        const cy = alturaTexto < metricas.entrelinha * LINHA_DE_REFERENCIA * 1.5
          ? Math.max(r, alturaTexto / 2)
          : Math.max(r, metricas.entrelinha * LINHA_DE_REFERENCIA);
        obstaculos.push(obstaculoArtefato(cx, cy, r, metricas));
        caixaArtefato = { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
      } else {
        // Coluna estreita: o artefato ocupa a largura toda (§12/Q5). Contornar num
        // corredor de 300px deixaria frestas de três letras dos dois lados.
        const w = largo ? W : Math.round(W * 0.42);
        // Molécula quadrada era `h = w` — num celular, um quadrado de 420px. Passa a ter
        // teto, e o teto também respeita o texto.
        const h = ehMolecula
          ? Math.round(clamp(alturaTexto * 0.9, 160, Math.min(w, 320)))
          : Math.max(alturaArtefatoRef.current || 0, 180);
        const x = largo ? 0 : W - w;
        // Nunca começa depois do fim do texto: senão sobra um vão entre um e outro.
        const y = Math.min(metricas.entrelinha * (largo ? 6 : 5), Math.max(metricas.entrelinha, alturaTexto));
        obstaculos.push({ tipo: "retangulo", x, y, w, h, pad: metricas.tamanho * 0.9 });
        caixaArtefato = { x, y, w, h };
      }
    }

    const res = montarLayout(
      medido.paragrafos.map((palavras) => ({ palavras, completo: !streaming })),
      obstaculos,
      W,
      metricas,
    );
    layoutRef.current = res;

    const fundoArtefato = caixaArtefato ? caixaArtefato.y + caixaArtefato.h : 0;
    const altura = Math.ceil(Math.max(res.altura, fundoArtefato + 12));
    setAlturaBloco(altura);
    setLargura(W);
    setPalavrasDom(res.palavras);

    // canvas em DPR, com a MESMA transformação usada na medição
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(altura * dpr);
    canvas.style.height = `${altura}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // posiciona o componente do artefato por cima
    if (slotArtefato.current && caixaArtefato) {
      const st = slotArtefato.current.style;
      st.left = `${caixaArtefato.x}px`;
      st.top = `${caixaArtefato.y}px`;
      st.width = `${caixaArtefato.w}px`;
      st.display = "block";
    } else if (slotArtefato.current) {
      slotArtefato.current.style.display = "none";
    }

    // vetor de nascimento dos grafemas
    const total = medido.totalGrafemas;
    const anterior = nascimentoRef.current;
    if (!anterior || anterior.length !== total) {
      const novo = new Float64Array(total).fill(-1);
      if (anterior) novo.set(anterior.subarray(0, Math.min(anterior.length, total)));
      nascimentoRef.current = novo;
    }
  }, [paragrafos, conceitos, artefato, ehMolecula, streaming]);

  /* ── boot: fontes e observer montam UMA vez ─────────────────────────────────── */
  // `recalcular` muda a cada token do stream. Se o boot dependesse dele, a corrida das
  // fontes e o ResizeObserver seriam refeitos a cada letra que chega.
  const recalcularRef = useRef(recalcular);
  recalcularRef.current = recalcular;
  const [fontesProntas, setFontesProntas] = useState(false);

  useEffect(() => {
    let vivo = true;
    coresRef.current = wrap.current ? lerCores(wrap.current) : null;

    (async () => {
      try {
        const fam = familiasDoCanvas();
        const fontes = (document as any)?.fonts;
        if (fontes?.load) {
          await Promise.race([
            Promise.all([
              // Resolvidas: `document.fonts.load` usa o MESMO parser do ctx.font e
              // rejeitava `var()` do mesmo jeito calado — a espera nunca esperou nada.
              fontes.load(fonteCanvas(400, 19, fam.corpo)),
              fontes.load(fonteCanvas(600, 19, fam.corpo)),
              fontes.load(fonteCanvas(600, 90, fam.display)),
            ]),
            new Promise((r) => setTimeout(r, 2000)),
          ]);
        }
      } catch { /* segue com a fonte que houver */ }
      if (vivo) setFontesProntas(true);
    })();

    const ro = new ResizeObserver(() => recalcularRef.current());
    if (wrap.current) ro.observe(wrap.current);
    // a fonte pode chegar depois do timeout: re-medir uma vez quando assentar de vez
    (document as any)?.fonts?.ready?.then?.(() => { if (vivo) recalcularRef.current(); });

    return () => { vivo = false; ro.disconnect(); };
  }, []);

  /* ── mede o cartão do artefato e refaz o layout quando ele cresce ───────────── */
  useEffect(() => {
    const slot = slotArtefato.current;
    if (!slot || !artefato || ehMolecula) { alturaArtefatoRef.current = 0; return; }
    const ro = new ResizeObserver(() => {
      const h = Math.ceil(slot.getBoundingClientRect().height);
      // Só refaz quando muda de verdade: evita laço de medida → layout → medida.
      if (h > 0 && Math.abs(h - alturaArtefatoRef.current) > 2) {
        alturaArtefatoRef.current = h;
        recalcularRef.current();
      }
    });
    ro.observe(slot);
    return () => ro.disconnect();
  }, [artefato, ehMolecula]);

  /* ── re-medir quando texto, conceitos ou artefato mudam ─────────────────────── */
  useEffect(() => {
    if (fontesProntas) recalcular();
  }, [fontesProntas, recalcular]);

  /* ── chegada das letras ──────────────────────────────────────────────────────── */
  //
  // O DETALHE QUE FAZIA A RESPOSTA APARECER DE SOCO: a resposta estruturada NÃO chega
  // token a token. O harness manda `@@STRUCTURED@@` com o JSON inteiro no fim do stream,
  // então `streaming` já é false quando o texto chega aqui — e o caminho "sem stream"
  // acendia tudo de uma vez. A materialização existia e nunca rodava.
  //
  // Agora quem manda é `recemChegada` (o `fresh` da mensagem): resposta nova se
  // materializa mesmo tendo chegado pronta. Só o histórico nasce instantâneo.
  useEffect(() => {
    const total = medidoRef.current?.totalGrafemas ?? 0;
    const nasc = nascimentoRef.current;
    if (!nasc || !total) return;

    const animar = (recemChegada || streaming) && !semMovimento;
    if (!animar) {
      chegadaInstantanea(nasc);
      setAssentado(true);
      return;
    }

    // Toda a aritmética (e as duas armadilhas dela) mora em lib/magazine/chegada.ts,
    // que é puro e tem teste. Aqui só se obedece ao relógio que ela devolve.
    const fim = agendarChegada(nasc, performance.now());
    const t = setTimeout(() => setAssentado(true), fim);
    return () => clearTimeout(t);
  }, [palavrasDom, streaming, recemChegada, semMovimento]);

  /* ── desenho ─────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (assentado) return; // canvas some; o DOM selecionável assume
    let raf = 0;
    const desenhar = (agora: number) => {
      const canvas = cv.current;
      const res = layoutRef.current;
      const nasc = nascimentoRef.current;
      const cores = coresRef.current ?? (wrap.current ? lerCores(wrap.current) : null);
      const medido = medidoRef.current;
      if (canvas && res && nasc && cores && medido) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const m = metricasPara(largura || canvas.clientWidth);
          ctx.clearRect(0, 0, largura, alturaBloco);

          // capitular
          if (medido.capitular && nasc[0] >= 0 && agora >= nasc[0]) {
            const e = semMovimento ? 1 : ease(clamp((agora - nasc[0]) / 700, 0, 1));
            ctx.globalAlpha = e;
            aplicarFonte(ctx, m.capitular, QUEDA_DISPLAY);
            ctx.fillStyle = cores.ciano;
            ctx.fillText(medido.capitular, 0, 2 * m.entrelinha + baselineNaLinha(m) + (1 - e) * 16);
            ctx.globalAlpha = 1;
          }

          // marca-texto dos conceitos, crescendo da esquerda
          for (const mk of res.marcas) {
            const t = nasc[mk.gi];
            if (t < 0 || agora < t) continue;
            const e = semMovimento ? 1 : ease(clamp((agora - t - 120) / 520, 0, 1));
            ctx.fillStyle = cores.marca;
            ctx.fillRect(mk.x, mk.y, mk.w * e, mk.h);
          }

          // glifos
          let fonteAtual = "";
          for (const g of res.glifos) {
            const t = nasc[g.gi];
            if (t < 0 || agora < t) continue;
            const e = semMovimento ? 1 : ease(clamp((agora - t) / DURACAO_LETRA, 0, 1));
            const f = g.enfase ? m.enfase : m.corpo;
            if (f !== fonteAtual) { aplicarFonte(ctx, f, QUEDA_CORPO); fonteAtual = f; }
            ctx.globalAlpha = 0.25 + e * 0.75;
            ctx.fillStyle = e < 1 ? cores.ciano : cores.tinta;
            ctx.fillText(g.ch, g.x, g.y + (1 - e) * 9);
          }
          ctx.globalAlpha = 1;
        }
      }
      raf = requestAnimationFrame(desenhar);
    };
    raf = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(raf);
  }, [assentado, streaming, largura, alturaBloco, semMovimento]);

  /* ── glossário no hover (e como lista acessível, mais abaixo) ────────────────── */
  // `conceitos` é só uma lista de termos — o contrato não traz definição. Em vez de
  // inventar uma, procuramos entre as evidências alguma afirmação que fale daquele
  // termo. Não achou, a dica diz o que é honesto dizer: que a Aura destacou ali.
  const definicoes = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const c of conceitos) {
      const chave = normalizar(c);
      const achou = (answer.evidencia ?? []).find((e) => normalizar(e.claim).includes(chave));
      if (achou) mapa.set(chave, achou.claim);
    }
    return mapa;
  }, [conceitos, answer.evidencia]);

  const aoMover = useCallback((ev: MouseEvent<HTMLDivElement>) => {
    const res = layoutRef.current;
    const caixa = wrap.current;
    if (!res || !caixa) return;
    const r = caixa.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;
    const achou = res.marcas.find((mk) => x >= mk.x && x <= mk.x + mk.w && y >= mk.y && y <= mk.y + mk.h);
    if (!achou) { setDica(null); return; }
    setDica({
      x: clamp(achou.x, 0, Math.max(0, largura - 260)),
      y: achou.y + achou.h + 8,
      termo: achou.chave,
      def: definicoes.get(achou.chave) || "Conceito destacado pela Aura nesta resposta.",
    });
  }, [definicoes, largura]);

  const mCor = metricasPara(largura || 900);

  return (
    <div className="z-revista flex flex-col gap-4">
      {/* cabeçalho editorial */}
      <div className="flex flex-col gap-1">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-white/45 font-bold">
          Por {agente}, na Sala de Estudos
        </p>
        {temLinhaFina && (
          <p
            className="text-slate-800 dark:text-white/90 leading-snug"
            style={{ fontFamily: FAMILIA_DISPLAY, fontWeight: 300, fontSize: "clamp(19px,2.4vw,26px)", maxWidth: "34ch" }}
          >
            {answer.nucleo}
          </p>
        )}
      </div>

      {/* corpo: canvas animado + artefato por cima + DOM assentado no fim */}
      <div
        ref={wrap}
        className="relative"
        style={{ minHeight: alturaBloco || undefined }}
        onMouseMove={aoMover}
        onMouseLeave={() => setDica(null)}
      >
        <canvas
          ref={cv}
          aria-hidden="true"
          className="block w-full transition-opacity duration-500"
          style={{ opacity: assentado ? 0 : 1, touchAction: "pan-y", pointerEvents: "none" }}
        />

        {/* Texto em DOM: invisível durante o stream (só pro leitor de tela), visível e
            selecionável quando assenta. Mesmas coordenadas do canvas. */}
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            opacity: assentado ? 1 : 0,
            pointerEvents: assentado ? "auto" : "none",
            fontFamily: FAMILIA_CORPO,
            fontSize: mCor.tamanho,
          }}
        >
          {palavrasDom.map((p, i) => (
            <span
              key={`${p.gi}-${i}`}
              className={p.chave ? "z-revista-marca" : undefined}
              style={{
                position: "absolute",
                left: p.x,
                top: topoDaLinha(p.y, mCor),
                lineHeight: `${mCor.entrelinha}px`,
                fontWeight: p.chave ? 600 : 400,
                whiteSpace: "pre",
              }}
            >
              {p.texto}{" "}
            </span>
          ))}
        </div>

        {/* o artefato é o componente de sempre, só posicionado */}
        {/* O cartão real do Studio. Largura fixada pelo layout; altura é dele, e o
            motor se adapta a ela (ResizeObserver acima). */}
        {/* Nasce fora da vista, mas COM tamanho: o 3Dmol mede o container na criação,
            e um container display:none mediria zero — molécula em branco pra sempre.
            O `recalcular` corrige posição e largura no primeiro frame. */}
        <div
          ref={slotArtefato}
          style={{
            position: "absolute",
            left: -9999,
            top: 0,
            width: 240,
            overflow: "hidden",
            display: artefato ? "block" : "none",
          }}
        >
          {artefato && (ehMolecula
            ? <MoleculeView data={artefato.data} nu />
            : <StudioBlock block={artefato} collapsed={false} onToggle={() => {}} />
          )}
        </div>

        {dica && (
          <div
            className="absolute z-10 pointer-events-none max-w-[260px] rounded-xl px-3 py-2 text-[12px] leading-relaxed bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg"
            style={{ left: dica.x, top: dica.y }}
          >
            <b className="block mb-0.5">{dica.termo}</b>
            {dica.def}
          </div>
        )}
      </div>

      {/* fontes */}
      {!!answer.evidencia?.length && (
        <div className="text-[12px] text-slate-600 dark:text-white/60 leading-relaxed">
          <p className="font-bold text-slate-700 dark:text-white/75 mb-1">Fontes</p>
          <ol className="list-decimal list-inside space-y-0.5">
            {answer.evidencia.map((e, i) => (
              <li key={i}>
                {e.claim}
                {e.source?.title && <span className="text-slate-500 dark:text-white/45"> — {e.source.title}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* glossário acessível: o hover no canvas não pode ser o único caminho */}
      {!!conceitos.length && (
        <details className="text-[12px] text-slate-600 dark:text-white/60">
          <summary className="cursor-pointer font-bold text-slate-700 dark:text-white/75">
            Conceitos desta resposta
          </summary>
          <ul className="mt-1 space-y-0.5 list-disc list-inside">
            {conceitos.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </details>
      )}

      {/* continue explorando */}
      {!!answer.proximos_passos?.length && (
        <div className="flex flex-wrap gap-1.5">
          {answer.proximos_passos.map((p) => (
            <button
              key={p}
              onClick={() => onNext?.(p)}
              className="px-3 py-1.5 rounded-full text-[11px] font-bold text-slate-700 dark:text-white/80 border border-slate-200 dark:border-white/10 hover:border-cyan-400/50 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
