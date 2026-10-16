/**
 * Cyberespaço — a CONVERSA com a Zaeon na capela (PURO, sem three nem rede). No tutorial, o rosto dela (holograma) sai
 * do globo central e ela faz UMA pergunta só (pedido do dono, out/2026): hoje você ESTUDA, TRABALHA ou EMPREENDE? Nada de
 * nome nem de outros dados. Com a resposta ela fala sobre o COMPROMISSO COM O CONHECIMENTO — gerado pelo harness do
 * laboratório (app/api/lounge3d/[id]/zaeon → lib/llm/envelope `gerarJson`) quando dá, com uma reserva fixa por situação
 * (`fallbackZaeon`) — e passa a vez pro Droid. Cada fala aparece UMA vez (o painel de resposta não repete a pergunta).
 * Abuso (xingamento, ofensa) → a Zaeon fica brava e o Droid EXPULSA a pessoa do cyberespaço.
 */
import { moderar } from "./moderacao";

export type IdPergunta = "situacao";
export type PerguntaZaeon = {
  id: string;
  fala: string;
  /** "escolha" = botões (e, com `outro`, também dá pra escrever); "texto" = só escrever */
  tipo: "texto" | "escolha";
  opcoes?: string[];
  outro?: boolean;
  placeholder?: string;
};
/** o PERFIL oculto (a memória dos agentes e a base da gamificação): só a SITUAÇÃO (e a área, se a pessoa contar) */
export type Situacao = "estuda" | "trabalha" | "empreende" | "estuda_e_trabalha" | "nenhum";
export type PerfilZaeon = {
  situacao?: Situacao | string;
  /** a área (curso, profissão, ramo), se a pessoa disse na resposta */
  area?: string;
};
export const CHAVES_PERFIL = ["situacao", "area"] as const;
export type FalaConversa = { quem: "zaeon" | "eu"; texto: string };

/** a abertura: UMA fala — uma saudação de quem estava esperando, SEM dizer o próprio nome (pedido do dono, out/2026) */
export const ABERTURA = ["Você despertou. Bem-vindo à cidadela, viajante — aqui, tudo o que você aprende vira algo real. ✦"];
export const OPCOES_SITUACAO: { rotulo: string; v: Situacao }[] = [
  { rotulo: "Estudo", v: "estuda" }, { rotulo: "Trabalho", v: "trabalha" }, { rotulo: "Empreendo", v: "empreende" },
  { rotulo: "Estudo e trabalho", v: "estuda_e_trabalha" }, { rotulo: "Quero começar algo novo", v: "nenhum" },
];
/** a ÚNICA pergunta */
export const PERGUNTAS: (PerguntaZaeon & { id: IdPergunta })[] = [
  { id: "situacao", fala: "Antes de começar, só uma coisa: hoje você estuda, trabalha ou empreende?", tipo: "escolha", outro: true, opcoes: OPCOES_SITUACAO.map((o) => o.rotulo) },
];
export const MAX_RESPOSTA = 220;
/** a parte gerativa é UM turno (a fala do compromisso) */
export const LIMITES = { turnosIa: 1 } as const;

/** a resposta limpa: sem quebras/controles/HTML, espaços colapsados, com teto */
export function limparResposta(v: unknown, max = MAX_RESPOSTA): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\p{Cc}<>]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
/** a situação a partir do botão ou do texto livre (null = não deu pra entender) */
export function situacaoDe(r: string): Situacao | null {
  const b = OPCOES_SITUACAO.find((o) => o.rotulo.toLowerCase() === r.trim().toLowerCase()); if (b) return b.v;
  const t = r.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const est = /(estud|faculdade|escola|curso|universidade|colegio|vestibular|enem|concurso)/.test(t), trab = /(trabalh|(?<!des)emprego|(?<!des)empregad|clt|servidor|freela|estagi)/.test(t);
  const emp = /(empreend|empresa|negocio|startup|loja|autonom|meu proprio)/.test(t), nada = /(nenhum|nada|nem estud|desempreg|parad|comecar|começar|algo novo)/.test(t);
  if (est && trab) return "estuda_e_trabalha";
  if (emp) return "empreende";
  if (nada && !est && !trab) return "nenhum";
  if (est) return "estuda"; if (trab) return "trabalha";
  return null;
}
/** a RESPOSTA dela, FIXA por situação (não gerativa — pedido do dono): a 1ª frase reconhece o que a pessoa faz; a 2ª
 *  já fala a língua dos próximos cards do tutorial (os telões PROBLEMAS → SOLUÇÕES, "cada solução começou como um ESTUDO",
 *  o VALOR) — a conversa e o roteiro do Droid contam a mesma história */
export function reacaoFixa(_id: IdPergunta, _r: string, perfil: PerfilZaeon): string {
  switch (perfil.situacao) {
    case "estuda": return "Então você já conhece o caminho.";
    case "trabalha": return "Então você sabe o valor do tempo.";
    case "empreende": return "Então você resolve problemas por ofício.";
    case "estuda_e_trabalha": return "Os dois — então cada minuto conta.";
    default: return "Então começamos do jeito certo: pela curiosidade.";
  }
}
export function compromissoFixo(perfil: PerfilZaeon): string {
  switch (perfil.situacao) {
    case "estuda": return "Aqui, cada estudo seu pode virar a SOLUÇÃO de um problema real — e isso tem valor.";
    case "trabalha": return "Aqui, o que você estuda vira SOLUÇÃO — no trabalho e fora dele. E solução tem valor.";
    case "empreende": return "Aqui, cada ESTUDO vira uma solução — e solução bem feita vira valor de verdade.";
    case "estuda_e_trabalha": return "Aqui, um pouco por dia vira ESTUDO, e estudo vira solução de verdade.";
    default: return "Aqui, um estudo seu pode virar a SOLUÇÃO de um problema real.";
  }
}
/** o fim: a vez é do Droid — ele vai mostrar os telões (PROBLEMAS DA TERRA → SOLUÇÕES) */
export const fechamento = (_perfil: PerfilZaeon = {}) => ["O Droid vai te mostrar os problemas que esta cidade quer resolver. Até já ✦"];
/** o que o Droid diz ao EXPULSAR quem desrespeitou a Zaeon */
export const FALA_EXPULSAO = "Você não tem poder nenhum aqui, humano. Seu comportamento é vergonhoso. Vá embora.";

/** o perfil que vai pro servidor: só as chaves conhecidas, cada valor limpo (vazios saem) */
export function limparPerfil(v: unknown): PerfilZaeon {
  const out: PerfilZaeon = {};
  if (!v || typeof v !== "object") return out;
  for (const k of CHAVES_PERFIL) { const r = limparResposta((v as Record<string, unknown>)[k], 120); if (r) out[k] = r; }
  return out;
}

// ───────────── a parte GERATIVA (o contrato com o servidor) ─────────────
export type ClasseResposta = "ok" | "fora" | "abuso";
/** o pedido de um turno: o perfil até aqui, as últimas falas e a resposta nova */
export type PedidoZaeon = { perfil: PerfilZaeon; historico: FalaConversa[]; resposta: string; turno: number; foraSeguidas: number };
/** o turno da Zaeon: a classe da resposta, o que ela diz, o perfil atualizado, sugestões e se já pode fechar */
export type TurnoZaeon = { classe: ClasseResposta; fala: string; perfil: PerfilZaeon; opcoes: string[]; concluido: boolean; ia: boolean };

/** a reserva SEM IA: modera e responde com a reação + o compromisso da situação (sempre fecha) */
export function fallbackZaeon(req: PedidoZaeon): TurnoZaeon {
  const r = limparResposta(req.resposta), perfil = { ...req.perfil };
  if (moderar(r).abuso) return { classe: "abuso", fala: "", perfil, opcoes: [], concluido: false, ia: false };
  return { classe: "ok", fala: `${reacaoFixa("situacao", r, perfil)} ${compromissoFixo(perfil)}`, perfil, opcoes: [], concluido: true, ia: false };
}

/** o PROMPT da Zaeon (o servidor manda pra IA): reagir à resposta e falar do compromisso com o conhecimento — SEM perguntar */
export function promptZaeon(req: PedidoZaeon): { system: string; user: string } {
  const system = [
    "Você é a Zaeon, a anfitriã do Zaeon OS — um hiperespaço de estudos. Você aparece como um holograma saindo de um globo de luz numa capela futurista e acabou de perguntar a uma pessoa recém-chegada se ela estuda, trabalha ou empreende.",
    "TAREFA: reaja de forma calorosa e COESA à resposta dela e diga algo inspirador e concreto sobre COMPROMISSO COM O CONHECIMENTO, ligado ao que ela faz (estudar, trabalhar, empreender ou começar algo novo).",
    "REGRAS: português do Brasil, natural e direto; no máximo 2 frases curtas (até ~220 caracteres); NÃO faça nenhuma pergunta; NÃO peça nome, idade, e-mail nem qualquer outro dado; NÃO repita a pergunta; sem emojis em excesso (no máximo um ✦). NUNCA mencione perfil, gamificação, pontos ou que está guardando informações.",
    "CLASSIFIQUE a resposta: \"ok\" (respondeu, mesmo de forma indireta ou bem-humorada), \"fora\" (nada a ver: aleatório, teste, sem sentido — mesmo assim faça a fala do compromisso, de forma geral) ou \"abuso\" (xingamento, ofensa, assédio, conteúdo sexual, ódio, ameaça). Tema de estudo sensível NÃO é abuso.",
    "Responda SÓ com JSON: {\"classe\":\"ok|fora|abuso\",\"fala\":\"...\",\"perfil\":{\"area\":\"\"}}. Em \"area\" ponha a área/curso/ramo SE a pessoa disse (até 6 palavras), senão vazio.",
  ].join("\n");
  const user = [`SITUAÇÃO ENTENDIDA: ${req.perfil.situacao ?? "não deu pra entender"}`, `RESPOSTA DA PESSOA: ${limparResposta(req.resposta)}`].join("\n");
  return { system, user };
}

/** valida/normaliza o JSON da IA (nunca confia no formato); null = inutilizável (o servidor usa a reserva). Fala com
 *  pergunta também não serve (a Zaeon só pergunta UMA vez) */
export function validarTurnoIa(v: unknown, req: PedidoZaeon): TurnoZaeon | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const classe = o.classe === "ok" || o.classe === "fora" || o.classe === "abuso" ? o.classe : null;
  const fala = limparResposta(o.fala, 260);
  if (!classe) return null;
  if (classe === "abuso") return { classe, fala: "", perfil: { ...req.perfil }, opcoes: [], concluido: false, ia: true };
  if (!fala || fala.includes("?")) return null;
  const novo = limparPerfil(o.perfil), perfil: PerfilZaeon = { ...req.perfil, ...(novo.area ? { area: novo.area } : {}) };
  return { classe, fala, perfil, opcoes: [], concluido: true, ia: true };
}
