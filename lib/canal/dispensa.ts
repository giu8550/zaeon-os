/**
 * lib/canal/dispensa.ts — a agente SAI da conversa quando é dispensada (#438, #440, #443). PURO.
 *
 * O caso real: o Martinez mandou "@zenita pode ir embora, vlw", ela respondeu "Entendido" e continuou
 * respondendo tudo que ele mandava depois. Agora:
 *   - "pode ir", "pode sair", "é só isso", "para de responder"… dirigidos à agente da vez → ela se despede
 *     UMA vez (frase fixa, sem gastar IA) e entra a linha "Zenita saiu da conversa";
 *   - a partir daí, sem @ ninguém responde; ela volta quando alguém chamar com @.
 *
 * #443 — COMO a frase é lida (antes era uma lista de exceções, e sempre escapava uma: "pode ir em frente",
 * "pode ir direto ao ponto", "o professor falou que…"):
 *   1. a mensagem é cortada em PEDAÇOS (vírgula, ponto, "?", "!", " e ", " mas ");
 *   2. um pedaço só é despedida se for SÓ despedida: [palavras de abertura] DESPEDIDA [palavras de fecho].
 *      Abertura/fecho são curtas e fixas ("ok", "valeu", "agora", "embora", o nome da agente…). Qualquer outra
 *      coisa junto ("em frente", "do modo resumo", "em inglês", "de usar emoji") → não é despedida;
 *   3. pedaço que é PERGUNTA ("só isso?") nunca é despedida;
 *   4. "tchau"/"até mais"/"falou" são FRACAS: numa conversa com outras pessoas só contam se a mensagem falar com a
 *      agente (o nome ou o @ dela) — senão é tchau pra outra pessoa e a agente fica;
 *   5. PRA QUEM: se o pedaço de despedida tem o nome de uma agente ("a zenita pode sair, aura continua comigo"),
 *      só ela sai. Sem nome no pedaço: sai a agente da vez (se for uma só), ou todas se o verbo for plural
 *      ("podem ir"); com várias agentes e nada que diga qual, ninguém sai (melhor ficar do que sumir errado).
 */

/** minúsculas, sem acento, sem @menções, espaços normalizados. */
export function normalizar(texto: string): string {
  return semAcento(texto).replace(/@[\w.-]+/g, " ").replace(/\s+/g, " ").trim();
}

const semAcento = (t: string) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Uma agente que pode ser dispensada nesta mensagem (as que iam responder). */
export type Candidata = { key: string; nomes: string[] };

// ── as peças da frase (texto já sem acento, nomes trocados por §) ──
// #466: "por favor", "pfv" também abrem e fecham ("por favor pode sair", "pode ir embora por favor")
const ABRE = String.raw`(?:(?:a|o|voce|vc|tu|ok|okay|blz|beleza|valeu|vlw|obrigad\w*|brigad\w*|entao|bom|certo|agora|ja|ei|oi|por favor|pfv|pf|§)\s+)*`;
// #466: "aqui", "por agora", "por favor" também fecham ("não precisamos mais de você aqui", "pode sair por agora")
const FECHA = String.raw`(?:\s+(?:embora|agora|ja|entao|valeu|vlw|obrigad\w*|brigad\w*|tchau\w*|bj\w*|beij\w*|flw|falou|ok|blz|beleza|ta|de vez|por hoje|por enquanto|por agora|aqui|por favor|pfv|pf|§))*`;
const FORTES = [
  String.raw`(?:ja\s+)?(?:pode|podem|podes)\s+(?:ir|sair|parar|descansar)(?:\s+embora)?`,
  String.raw`(?:(?:pode|podem)\s+)?(?:ir|vai|vao)\s+embora`,
  String.raw`(?:(?:pode|podem)\s+)?(?:para|pare|parar|parem)\s+de\s+(?:responder|falar)`,
  String.raw`nao\s+precisa\s+(?:mais\s+)?(?:responder|falar)`,
  String.raw`nao\s+(?:preciso|precisamos|precisa|vou precisar|vamos precisar)\s+mais\s+(?:(?:de|da|do)\s+)?(?:voce|voces|vc|vcs|tu|ti|sua ajuda|ajuda|nada|§)`,
  String.raw`pode\s+deixar`,
  String.raw`(?:(?:e|eh|era)\s+)?so\s+isso`,
  String.raw`(?:(?:esta|ta|estao|tao)\s+)?dispensad[ao]s?`,
  String.raw`por\s+hoje\s+e\s+so`,
];
const FRACAS = [String.raw`tchau\w*`, String.raw`ate\s+(?:mais|logo|a proxima|amanha)`, String.raw`(?:falou|flw)`, String.raw`bye`];
const NUCLEO = (nucleos: string[]) => `(?:${nucleos.join("|")})`;
const PEDACO_FORTE = new RegExp(String.raw`^${ABRE}${NUCLEO(FORTES)}${FECHA}(?:\s+${NUCLEO([...FORTES, ...FRACAS])}${FECHA})*$`);
const PEDACO_FRACO = new RegExp(String.raw`^${ABRE}${NUCLEO(FRACAS)}${FECHA}(?:\s+${NUCLEO(FRACAS)}${FECHA})*$`);
// #466: pedaço que manda uma agente FICAR ("aura continua comigo", "fica aura", "a aura pode continuar")
const FICA = new RegExp(String.raw`(?:§\s+(?:(?:pode|vai)\s+)?(?:continua|continue|continuar|fica|fique|ficar|permanece|permaneca|segue|siga|seguir)\b|\b(?:continua|continue|fica|fique|permanece|permaneca|segue|siga)\s+(?:so\s+|apenas\s+)?(?:a\s+|o\s+|aqui\s+)?§)`);
const PLURAL = /\b(?:podem|vao|voces|vcs|parem|estao|tao|dispensad[ao]s)\b/;

type Pedaco = { texto: string; pergunta: boolean };

/** Corta a mensagem em pedaços (vírgula, ponto, ?, !, ;, " e ", " mas "), guardando se cada um é pergunta. */
function pedacos(texto: string): Pedaco[] {
  const out: Pedaco[] = [];
  for (const m of semAcento(texto).matchAll(/([^,.;!?]+)([,.;!?]*)/g)) {
    const partes = m[1]!.split(/\s+(?:e(?!\s+so\b)|mas|porem)\s+/); // "é só" sem acento vira "e so": não corta ali
    // a frase toda é pergunta ("tchau é como se diz adeus?"): nenhum pedaço dela vira despedida
    const pergunta = (m[2] ?? "").includes("?");
    partes.forEach((p) => out.push({ texto: p, pergunta }));
  }
  return out.filter((p) => p.texto.trim());
}

/** Troca, no pedaço, cada nome/@ de agente por § e lembra de quem era cada §, e se veio com @. */
function marcarNomes(pedaco: string, candidatas: readonly Candidata[]): { s: string; quem: { key: string; arroba: boolean }[] } {
  const quem: { key: string; arroba: boolean }[] = [];
  const toks = pedaco.replace(/[^\w@\s-]/g, " ").split(/\s+/).filter(Boolean);
  const s = toks.map((tok) => {
    const arroba = tok.startsWith("@");
    const nome = tok.replace(/^@/, "");
    const c = candidatas.find((x) => [x.key, ...x.nomes].map(semAcento).some((n) => n && n === nome));
    if (!c) return tok;
    quem.push({ key: c.key, arroba });
    return "§";
  }).join(" ");
  return { s, quem };
}

/**
 * #443: QUEM foi dispensada nesta mensagem, entre as agentes que iam responder (`candidatas`).
 * `humanos` = quantas pessoas no canal (o "tchau" sozinho só vale na conversa só com a agente).
 */
export function quemFoiDispensada(texto: string, candidatas: readonly Candidata[], humanos: number): string[] {
  if (!candidatas.length || !normalizar(texto)) return [];
  const todas = semAcento(texto);
  const citada = (k: string) => {
    const c = candidatas.find((x) => x.key === k)!;
    return [c.key, ...c.nomes].map(semAcento).filter(Boolean).some((n) => new RegExp(String.raw`(?:^|[^\w])@?${esc(n)}(?![\w])`).test(todas));
  };
  const saem = new Set<string>();
  const ficam = new Set<string>();
  for (const p of pedacos(texto)) {
    if (p.pergunta) continue;                                   // "só isso?" é pergunta, não despedida
    const { s, quem } = marcarNomes(p.texto, candidatas);
    // #466: "aura continua comigo" / "fica, aura" → essa agente FICA, mesmo que outro pedaço a dispense
    if (FICA.test(s)) quem.forEach((q) => ficam.add(q.key));
    const forte = PEDACO_FORTE.test(s.trim());
    const fraco = !forte && PEDACO_FRACO.test(s.trim());
    if (!forte && !fraco) continue;
    // pra quem: o nome escrito no pedaço manda; depois o @ no pedaço; depois a agente da vez
    const escritos = [...new Set(quem.filter((q) => !q.arroba).map((q) => q.key))];
    const arrobas = [...new Set(quem.filter((q) => q.arroba).map((q) => q.key))];
    let alvo = escritos.length ? escritos : arrobas.length ? arrobas : [];
    if (!alvo.length) {
      if (candidatas.length === 1) alvo = [candidatas[0]!.key];
      else if (PLURAL.test(s)) alvo = candidatas.map((c) => c.key);
    }
    // "tchau" (fraca) com outras pessoas na conversa: só vale se a mensagem falar com a agente
    if (fraco && humanos > 1) alvo = alvo.filter((k) => quem.some((q) => q.key === k) || citada(k));
    alvo.forEach((k) => saem.add(k));
  }
  return candidatas.map((c) => c.key).filter((k) => saem.has(k) && !ficam.has(k));
}

export type ContextoDispensa = {
  /** nomes/aliases da agente da vez (ex.: ["zenita"]). */
  nomesDaAgente: string[];
  /** a agente foi chamada com @ nesta mensagem? (o @ já é lido do próprio texto; fica por compatibilidade) */
  mencionada: boolean;
  /** quantas pessoas no canal (dono + membros + o outro lado da conversa). */
  humanos: number;
};

/** A mensagem dispensa a agente da vez? (uma agente só — pra várias, quemFoiDispensada) */
export function ehDispensa(texto: string, ctx: ContextoDispensa): boolean {
  const [key, ...nomes] = ctx.nomesDaAgente.filter(Boolean);
  const c: Candidata = { key: key ?? "agente", nomes };
  // @ escrito na mensagem conta como falar com ela, mesmo que o @ venha com outro apelido
  const humanos = ctx.mencionada ? 1 : ctx.humanos;
  return quemFoiDispensada(texto, [c], humanos).length > 0;
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
