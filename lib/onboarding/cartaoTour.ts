/**
 * lib/onboarding/cartaoTour.ts — as regras PURAS do cartão novo dos tours do laboratório (#605, "diálogo de jogo"
 * com a Aura — components/onboard/BalaoTour).
 *   - uma ideia por caixa: a fala do roteiro (o texto do handoff, que não muda) é dividida em PÁGINAS curtas, nas
 *     pontas das frases; o cartão mostra uma de cada vez;
 *   - o texto aparece letra por letra (`letrasVisiveis`); clicar completa, e com "reduzir movimento" ele vem inteiro.
 */

/** Uma página do cartão cabe nisto (caracteres); uma frase maior fica sozinha numa página. */
export const MAX_PAGINA = 140;
/** Velocidade da "datilografia" (letras por segundo). */
export const LETRAS_POR_SEGUNDO = 48;

// fim de frase (. ! ? …), com os emojis colados nele ("aqui. 💜"), seguido de espaço — ou um emoji que fecha a frase
// sem ponto, antes de maiúscula ("Sala de Estudos 👇 Pensa nela…")
const FIM_DE_FRASE = /(?<=[.!?…](?:\s*\p{Extended_Pictographic}️?)*)\s+(?=\S)(?!\p{Extended_Pictographic})|(?<=\p{Extended_Pictographic}️?)\s+(?=\p{Lu})/u;

/** As frases da fala, cada uma com o emoji que fecha ela ("Que bom te ver aqui. 💜"). */
export function frases(fala: string): string[] {
  return (fala || "").trim().split(FIM_DE_FRASE).map((f) => f.trim()).filter(Boolean);
}

/** A fala dividida em páginas curtas, sem cortar frase no meio (o texto, junto, é o mesmo da fala). */
export function paginasDaFala(fala: string, max = MAX_PAGINA): string[] {
  const out: string[] = [];
  for (const f of frases(fala)) {
    const ultima = out[out.length - 1];
    if (ultima !== undefined && ultima.length + 1 + f.length <= max) out[out.length - 1] = `${ultima} ${f}`;
    else out.push(f);
  }
  return out.length ? out : [""];
}

/**
 * As "letras" como a pessoa vê: um emoji composto (👍🏽, 👩‍💻, 🇧🇷) conta como uma só. Sem `Intl.Segmenter`
 * (navegador antigo), cai nos pontos de código.
 */
function letrasDe(texto: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: "grapheme" }) => { segment(t: string): Iterable<{ segment: string }> } }).Segmenter;
  return Seg ? Array.from(new Seg("pt-BR", { granularity: "grapheme" }).segment(texto), (s) => s.segment) : Array.from(texto);
}

/** Quantas letras da página já apareceram depois de `ms` (nunca corta um emoji ao meio, nem um composto). */
export function letrasVisiveis(texto: string, ms: number, lps = LETRAS_POR_SEGUNDO): string {
  const letras = letrasDe(texto);
  const n = Math.max(0, Math.min(letras.length, Math.floor((ms / 1000) * lps)));
  return letras.slice(0, n).join("");
}

/** O tom do cartão por lugar do laboratório: roxo na Sala de Estudos, ciano no Escritório. */
export type TomCartao = "roxo" | "ciano";
export const COR_DO_TOM: Record<TomCartao, { rgb: string; texto: string; tinta: string }> = {
  roxo: { rgb: "167,139,250", texto: "#d8ccff", tinta: "#1a1238" },
  ciano: { rgb: "34,211,238", texto: "#a5f3fc", tinta: "#04202a" },
};
