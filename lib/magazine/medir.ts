/**
 * lib/magazine/medir.ts — a fase CARA do Modo Revista: transformar texto em palavras
 * medidas. Roda uma vez por (texto + fonte); o motor de layout (layout.ts) roda a cada
 * frame em cima do resultado.
 *
 * Medimos com o canvas 2D, que usa o MESMO motor de fonte que vai desenhar. A regra que
 * não pode ser quebrada: a string de `ctx.font` aqui tem que ser idêntica à que desenha,
 * senão as larguras escorregam e o texto some por baixo do artefato.
 *
 * Os grafemas saem do `Intl.Segmenter` (nativo, sem dependência): fatiar por `txt[i]`
 * parte emoji e marcas combinantes no meio, e aí a animação letra-a-letra desenha lixo.
 *
 * Sobre o Pretext (@chenglou/pretext), citado no plano: ele resolve esta fase muito bem,
 * mas o caminho de layout manual dele trabalha com UMA largura por linha, e o nosso
 * contorno precisa de VÁRIOS segmentos na mesma linha (texto dos dois lados da molécula).
 * Ou seja, ele substituiria só a medição — que o canvas já faz exato. Fica anotado como
 * troca fácil se o profiling apontar a medição como gargalo.
 */
import type { Palavra, Grafema } from "./layout";

export type FonteSpec = {
  /** String pronta pro `ctx.font` do corpo. */
  corpo: string;
  /** Idem, para as palavras em ênfase (conceitos). */
  enfase: string;
};

const temSegmenter = typeof Intl !== "undefined" && typeof (Intl as any).Segmenter === "function";
const segmentador = temSegmenter ? new (Intl as any).Segmenter("pt", { granularity: "grapheme" }) : null;

/** Fatia em grafemas de verdade (emoji e acentos combinantes inteiros). */
export function grafemas(texto: string): string[] {
  if (!segmentador) return Array.from(texto);
  return Array.from(segmentador.segment(texto), (s: any) => s.segment);
}

/** Normaliza pra casar com as chaves do glossário: "Cafeína," → "cafeína". */
export function normalizar(s: string): string {
  return s.toLowerCase().replace(/[.,:;!?()"“”'’]/g, "");
}

export type TextoMedido = {
  paragrafos: Palavra[][];
  /** Largura de um espaço na fonte do corpo. */
  espaco: number;
  /** Quantos grafemas ao todo — dimensiona o vetor de "nascimento" da animação. */
  totalGrafemas: number;
  /** Primeira letra do primeiro parágrafo, retirada do fluxo (vira capitular). */
  capitular: string;
};

/**
 * Mede parágrafos inteiros. `conceitos` são as palavras que ganham ênfase — a largura
 * delas é medida com a fonte de ênfase, senão a marca-texto fica torta.
 *
 * `comCapitular` tira a primeira letra do fluxo: ela é desenhada à parte, em corpo
 * grande, e o texto contorna o retângulo dela.
 */
export function medirTexto(
  ctx: CanvasRenderingContext2D,
  paragrafos: readonly string[],
  fontes: FonteSpec,
  conceitos: readonly string[] = [],
  comCapitular = true,
): TextoMedido {
  const chaves = new Set(conceitos.map(normalizar));
  const saida: Palavra[][] = [];
  let gi = comCapitular ? 1 : 0; // gi 0 fica reservado pra capitular
  let capitular = "";

  paragrafos.forEach((paragrafo, pi) => {
    let texto = paragrafo;
    if (comCapitular && pi === 0) {
      const g = grafemas(texto);
      capitular = g[0] ?? "";
      texto = g.slice(1).join("");
    }
    const palavras: Palavra[] = [];
    for (const bruto of texto.split(/\s+/)) {
      if (!bruto) continue;
      const chave = normalizar(bruto);
      const enfase = chaves.has(chave);
      ctx.font = enfase ? fontes.enfase : fontes.corpo;

      const gs = grafemas(bruto);
      const chars: Grafema[] = [];
      let acumulado = "";
      for (let k = 0; k < gs.length; k++) {
        chars.push({ ch: gs[k], dx: ctx.measureText(acumulado).width, gi: gi + k });
        acumulado += gs[k];
      }
      palavras.push({
        texto: bruto,
        largura: ctx.measureText(bruto).width,
        chave: enfase ? chave : null,
        gi0: gi,
        chars,
      });
      gi += gs.length + 1;
    }
    saida.push(palavras);
    gi += 8; // um respiro de índices entre parágrafos, pra pausa da animação
  });

  ctx.font = fontes.corpo;
  return { paragrafos: saida, espaco: ctx.measureText(" ").width, totalGrafemas: gi, capitular };
}

/**
 * Quebra o `desenvolvimento` em parágrafos. Linha em branco separa; linha única também
 * conta. Nada de markdown aqui — o Modo Revista desenha texto, não interpreta marcação.
 */
export function emParagrafos(texto: string): string[] {
  return texto
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Conta palavras — é o critério de ativação do Modo Revista (§10 do plano). */
export function contarPalavras(texto: string): number {
  return texto.trim() ? texto.trim().split(/\s+/).length : 0;
}
