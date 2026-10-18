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

// "pode ir" só é dispensa quando termina ali (ou com embora/vlw/valeu/obrigado/tchau…): "pode ir pesquisando" não é.
const FIM = String.raw`(?=\s*(?:$|[,.!?;:)]|vlw|valeu|obrigad|brigad|tchau|bj|beij|flw|falou))`;
const FORTES: RegExp[] = [
  new RegExp(String.raw`\b(?:ja )?pode (?:ir|sair|parar|descansar)(?: embora)?` + FIM),
  /\b(?:pode )?ir embora\b/,
  /\bvai embora\b/,
  /\b(?:para|pare) de (?:responder|falar)\b/,
  /\bnao precisa (?:mais )?(?:responder|falar)\b/,
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
