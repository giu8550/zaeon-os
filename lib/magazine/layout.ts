/**
 * lib/magazine/layout.ts — motor de layout do Modo Revista (R1).
 *
 * Aritmética pura: NÃO toca DOM, NÃO usa canvas, NÃO chama modelo. Recebe palavras já
 * MEDIDAS e devolve onde cada glifo cai. Essa separação é o contrato: medir é caro e
 * depende do navegador (canvas/Pretext); posicionar é conta, roda a 60fps e é testável
 * num terminal.
 *
 * A propriedade que sustenta o streaming é a ESTABILIDADE POR PREFIXO: com obstáculos
 * fixos, acrescentar palavras no fim nunca mexe nas linhas já fechadas. É o que permite
 * o texto crescer em degraus de linha sem a página pular. Duas coisas garantem isso:
 *   1. o preenchimento é guloso e só olha pra frente;
 *   2. a justificação da última linha do parágrafo só acontece quando o parágrafo FECHA
 *      (enquanto ele chega, a última linha fica alinhada à esquerda — senão ela dança a
 *      cada token).
 */

export type Obstaculo =
  | { tipo: "circulo"; cx: number; cy: number; r: number }
  | { tipo: "retangulo"; x: number; y: number; w: number; h: number; pad?: number };

/** Um grafema já medido: `dx` é o deslocamento dentro da palavra. */
export type Grafema = { ch: string; dx: number; gi: number };

export type Palavra = {
  texto: string;
  /** Largura medida com a MESMA fonte que vai desenhar (senão tudo escorrega). */
  largura: number;
  /** Termo do glossário (`conceitos`); null = palavra comum. */
  chave?: string | null;
  gi0: number;
  chars: Grafema[];
};

export type Paragrafo = {
  palavras: Palavra[];
  /** false = ainda chegando pelo stream; a última linha não justifica. */
  completo: boolean;
};

export type Metricas = {
  /** Tamanho da fonte do corpo, em px. */
  tamanho: number;
  /** Entrelinha em px (≈ 1,6 × tamanho). */
  entrelinha: number;
  /** Largura de um espaço, medida. */
  espaco: number;
};

export type GlifoPosicionado = { ch: string; x: number; y: number; gi: number; enfase: boolean };
/** A palavra inteira, já posicionada — é o que vira <span> no assentamento em DOM. */
export type PalavraPosicionada = { texto: string; x: number; y: number; largura: number; chave: string | null; gi: number };
export type MarcaTexto = { x: number; y: number; w: number; h: number; chave: string; gi: number };

export type Resultado = {
  glifos: GlifoPosicionado[];
  /** Mesmo conteúdo dos glifos, agrupado por palavra: o DOM final é montado daqui. */
  palavras: PalavraPosicionada[];
  marcas: MarcaTexto[];
  /** Altura total ocupada pelo texto (sem contar obstáculos que descem mais). */
  altura: number;
  /** Quantas linhas nasceram — o container cresce em múltiplos disso. */
  linhas: number;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Quantas linhas a palavra pode "descer" procurando espaço antes de ser forçada. */
const LIMITE_LINHAS_VAZIAS = 40;

/** Fresta menor que isto fica vazia: texto espremido em três letras parece defeito. */
export const FRESTA_MINIMA = (tamanho: number) => tamanho * 4;
/** Margem somada ao raio do círculo, pro texto não encostar no artefato. */
export const MARGEM_CIRCULO = (tamanho: number) => tamanho * 0.55;
/** Acima disto por lacuna, não justifica: justificar abriria "rios" no parágrafo. */
export const FOLGA_MAXIMA = (tamanho: number) => tamanho * 0.8;
/** Respiro entre parágrafos. */
export const RESPIRO = (entrelinha: number) => Math.round(entrelinha * 0.55);

/**
 * Intervalos horizontais livres na faixa [y, y+h]. O coração do contorno.
 * Devolve já ordenado, mesclado e sem as frestas estreitas demais.
 */
export function intervalosLivres(
  y: number,
  h: number,
  obstaculos: readonly Obstaculo[],
  largura: number,
  frestaMinima = 0,
): [number, number][] {
  const ocupados: [number, number][] = [];
  for (const o of obstaculos) {
    if (o.tipo === "circulo") {
      // Distância vertical do centro até o ponto da faixa mais próximo dele.
      const d = Math.abs(clamp(o.cy, y, y + h) - o.cy);
      if (d < o.r) {
        const meia = Math.sqrt(o.r * o.r - d * d);
        ocupados.push([o.cx - meia, o.cx + meia]);
      }
    } else {
      const p = o.pad ?? 0;
      if (y + h > o.y - p && y < o.y + o.h + p) ocupados.push([o.x - p, o.x + o.w + p]);
    }
  }
  ocupados.sort((a, b) => a[0] - b[0]);

  const livres: [number, number][] = [];
  let cursor = 0;
  for (const [l, r] of ocupados) {
    if (l > cursor) livres.push([cursor, l]);
    cursor = Math.max(cursor, r);
  }
  if (cursor < largura) livres.push([cursor, largura]);
  return livres.filter(([a, b]) => b - a >= frestaMinima);
}

/** Emite os glifos de uma palavra a partir do canto (x, y) da linha. */
function emitir(p: Palavra, x: number, y: number, m: Metricas, saida: Resultado): void {
  const base = y + baselineNaLinha(m);
  if (p.chave) {
    saida.marcas.push({
      x: x - 2,
      y: y + m.entrelinha * 0.2,
      w: p.largura + 4,
      h: m.entrelinha * 0.68,
      chave: p.chave,
      // A marca só acende quando a ÚLTIMA letra da palavra nasceu.
      gi: p.gi0 + p.texto.length - 1,
    });
  }
  for (const c of p.chars) {
    saida.glifos.push({ ch: c.ch, x: x + c.dx, y: base, gi: c.gi, enfase: !!p.chave });
  }
  saida.palavras.push({ texto: p.texto, x, y: base, largura: p.largura, chave: p.chave ?? null, gi: p.gi0 });
}

/**
 * Posiciona os parágrafos em volta dos obstáculos.
 * `yInicial` permite continuar de onde outro bloco parou.
 */
export function montarLayout(
  paragrafos: readonly Paragrafo[],
  obstaculos: readonly Obstaculo[],
  largura: number,
  m: Metricas,
  yInicial = 0,
): Resultado {
  const saida: Resultado = { glifos: [], palavras: [], marcas: [], altura: 0, linhas: 0 };
  const fresta = FRESTA_MINIMA(m.tamanho);
  const folgaMax = FOLGA_MAXIMA(m.tamanho);
  let y = yInicial;

  for (const par of paragrafos) {
    let i = 0;
    // Guarda contra obstáculo patológico (mais alto que o texto): sem isto, uma palavra
    // que nunca cabe desceria para sempre.
    let linhasVazias = 0;
    while (i < par.palavras.length) {
      const ivs = intervalosLivres(y, m.entrelinha, obstaculos, largura, fresta);
      let colocou = false;

      for (const [a, b] of ivs) {
        if (i >= par.palavras.length) break;
        const segmento: Palavra[] = [];
        let x = a;
        while (i < par.palavras.length) {
          const precisa = (segmento.length ? m.espaco : 0) + par.palavras[i].largura;
          if (x + precisa <= b + 0.5) { segmento.push(par.palavras[i]); x += precisa; i++; } else break;
        }
        if (!segmento.length) continue;
        colocou = true;

        // Justifica só quando ainda há texto depois: a última linha de um parágrafo
        // FECHADO fica alinhada à esquerda, e a de um parágrafo AINDA CHEGANDO também
        // — é isso que impede a linha de dançar a cada token.
        let lacuna = m.espaco;
        const temMais = i < par.palavras.length;
        if (temMais && segmento.length > 1) {
          const extra = (b - x) / (segmento.length - 1);
          if (extra < folgaMax) lacuna += extra;
        }

        let xx = a;
        for (const p of segmento) { emitir(p, xx, y, m, saida); xx += p.largura + lacuna; }
      }

      // Palavra que não coube em fresta nenhuma desta linha.
      if (!colocou) {
        const palavra = par.palavras[i];
        const maior = ivs.length ? ivs.reduce((mx, v) => (v[1] - v[0] > mx[1] - mx[0] ? v : mx)) : null;

        if (maior && palavra.largura <= maior[1] - maior[0]) {
          emitir(palavra, maior[0], y, m, saida);
          i++;
        } else if (palavra.largura > largura) {
          // Mais larga que a coluna inteira (URL gigante, fórmula): não há para onde
          // fugir — entra na margem e transborda, o que ao menos é legível.
          emitir(palavra, 0, y, m, saida);
          i++;
        } else {
          // Cabe na coluna, só não nesta linha: DESCE. Forçar aqui era o que fazia a
          // palavra atravessar o artefato (pego pelo teste: 4 glifos invadiam o círculo).
          // A mordida do obstáculo encolhe linha a linha, então isso sempre termina.
          linhasVazias++;
          if (linhasVazias > LIMITE_LINHAS_VAZIAS) {
            emitir(palavra, maior ? maior[0] : 0, y, m, saida);
            i++;
            linhasVazias = 0;
          }
        }
      } else {
        linhasVazias = 0;
      }

      y += m.entrelinha;
      saida.linhas++;
    }
    y += RESPIRO(m.entrelinha);
  }

  saida.altura = Math.ceil(y);
  return saida;
}

/**
 * Deslocamento da baseline dentro da linha. Exportado de propósito: quem precisa saber
 * em que faixa vertical um glifo mora (teste de colisão, assentamento em DOM) tem que
 * usar ESTA conta. Redoubrar a fórmula lá fora custou um falso alarme de 0,4px — o
 * arredondamento é parte do contrato, não detalhe.
 */
export const baselineNaLinha = (m: Metricas) => Math.round(m.entrelinha * 0.72);

/** Topo da faixa de linha a que um glifo pertence, a partir da baseline dele. */
export const topoDaLinha = (baseline: number, m: Metricas) => baseline - baselineNaLinha(m);

/** Obstáculo da capitular: retângulo no topo à esquerda, com 3 linhas de altura. */
export function obstaculoCapitular(largura: number, m: Metricas): Obstaculo {
  return { tipo: "retangulo", x: 0, y: 0, w: largura, h: m.entrelinha * 3 - 2, pad: 0 };
}

/** Círculo do artefato já com a margem de respiro somada ao raio. */
export function obstaculoArtefato(cx: number, cy: number, r: number, m: Metricas): Obstaculo {
  return { tipo: "circulo", cx, cy, r: r + MARGEM_CIRCULO(m.tamanho) };
}
