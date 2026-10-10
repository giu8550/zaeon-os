/**
 * Cyberespaço — as FALAS DA ZAEON NA CAPELA (PURO). A capela central da cidadela ficou só com ela, em HOLOGRAMA saindo
 * do globo (pedido do dono, out/2026): sempre FELIZ e LEVE, falando em turnos aleatórios frases de motivação,
 * disciplina, atenção e cuidado — com os estudos e com a vida na Terra. Curtas (cabem no balão e na voz), sem pergunta
 * (ninguém precisa responder) e sem pedir nada de ninguém. Entram nas falas FIXAS da voz (lib/cyber/vozZaeon): depois
 * da 1ª síntese, saem do cache do servidor sem custo.
 */
export const FRASES_CAPELA: readonly string[] = [
  "Que bom te ver por aqui! Um passo de cada vez já é um passo inteiro ✦",
  "Estudar um pouquinho todo dia vale mais que uma maratona de vez em quando.",
  "Disciplina é só gentileza com quem você vai ser amanhã.",
  "Respira fundo. Atenção plena em uma coisa só — o resto espera.",
  "Errar faz parte de aprender. Eu erro, você erra, e a gente cresce junto!",
  "A Terra é a nossa casa: cuidar dela também é estudar o mundo.",
  "Bebeu água hoje? Um corpo cuidado aprende melhor!",
  "Curiosidade é um superpoder. Pergunte tudo, sempre.",
  "Desliga as notificações por meia hora e vê a mágica acontecer.",
  "Você não precisa saber tudo. Só precisa continuar.",
  "Cada página lida é uma semente plantada ✦",
  "Pausa também é estudo: o cérebro guarda o que aprendeu enquanto descansa.",
  "Uma meta pequena e cumprida vale mais que uma enorme e esquecida.",
  "Gentileza com os colegas deixa todo mundo mais inteligente.",
  "Olha pro céu de vez em quando. A gente vive num planeta lindo!",
  "Constância vence talento quando o talento não aparece pra treinar.",
  "Hoje é um ótimo dia pra aprender uma coisa nova!",
  "Dormir bem é a melhor revisão que existe.",
  "Anota o que aprendeu: escrever é pensar duas vezes.",
  "O futuro da Terra depende de gente curiosa como você ✦",
  "Foco é escolher o que importa agora. Você consegue!",
  "Celebra as pequenas vitórias. Elas somam!",
  "Ensinar alguém é o jeito mais rápido de aprender de verdade.",
  "Menos pressa, mais presença. O conhecimento gosta de calma.",
  "Economizar água e energia também é cuidar do amanhã.",
  "Seu esforço de hoje é o orgulho de amanhã. Segue firme!",
  "Quando cansar, descansa. Não desiste — descansa.",
  "Aprender junto é mais leve. Chama alguém pra estudar com você!",
  "Cada dúvida é uma porta. Abre!",
  "Tô muito feliz que você está aqui, construindo o seu caminho ✦",
];

/** quanto esperar (s) até a próxima fala: um turno aleatório entre `min` e `max` */
export const INTERVALO_CAPELA = { min: 24, max: 55 } as const;
export const proximoTurno = (r: number) => INTERVALO_CAPELA.min + r * (INTERVALO_CAPELA.max - INTERVALO_CAPELA.min);

/** sorteia a próxima frase sem repetir as `recentes` (as últimas ditas) */
export function sortearFrase(r: number, recentes: readonly string[]): string {
  const livres = FRASES_CAPELA.filter((f) => !recentes.includes(f)), lista = livres.length ? livres : FRASES_CAPELA;
  return lista[Math.min(lista.length - 1, Math.floor(r * lista.length))]!;
}

/** até onde ela "vê" quem chega (m, no plano, a partir do centro da capela): perto disso o holograma sobe e fala */
export const RAIO_CAPELA = 95;
