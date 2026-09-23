/**
 * lib/magazine/chegada.ts — QUANDO cada letra nasce na página da revista.
 *
 * Aritmética pura, de propósito: esta função já teve dois bugs que só aparecem em
 * produção e nunca em olhada de código.
 *
 *   1. Ela nunca rodava. A resposta estruturada não chega token a token — o harness
 *      manda `@@STRUCTURED@@` inteiro no fim do stream, então `streaming` já é false
 *      quando o texto chega na tela, e o caminho "sem stream" acendia tudo de uma vez.
 *   2. Com passo mínimo de 2ms, uma resposta de 3200 grafemas levava 6,4s — o dobro
 *      do combinado, porque o piso virava teto.
 *
 * O componente só chama e obedece. Testes em chegada.test.ts.
 */

/** Tempo total da materialização, do primeiro ao último grafema. */
export const DURACAO_CHEGADA = 3200;
/** Quanto cada letra leva pra "secar" do ciano pra tinta. */
export const DURACAO_LETRA = 420;
/**
 * Teto do passo. Resposta curta não precisa dos 3,2s inteiros pra desenhar meia dúzia
 * de linhas. Não há PISO: passo menor que um frame não é problema — várias letras
 * nascem no mesmo rAF, e é exatamente isso que se quer num texto longo.
 */
export const PASSO_MAXIMO = 10;
/** Margem depois da última letra pousar, antes de o canvas ceder o lugar ao DOM. */
export const RESPIRO_FINAL = 120;

/**
 * Marca a hora de nascimento das letras que ainda não têm uma, EM `nasc` (muta), e
 * devolve em quantos ms o texto estará inteiro na página.
 *
 * O caso que importa é o segundo: um recálculo no meio da animação (a molécula monta
 * no 3Dmol e o container muda de largura) reexecuta o efeito quando NENHUMA letra está
 * por nascer. Aqui isso não é um não-evento — o cleanup do React já matou o timer
 * anterior, então alguém precisa reagendar o assentamento, ou o canvas fica pra sempre
 * no lugar do DOM e o texto nunca vira selecionável.
 */
export function agendarChegada(nasc: Float64Array, agora: number): number {
  let porNascer = 0;
  for (let i = 0; i < nasc.length; i++) if (nasc[i] < 0) porNascer++;

  let ultima = agora;
  if (porNascer) {
    const passo = Math.min(DURACAO_CHEGADA / porNascer, PASSO_MAXIMO);
    let k = 0;
    for (let i = 0; i < nasc.length; i++) if (nasc[i] < 0) nasc[i] = agora + k++ * passo;
    ultima = agora + (porNascer - 1) * passo;
  } else {
    for (let i = 0; i < nasc.length; i++) if (nasc[i] > ultima) ultima = nasc[i];
  }
  return Math.max(0, ultima - agora) + DURACAO_LETRA + RESPIRO_FINAL;
}

/** Tudo já nascido, agora: histórico e `prefers-reduced-motion`. */
export function chegadaInstantanea(nasc: Float64Array): void {
  for (let i = 0; i < nasc.length; i++) if (nasc[i] < 0) nasc[i] = 0;
}
