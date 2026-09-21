/**
 * lib/magazine/fontes.ts — resolve as famílias do Modo Revista para o CANVAS.
 *
 * O BUG QUE ISTO EXISTE PRA IMPEDIR:
 *
 *   ctx.font = '400 19px var(--font-revista-corpo), Georgia, serif';
 *   ctx.font  // → "10px sans-serif"
 *
 * `ctx.font` é um parser de CSS shorthand que NÃO resolve custom properties. Uma string
 * com `var()` é inválida, e a especificação manda ignorar atribuição inválida — em
 * silêncio, sem erro, sem aviso. O contexto fica no padrão: 10px sans-serif.
 *
 * O estrago não era "fonte errada". Era pior: a medição acontecia em 10px sans-serif
 * (58% da largura real) e a cópia em DOM, que entende `var()` porque é CSS de verdade,
 * renderizava as MESMAS palavras em 19px serif nas coordenadas calculadas pra 10px. As
 * palavras montavam umas nas outras. O título ficava normal porque está no fluxo do
 * documento, não posicionado pela conta do canvas.
 *
 * `document.fonts.load()` tem o mesmo parser e o mesmo silêncio.
 */

/** Famílias de queda — o que sobra se a custom property não existir (SSR, fonte não carregada). */
export const QUEDA_CORPO = 'Georgia, "Times New Roman", serif';
export const QUEDA_DISPLAY = "Georgia, serif";

/**
 * Lê a família real por trás de uma custom property e devolve uma lista pronta pro
 * canvas. `raiz` existe pra teste; em produção é o <html>.
 */
export function familiaDaVariavel(nome: string, queda: string, raiz?: Element | null): string {
  try {
    const el = raiz ?? (typeof document !== "undefined" ? document.documentElement : null);
    if (!el || typeof getComputedStyle !== "function") return queda;
    const valor = getComputedStyle(el).getPropertyValue(nome).trim();
    return valor ? `${valor}, ${queda}` : queda;
  } catch {
    return queda; // getComputedStyle pode falhar em contexto sem layout
  }
}

/** Monta a string do `ctx.font` com a família JÁ resolvida. */
export function fonteCanvas(peso: number | string, tamanho: number, familia: string): string {
  return `${peso} ${Math.round(tamanho)}px ${familia}`;
}

/**
 * Atribui CONFERINDO. O canvas engole string inválida sem reclamar, então a gente marca
 * o contexto com um valor sentinela antes: se depois da atribuição ele continuar na
 * sentinela, a string foi recusada e a queda assume.
 *
 * A queda é uma FAMÍLIA ("Georgia, serif"), e família sozinha também é `ctx.font`
 * inválido — foi assim que a primeira versão desta função caiu no mesmo buraco que
 * estava consertando. Por isso reaproveitamos o prefixo (peso + tamanho) da string que
 * se tentou; se nem isso der pra extrair, entra um tamanho padrão explícito.
 *
 * Devolve o `ctx.font` que de fato valeu — use ESSE valor pra medir e pra desenhar, nunca
 * a string que você tentou, senão medida e desenho divergem de novo.
 */
const SENTINELA = "1px serif";
const PREFIXO = /^(.*?\b\d+(?:\.\d+)?px)\s+/;   // "600 92px " de "600 92px Georgia, serif"

/** Recompõe "<peso> <tamanho>px <família de queda>" a partir da string tentada. */
export function comQueda(tentada: string, queda: string): string {
  const m = PREFIXO.exec(tentada);
  return `${m ? m[1] : "16px"} ${queda}`;
}

export function aplicarFonte(ctx: { font: string }, fonte: string, queda: string): string {
  ctx.font = SENTINELA;
  ctx.font = fonte;
  if (ctx.font === SENTINELA && fonte !== SENTINELA) {
    ctx.font = comQueda(fonte, queda);                 // recusada → queda COM tamanho
    if (ctx.font === SENTINELA) ctx.font = "16px serif"; // último porto seguro
  }
  return ctx.font;
}

/** `true` se o canvas aceita a string — o teste que faltava no dia 1. */
export function fonteValida(ctx: { font: string }, fonte: string): boolean {
  ctx.font = SENTINELA;
  ctx.font = fonte;
  return ctx.font !== SENTINELA || fonte === SENTINELA;
}
