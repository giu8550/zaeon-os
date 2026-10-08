/**
 * Cyberespaço — a 1ª linha de defesa contra ABUSO na conversa com a Zaeon (PURO, sem rede). Detecta xingamento,
 * ofensa e assédio óbvios em português (com e sem acento, com letras trocadas por números/símbolos e letras
 * repetidas) ANTES de chamar a IA — e funciona mesmo sem ela. O que passar daqui a IA ainda classifica
 * (app/api/lounge3d/[id]/zaeon). Lista por PALAVRA inteira (não por pedaço: "cu" não pega "curso").
 */
const normalizar = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
  .replace(/[4@]/g, "a").replace(/3/g, "e").replace(/[1|]/g, "i").replace(/0/g, "o").replace(/[5$]/g, "s").replace(/7/g, "t")
  ;
/** cada sequência de letra repetida vira uma só ("caraaalho" e "carallho" → "caralho"; "porra" → "pora") — a lista
 *  é comparada na mesma forma */
const colapsar = (p: string) => p.replace(/(.)\1+/g, "$1");

/** palavras (normalizadas) que já bastam pra ser abuso — só as INEQUÍVOCAS (palavrão pesado, ofensa sexual, preconceito).
 *  As que dependem do contexto ("merda", "idiota", "lixo", "estupro" num trabalho de Direito…) ficam pra IA julgar */
const PALAVRAS = new Set([
  "porra", "porraa", "caralho", "caraio", "krl", "pqp", "puta", "putaa", "putinha", "vadia", "vagabunda", "piranha",
  "cuzao", "arrombado", "arrombada", "fdp", "fodase", "fuder", "foder", "fodido", "fudido",
  "buceta", "boceta", "xoxota", "piroca", "caceta", "viado", "viadinho", "sapatao", "traveco",
  "retardado", "retardada", "mongoloide", "escroto", "escrota", "desgracado", "desgracada",
  "fuck", "fucking", "bitch", "asshole", "cunt", "nigger", "nigga", "whore", "slut",
]);
/** expressões (normalizadas, com espaço) */
const EXPRESSOES = ["vai se foder", "vai se fuder", "vai tomar no cu", "tomar no cu", "filho da puta", "filha da puta", "vai a merda", "vai pra merda", "cala a boca", "se mata", "te odeio", "sua puta", "seu lixo", "sua vaca", "seu merda", "kill yourself", "shut up", "fuck you"];

const COLAPSADAS = new Set([...PALAVRAS].map(colapsar));

export type Moderacao = { abuso: boolean; termo?: string };
export function moderar(texto: string): Moderacao {
  const n = normalizar(texto);
  const nc = n.split(/[^a-z]+/).map(colapsar).join(" ");
  for (const e of EXPRESSOES) if (n.includes(e) || nc.includes(e.split(" ").map(colapsar).join(" "))) return { abuso: true, termo: e };
  for (const p of nc.split(" ")) if (p && COLAPSADAS.has(p)) return { abuso: true, termo: p };
  return { abuso: false };
}
