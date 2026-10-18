/**
 * lib/canal/dispensa.ts — a agente SAI da conversa quando é dispensada (#438). PURO.
 *
 * O caso real: o Martinez mandou "@zenita pode ir embora, vlw", ela respondeu "Entendido" e continuou
 * respondendo tudo que ele mandava depois. Agora:
 *   - "pode ir", "pode sair", "é só isso", "para de responder"… dirigidos à agente da vez → ela se despede
 *     UMA vez (frase fixa, sem gastar IA) e entra a linha "Zenita saiu da conversa";
 *   - a partir daí, sem @ ninguém responde; ela volta quando alguém chamar com @.
 * "Tchau"/"até mais" são FRACAS: numa conversa com outras pessoas só contam se falarem com a agente (o nome ou
 * o @ dela) — senão é tchau pra outra pessoa e a agente fica.
 */

/** minúsculas, sem acento, sem @menções, espaços normalizados. */
export function normalizar(texto: string): string {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/@[\w.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "pode ir/sair" é dispensa, a não ser que venha um PEDIDO logo depois: um verbo em -ndo ("pode ir pesquisando"),
// um objeto ("pode sair um resumo", "pode ir pra parte 2") ou "me/te" ("pode ir me explicando"). #440: antes só
// valia no FIM da frase, e "pode sair, não precisamos mais de você" passava batido.
const PEDIDO_DEPOIS = String.raw`(?!\s+(?:\w+ndo|um|uma|uns|umas|o|a|os|as|pra|para|pro|com|no|na|nos|nas|ao|aos|fazer|buscar|ver|ler|me|te|mais|algo|algum|alguma|isso|isto|aquilo|esse|essa|este|esta|outro|outra)\b)`;
const FORTES: RegExp[] = [
  new RegExp(String.raw`\b(?:ja )?pode (?:ir|sair|parar|descansar)(?: embora)?\b` + PEDIDO_DEPOIS),
  // #440: "não precisamos mais de você", "não preciso mais da sua ajuda"
  /\bnao (?:preciso|precisamos|precisa|vou precisar|vamos precisar) mais (?:de |da |do )?(?:voce|vc|tu|ti|sua ajuda|ajuda|nada)\b/,
  /\bpode deixar\b(?=\s*(?:$|[,.!?]|obrigad|brigad|valeu|vlw|tchau))/,
  /\b(?:pode )?ir embora\b/,
  /\bvai embora\b/,
  // #440: "para de responder EM INGLÊS" / "não precisa mais responder assim" são instrução, não dispensa
  /\b(?:para|pare) de (?:responder|falar)\b(?!\s+(?:em|com|assim|sobre|so|apenas|tao|desse|dessa|deste|desta|disso|tudo|ingles|portugues)\b)/,
  /\bnao precisa (?:mais )?(?:responder|falar)\b(?!\s+(?:em|com|assim|sobre|so|apenas|tao|desse|dessa|deste|desta|disso|tudo|ingles|portugues)\b)/,
  /\b(?:e|eh) so isso\b/,
  /\bso isso\b(?=\s*(?:$|[,.!?]|obrigad|brigad|valeu|vlw|tchau))/,
  /\bdispensad[ao]\b/,
  /\bpor hoje e so\b/,
];
const FRACAS: RegExp[] = [/\btchau(?:zinho)?\b/, /\bate (?:mais|logo|a proxima|amanha)\b/, /\b(?:falou|flw)\b/, /\bbye\b/];

export type ContextoDispensa = {
  /** nomes/aliases da agente da vez (ex.: ["zenita"]). */
  nomesDaAgente: string[];
  /** a agente foi chamada com @ nesta mensagem? */
  mencionada: boolean;
  /** quantas pessoas no canal (dono + membros + o outro lado da conversa). */
  humanos: number;
};

/** A mensagem dispensa a agente da vez? */
export function ehDispensa(texto: string, ctx: ContextoDispensa): boolean {
  const t = normalizar(texto);
  if (!t) return false;
  if (FORTES.some((r) => r.test(t))) return true;
  if (!FRACAS.some((r) => r.test(t))) return false;
  // "tchau" sozinho: na conversa só com a agente vale; com outras pessoas, só se falar com ela
  if (ctx.mencionada || ctx.humanos <= 1) return true;
  const nomes = ctx.nomesDaAgente.map(normalizar).filter(Boolean);
  const textoCru = normalizar((texto || "").replace(/@/g, " "));
  return nomes.some((n) => new RegExp(String.raw`\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\b`).test(textoCru));
}

/** A despedida dela (fixa — não gasta IA nem esbarra no limite de uso). */
export const textoDespedida = (agentKey: string) =>
  `Combinado! Saindo da conversa. Se precisar de mim, é só chamar com @${agentKey}. 👋`;

/** A linha do sistema que marca a saída (autorTipo "sistema", autorId = agentKey). */
export const textoSaiu = (nome: string) => `${nome || "A agente"} saiu da conversa`;

/** #440: a linha de quando ela é chamada com @ depois de ter saído (lib/canal/alvo ehLinhaVoltou reconhece). */
export const textoVoltou = (nome: string) => `${nome || "A agente"} voltou para a conversa`;

/**
 * #440: os agentes na barra do escritório (canal.agentes) depois desta mensagem: quem foi chamado entra, quem foi
 * dispensado sai — assim a barra para de mostrar a agente que saiu, e ela volta quando chamada com @.
 */
export function agentesDepois(atuais: readonly string[], chamados: readonly string[], dispensados: readonly string[]): string[] {
  return [...new Set([...atuais, ...chamados])].filter((k) => !dispensados.includes(k));
}
