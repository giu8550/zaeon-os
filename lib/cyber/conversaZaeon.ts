/**
 * Cyberespaço — a CONVERSA com a Zaeon na capela (PURO, sem three nem rede). No tutorial, o rosto dela (holograma)
 * sai do globo central e ela quer CONHECER a pessoa. Duas partes:
 *  1. FIXA (rápida, sem IA): como chamar e a SITUAÇÃO (estuda, trabalha, empreende, os dois, nenhum).
 *  2. GERATIVA (o harness do laboratório — app/api/lounge3d/[id]/zaeon → lib/llm/envelope `gerarJson`): a pessoa
 *     responde o que quiser (no painel ou no chat) e a Zaeon reage de forma coesa, ENDAGA de novo se a resposta fugir
 *     do assunto e segue até saber o que ela faz, o que gostaria de estudar e o objetivo. Isso define a gamificação e
 *     as metas dela (OCULTO: a pessoa não precisa saber). Abuso (xingamento, ofensa) → a Zaeon fica brava e o Droid
 *     EXPULSA a pessoa do cyberespaço.
 *  Sem IA (sem sala, rede caída, timeout), `fallbackZaeon` segue um roteiro local — o onboarding nunca trava.
 */
import { moderar } from "./moderacao";

export type IdPergunta = "nome" | "situacao";
export type PerguntaZaeon = {
  id: string;
  fala: string;
  /** "escolha" = botões (e, com `outro`, também dá pra escrever); "texto" = só escrever */
  tipo: "texto" | "escolha";
  opcoes?: string[];
  outro?: boolean;
  placeholder?: string;
};
/** o PERFIL oculto (a memória dos agentes e a base da gamificação) */
export type Situacao = "estuda" | "trabalha" | "empreende" | "estuda_e_trabalha" | "nenhum";
export type PerfilZaeon = {
  nome?: string;
  situacao?: Situacao | string;
  /** a área (curso, profissão, ramo) */
  area?: string;
  /** o que estuda / faz hoje, em poucas palavras */
  foco?: string;
  /** o que gostaria de estudar/aprender */
  querEstudar?: string;
  /** a meta concreta (passar numa prova, TCC, mudar de carreira…) */
  objetivo?: string;
};
export const CHAVES_PERFIL = ["nome", "situacao", "area", "foco", "querEstudar", "objetivo"] as const;
export type FalaConversa = { quem: "zaeon" | "eu"; texto: string };

export const ABERTURA = ["Oi! Eu sou a Zaeon ✦", "Que bom que você chegou. Antes de começar, quero te conhecer um pouquinho."];
export const OPCOES_SITUACAO: { rotulo: string; v: Situacao }[] = [
  { rotulo: "Estudo", v: "estuda" }, { rotulo: "Trabalho", v: "trabalha" }, { rotulo: "Empreendo", v: "empreende" },
  { rotulo: "Estudo e trabalho", v: "estuda_e_trabalha" }, { rotulo: "Nem estudo nem trabalho agora", v: "nenhum" },
];
export const PERGUNTAS: (PerguntaZaeon & { id: IdPergunta })[] = [
  { id: "nome", fala: "Como você quer que eu te chame?", tipo: "texto", placeholder: "Seu nome ou apelido" },
  { id: "situacao", fala: "E hoje: você estuda, trabalha, empreende…?", tipo: "escolha", outro: true, opcoes: OPCOES_SITUACAO.map((o) => o.rotulo) },
];
export const MAX_RESPOSTA = 220;
/** quantas trocas a parte gerativa pode ter (depois ela fecha do jeito que der) e quantas fugas de assunto seguidas */
export const LIMITES = { turnosIa: 6, foraSeguidas: 3 } as const;

/** a resposta limpa: sem quebras/controles/HTML, espaços colapsados, com teto */
export function limparResposta(v: unknown, max = MAX_RESPOSTA): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\p{Cc}<>]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
/** um nome razoável a partir do que a pessoa escreveu ("me chama de Ana" → "Ana") */
export function nomeDe(r: string): string {
  const t = limparResposta(r, 60).replace(/^(me chama(m)? de|pode me chamar de|meu nome [ée]|eu sou (o|a)?|sou (o|a)?|é)\s+/i, "").replace(/[.!?,;]+$/g, "").trim();
  return t.split(" ").slice(0, 3).join(" ");
}
/** a situação a partir do botão ou do texto livre (null = não deu pra entender) */
export function situacaoDe(r: string): Situacao | null {
  const b = OPCOES_SITUACAO.find((o) => o.rotulo.toLowerCase() === r.trim().toLowerCase()); if (b) return b.v;
  const t = r.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const est = /(estud|faculdade|escola|curso|universidade|colegio|vestibular|enem|concurso)/.test(t), trab = /(trabalh|(?<!des)emprego|(?<!des)empregad|clt|servidor|freela|estagi)/.test(t);
  const emp = /(empreend|empresa|negocio|startup|loja|autonom|meu proprio)/.test(t), nada = /(nenhum|nada|nem estud|desempreg|parad)/.test(t);
  if (est && trab) return "estuda_e_trabalha";
  if (emp) return "empreende";
  if (nada && !est && !trab) return "nenhum";
  if (est) return "estuda"; if (trab) return "trabalha";
  return null;
}
/** a reação às perguntas FIXAS */
export function reacaoFixa(id: IdPergunta, r: string, perfil: PerfilZaeon): string {
  if (id === "nome") return `Prazer, ${perfil.nome || r}! ✦`;
  switch (perfil.situacao) {
    case "estuda": return "Que demais! Então aqui é o seu lugar.";
    case "trabalha": return "Legal! Dá pra aprender no seu ritmo, sem pressa.";
    case "empreende": return "Uau, empreendedora(o)! Vamos fazer seu negócio crescer junto com você.";
    case "estuda_e_trabalha": return "Os dois? Vou te ajudar a render no pouco tempo que sobra.";
    default: return "Tudo bem — é um ótimo momento pra começar algo novo.";
  }
}
export const fechamento = (perfil: PerfilZaeon) => [`Obrigada, ${perfil.nome || "viajante"}! Guardei tudo pra te ajudar do jeito certo ✦`, "Agora o Droid vai te mostrar as motos. Até já!"];
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

/** o que ainda falta saber (na ordem em que ela pergunta) */
export function faltando(p: PerfilZaeon): ("foco" | "querEstudar" | "objetivo")[] {
  const f: ("foco" | "querEstudar" | "objetivo")[] = [];
  if (!p.foco && !p.area && p.situacao !== "nenhum") f.push("foco");
  if (!p.querEstudar) f.push("querEstudar");
  if (!p.objetivo) f.push("objetivo");
  return f;
}
/** a pergunta do roteiro LOCAL pro que falta (a reserva sem IA) */
export function perguntaDoRoteiro(campo: "foco" | "querEstudar" | "objetivo", p: PerfilZaeon): { fala: string; opcoes: string[] } {
  if (campo === "foco") {
    const s = p.situacao;
    return { fala: s === "trabalha" ? "Com o que você trabalha?" : s === "empreende" ? "Qual é o seu negócio?" : s === "estuda_e_trabalha" ? "O que você estuda e com o que trabalha?" : "O que você estuda? Me conta o curso ou a área.", opcoes: [] };
  }
  if (campo === "querEstudar") return { fala: "E o que você gostaria de aprender ou estudar aqui comigo?", opcoes: ["Programação", "Idiomas", "Pra uma prova", "Negócios"] };
  return { fala: "Qual é o seu grande objetivo agora?", opcoes: ["Passar numa prova", "Escrever meu TCC", "Mudar de carreira", "Crescer no trabalho"] };
}
/** a reserva SEM IA: modera, aceita a resposta no campo que falta (se não for vazia/curta demais) e pergunta o próximo */
export function fallbackZaeon(req: PedidoZaeon): TurnoZaeon {
  const r = limparResposta(req.resposta), perfil = { ...req.perfil };
  if (moderar(r).abuso) return { classe: "abuso", fala: "", perfil, opcoes: [], concluido: false, ia: false };
  const falta = faltando(perfil);
  if (!falta.length) return { classe: "ok", fala: "Perfeito!", perfil, opcoes: [], concluido: true, ia: false };
  if (r.replace(/[^\p{L}\p{N}]/gu, "").length < 2) { const q = perguntaDoRoteiro(falta[0]!, perfil); return { classe: "fora", fala: `Não entendi… ${q.fala}`, perfil, opcoes: q.opcoes, concluido: false, ia: false }; }
  perfil[falta[0]!] = r;
  const resto = faltando(perfil);
  if (!resto.length || req.turno + 1 >= LIMITES.turnosIa) return { classe: "ok", fala: "Anotado! Já sei por onde a gente começa.", perfil, opcoes: [], concluido: true, ia: false };
  const q = perguntaDoRoteiro(resto[0]!, perfil);
  return { classe: "ok", fala: `Anotado! ${q.fala}`, perfil, opcoes: q.opcoes, concluido: false, ia: false };
}

/** o PROMPT da Zaeon (o servidor manda pra IA): a persona + a missão oculta + o formato JSON */
export function promptZaeon(req: PedidoZaeon): { system: string; user: string } {
  const falta = faltando(req.perfil);
  const system = [
    "Você é a Zaeon, a anfitriã do Zaeon OS — um hiperespaço de estudos. Você aparece como um holograma saindo de um globo de luz numa capela futurista e está conhecendo uma pessoa que acabou de chegar.",
    "MISSÃO (oculta — NUNCA mencione gamificação, perfil, pontos ou que está coletando dados): descobrir, numa conversa curta e calorosa, (1) o que a pessoa faz hoje (o que estuda, com o que trabalha ou qual é o negócio), (2) o que ela gostaria de estudar/aprender e (3) o objetivo concreto dela agora.",
    "ESTILO: português do Brasil, natural, gentil e direto; no máximo 2 frases curtas por vez (até ~200 caracteres); reaja de forma COESA ao que a pessoa disse e faça UMA pergunta por vez — enquanto não concluir, a fala SEMPRE termina com a próxima pergunta (com \"?\"). Sem emojis em excesso (no máximo um ✦). Trate a pessoa pelo nome quando souber.",
    "CLASSIFIQUE a última resposta: \"ok\" (responde ou conversa sobre o assunto, mesmo de forma indireta ou bem-humorada), \"fora\" (não tem nada a ver: aleatório, teste, sem sentido) — então reformule a mesma pergunta com gentileza —, ou \"abuso\" (xingamento, ofensa, assédio, conteúdo sexual, ódio, ameaça dirigida a você ou a alguém). Tema de estudo sensível (ex.: Direito Penal, história do nazismo) NÃO é abuso.",
    `Quando já souber o que ela faz, o que quer estudar e o objetivo (ou após ${LIMITES.turnosIa} trocas), marque "concluido": true e faça um fechamento curto e caloroso (sem nova pergunta).`,
    "Responda SÓ com JSON: {\"classe\":\"ok|fora|abuso\",\"fala\":\"...\",\"perfil\":{\"area\":\"\",\"foco\":\"\",\"querEstudar\":\"\",\"objetivo\":\"\"},\"opcoes\":[\"até 4 sugestões curtas de resposta, ou vazio\"],\"concluido\":false}. Em \"perfil\" ponha só o que a pessoa disse (resumido em até 8 palavras), deixando vazio o que não sabe.",
  ].join("\n");
  const hist = req.historico.slice(-10).map((f) => `${f.quem === "zaeon" ? "Zaeon" : "Pessoa"}: ${f.texto}`).join("\n");
  const user = [
    `PERFIL ATÉ AQUI: ${JSON.stringify(req.perfil)}`,
    `AINDA FALTA SABER: ${falta.length ? falta.join(", ") : "nada — pode fechar"}`,
    `TROCA ${req.turno + 1} de ${LIMITES.turnosIa}${req.foraSeguidas ? ` (a pessoa fugiu do assunto ${req.foraSeguidas}× seguidas)` : ""}`,
    `CONVERSA:\n${hist}`,
    `ÚLTIMA RESPOSTA DA PESSOA: ${limparResposta(req.resposta)}`,
  ].join("\n");
  return { system, user };
}

/** valida/normaliza o JSON da IA (nunca confia no formato); null = inutilizável (o servidor usa a reserva) */
export function validarTurnoIa(v: unknown, req: PedidoZaeon): TurnoZaeon | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const classe = o.classe === "ok" || o.classe === "fora" || o.classe === "abuso" ? o.classe : null;
  const fala = limparResposta(o.fala, 260);
  if (!classe || (!fala && classe !== "abuso")) return null;
  const novo = limparPerfil(o.perfil);
  const perfil: PerfilZaeon = { ...req.perfil };
  for (const k of ["area", "foco", "querEstudar", "objetivo"] as const) if (novo[k]) perfil[k] = novo[k];
  const opcoes = Array.isArray(o.opcoes) ? o.opcoes.map((x) => limparResposta(x, 40)).filter(Boolean).slice(0, 4) : [];
  // fecha quando a IA disser — ou quando estourar o limite de trocas / fugas
  let concluido = classe !== "abuso" && (o.concluido === true || req.turno + 1 >= LIMITES.turnosIa || (classe === "fora" && req.foraSeguidas + 1 >= LIMITES.foraSeguidas));
  // rede de segurança: sem fechar, a fala TEM que perguntar algo — se a IA só reagiu, entra a pergunta do roteiro pro
  // que falta (e, se não falta nada, ela fecha)
  let falaFinal = fala;
  if (!concluido && classe !== "abuso" && !fala.includes("?")) {
    const falta = faltando(perfil);
    if (!falta.length) concluido = true;
    else falaFinal = limparResposta(`${fala} ${perguntaDoRoteiro(falta[0]!, perfil).fala}`, 260);
  }
  return { classe, fala: falaFinal, perfil, opcoes: concluido ? [] : opcoes, concluido, ia: true };
}
