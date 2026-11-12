/**
 * lib/anatomia/nomeNaTela.ts — #764 · o NOME da estrutura no cartão do chat. PURO.
 *
 * O atlas (BodyParts3D) nomeia em inglês: o cartão saía "Anatomia — heart". O termo que chega à rota é o que a Aura
 * extraiu da resposta (`estruturas`, em português: "coração") ou o que a pessoa pediu — quando ele é um NOME curto,
 * é ele que vai para a tela. Frase longa ("desenhe a anatomia do coração") ou vazia: fica o nome do atlas.
 */
export function nomeDaEstruturaNaTela(termo: string, nomeDoAtlas: string): string {
  const t = String(termo || "").replace(/\s+/g, " ").trim();
  const curto = t.length >= 2 && t.length <= 40 && t.split(" ").length <= 4 && /^[\p{L}\s'-]+$/u.test(t);
  return curto ? t : nomeDoAtlas || t || "estrutura";
}
