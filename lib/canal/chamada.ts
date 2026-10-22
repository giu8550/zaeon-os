/**
 * lib/canal/chamada.ts — chamar uma agente pelo NOME, sem @ (#466). PURO.
 *
 * O caso real: "sim continue aura pode ir em frente" foi respondida pelo Téo (a agente da vez), porque só o @
 * chamava alguém. Agora o nome escrito também chama — mas só quando é usado PRA CHAMAR (vocativo), porque
 * "aura" é palavra comum ("minha aura está pesada") e Caio/Davi podem ser nomes de pessoas da conversa:
 *   - nome seguido de vírgula, "!" ou ":"            → "aura, me explica"
 *   - nome no fim, depois de vírgula                  → "me explica isso, aura"
 *   - nome colado num pedido/saudação (antes ou depois) → "continue aura", "aura me ajuda", "oi aura"
 * Nunca conta: nome depois de artigo/possessivo/preposição ("a aura do lugar", "sua aura", "sobre aura"), nem
 * nome que é o de uma PESSOA da conversa (aí é com a pessoa que se fala).
 */

export type AgenteChamavel = { agentKey: string; nome: string };

const semAcento = (t: string) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Palavras de pedido/saudação que, coladas no nome, fazem dele um chamado. */
const PEDIDO = new Set([
  "continue", "continua", "pode", "podes", "responde", "responda", "explica", "explique", "me", "fala", "fale",
  "diga", "diz", "conta", "conte", "segue", "siga", "ajuda", "ajude", "vem", "venha", "volta", "volte",
  "oi", "ei", "ola", "opa", "ai", "bom", "dia", "tarde", "noite", "obrigado", "obrigada", "valeu", "vlw",
]);
/** Antes do nome, estas palavras fazem dele uma coisa, não um chamado ("a aura", "minha aura", "sobre aura"). */
const COISA = new Set([
  "a", "o", "as", "os", "uma", "um", "da", "do", "das", "dos", "de", "na", "no", "em", "sua", "seu", "minha", "meu",
  "tua", "teu", "nossa", "nosso", "essa", "esse", "esta", "este", "aquela", "aquele", "sobre", "com", "sem", "pra",
  "para", "pela", "pelo", "que", "qual",
  // #551: "pergunta pro teo", "ao teo", "nos agentes"
  "pro", "pros", "pras", "ao", "aos", "num", "numa", "nos", "nas", "dele", "dela",
]);
/** #551: antes do nome, quem é a pessoa pra mim ("minha amiga nina", "o professor teo") — fala SOBRE alguém. */
const PARENTE = new Set([
  "amiga", "amigo", "prima", "primo", "irma", "irmao", "mae", "pai", "tia", "tio", "vo", "vovo", "avo", "filha", "filho",
  "namorada", "namorado", "esposa", "marido", "colega", "vizinha", "vizinho", "professora", "professor", "prof", "chefe",
  "cachorra", "cachorro", "gata", "gato",
]);
/**
 * #551: depois do nome, verbo que CONTA algo dela ("teo explicou mal", "teo e zenita são…", "teo foi ótimo") —
 * fala SOBRE a agente, não com ela. Também todo verbo no passado terminado em -ou/-eu/-iu ("falou", "respondeu").
 * Presente fica de fora: "zenita sabe isso melhor?" é pergunta PRA ela.
 */
const VERBO_SOBRE = new Set([
  "e", "eh", "foi", "era", "sao", "eram", "estava", "estavam", "tava", "tinha", "disse", "sabia", "fez", "deu", "parece",
]);
const NO_PASSADO = /^[a-z]{2,}(?:ou|eu|iu)$/;

/**
 * #468: nomes de agente que também são PALAVRA COMUM (ou o nome da plataforma). Esses só chamam em posição de
 * chamado; os outros nomes (próprios) chamam em qualquer posição — mas nunca depois de "a/o/minha/sobre…".
 */
const NOME_COMUM = new Set(["aura", "zaeon", "scholar", "examiner", "core_active"]);
/** Antes de um nome próprio, estas palavras fazem dele outra pessoa/coisa ("o rei davi", "são caio"). */
const TITULO = new Set(["rei", "sao", "santo", "santa", "profeta", "senhor", "dom", "dona", "seu"]);

type Tok = { w: string; antes: string; depois: string };

/** Palavras (sem acento, minúsculas) com a pontuação que vem antes e depois de cada uma. */
function palavras(texto: string): Tok[] {
  const out: Tok[] = [];
  const re = /([^\p{L}\p{N}@]*)([\p{L}\p{N}@][\p{L}\p{N}._-]*)/gu;
  let m: RegExpExecArray | null;
  const t = semAcento(texto);
  while ((m = re.exec(t))) {
    if (out.length) out[out.length - 1]!.depois = m[1] ?? "";
    out.push({ w: m[2]!, antes: m[1] ?? "", depois: "" });
  }
  if (out.length) out[out.length - 1]!.depois = t.slice(t.lastIndexOf(out[out.length - 1]!.w) + out[out.length - 1]!.w.length);
  return out;
}

/** #551: palavras que, antes de um nome, fazem a frase falar COM a pessoa ("tchau martinez", "valeu ana"). */
const SAUDACAO = new Set([
  "oi", "ei", "ola", "opa", "ai", "tchau", "valeu", "vlw", "obrigado", "obrigada", "brigado", "brigada", "falou", "flw",
  "beleza", "blz", "dia", "tarde", "noite", "parabens", "ate", "logo", "mais", "amanha",
]);

/**
 * #551: a mensagem fala COM uma das outras pessoas da conversa? ("tchau martinez, até amanhã", "martinez, viu
 * isso?", "valeu ana"). Aí, sem @ nem nome de agente, a agente fica quieta — antes ela respondia o que era pra
 * pessoa. Falar SOBRE a pessoa ("o martinez disse que…, é verdade?") não conta: a pergunta pode ser pra agente.
 */
export function falaComPessoa(texto: string, outrasPessoas: readonly string[]): boolean {
  const nomes = new Set(outrasPessoas.map((p) => semAcento(p).split(/\s+/)[0] ?? "").filter((n) => n.length >= 3));
  if (!nomes.size) return false;
  const toks = palavras(texto);
  return toks.some((t, i) => {
    if (!nomes.has(t.w)) return false;
    const ant = toks[i - 1], prox = toks[i + 1];
    return /^\s*[,!:]/.test(t.depois) ||                                     // "martinez, viu?"
      (i === 0 && !prox) ||                                                   // "martinez"
      (!prox && /,/.test(t.antes)) ||                                         // "viu isso, martinez"
      (ant !== undefined && SAUDACAO.has(ant.w) && !/[.?]/.test(t.antes));    // "tchau martinez", "oi ana"
  });
}

/**
 * As agentes chamadas pelo NOME nesta mensagem (sem @). `pessoas` = primeiros nomes das pessoas do canal (quem
 * tem o mesmo nome de uma agente não conta como chamar a agente). Mensagem com @ não passa por aqui (o @ manda).
 */
export function chamadasPeloNome(texto: string, agentes: readonly AgenteChamavel[], pessoas: readonly string[] = []): string[] {
  const toks = palavras(texto);
  const humanos = new Set(pessoas.map((p) => semAcento(p).split(/\s+/)[0]).filter(Boolean));
  const agenteEm = (i: number) => {
    const t = toks[i];
    if (!t || t.w.startsWith("@") || humanos.has(t.w)) return null;
    return agentes.find((a) => [a.agentKey, a.nome, a.nome.split(/\s+/)[0] ?? ""].map(semAcento).some((n) => n && n === t.w)) ?? null;
  };
  /** O nome na posição i está CHAMANDO a agente? */
  const chama = (i: number): boolean => {
    const t = toks[i]!, ant = toks[i - 1], prox = toks[i + 1];
    if (ant && (COISA.has(ant.w) || TITULO.has(ant.w) || PARENTE.has(ant.w)) && !/[,!:]/.test(t.antes)) return false; // "a aura", "sobre aura", "rei davi", "minha amiga nina"
    // #551: "teo e zenita, me ajudem" / "teo e zenita são agentes de quê?" — a lista decide pelo último nome
    if (prox?.w === "e" && !/[,!:.?]/.test(t.depois) && agenteEm(i + 2)) return chama(i + 2);
    const vocativo =
      /^\s*[,!:]/.test(t.depois) ||                                        // "aura, me explica"
      (!prox && /,/.test(t.antes)) ||                                       // "me explica isso, aura"
      (ant !== undefined && PEDIDO.has(ant.w) && !/[.?]/.test(t.antes)) ||  // "continue aura", "oi aura"
      (prox !== undefined && PEDIDO.has(prox.w) && !/[.?]/.test(t.depois)); // "aura me ajuda", "aura pode ir"
    if (vocativo) return true;
    // os que também são palavra comum ("aura", "zaeon") só chamam em posição de chamado
    if (NOME_COMUM.has(t.w)) return false;
    // #468: nome PRÓPRIO (Téo, Zenita, Nina…) chama em qualquer posição ("pode seguir em frente teo com a
    // explicação") — #551: menos quando o verbo seguinte conta algo dela ("teo explicou mal, explica você")
    if (prox && !/[,!:.?]/.test(t.depois) && (VERBO_SOBRE.has(prox.w) || NO_PASSADO.test(prox.w))) return false;
    return true;
  };
  const chamadas = new Set<string>();
  toks.forEach((_, i) => {
    const ag = agenteEm(i);
    if (ag && chama(i)) chamadas.add(ag.agentKey);
  });
  return agentes.map((a) => a.agentKey).filter((k) => chamadas.has(k));
}
