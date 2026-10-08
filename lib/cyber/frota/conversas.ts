/**
 * Frota de IAs — as CONVERSAS (PURO). Quando amigos do mesmo grupo (pares de 4) estão no MESMO ambiente ao mesmo tempo
 * — estudando juntos, na corrida de moto, na festa — eles conversam: episódios curtos (2–8 falas, nada que demore), em
 * TURNOS (quem fala alterna, com o tempo de digitar e de ler). O assunto é ESTUDO / TRABALHO / PESQUISA — só ~30% das
 * IAs (as "divagadoras") puxam papo fora disso. A fala de quem está em MODO CLOAK aparece só como "...".
 *
 * O TEXTO das falas visíveis é GERADO no servidor (lib/cyber/ia/motor) na 1ª vez que alguém vê a conversa — o mesmo pra
 * todos — com o jeito do motor do zenith-warmer: um "humor" e uma "direção" sorteados por fala, gírias variadas, curto
 * e minúsculo. REGRA DE OURO: nenhuma frase visível se repete — o servidor guarda a "impressão" normalizada de toda fala
 * mostrada (`normalizarFala`) e refaz a que colidir.
 *
 * E quando um USUÁRIO puxa assunto com uma IA sem cloak: resposta SECA ("iae", "opa", "iai blz?"); se insistir, ela
 * CORTA meio grossa ("kkkk sai fora", "vlw flw", "vou é estudar") e depois ignora (`tomDaResposta`).
 */
import { acasoDe, entre, hash, inteiro, escolher, type Acaso } from "./aleatorio";
import type { AgenteIA } from "./frota";
import type { FlagsFrota } from "./agenda";
import type { PlanoDia } from "./plano";

export type ContextoConversa = "estudo" | "corrida" | "festa";
export type FalaEpisodio = { agente: string; em: number; cloak: boolean };
export type Episodio = { id: string; grupo: number; dia: number; ini: number; contexto: ContextoConversa; ambiente: string; foraDoTema: boolean; falas: FalaEpisodio[] };

/** as regras das conversas */
export const CONVERSA = {
  falasMin: 2, falasMax: 8,
  /** entre um episódio e outro do mesmo encontro (min) */
  intervalo: [12, 30] as const,
  /** digitar + ler cada fala (s) */
  turno: [4, 11] as const,
  /** a fração de IAs que pode fugir do assunto (estudo/trabalho/pesquisa) */
  divagadoras: 0.3,
} as const;
/** essa IA é das que fogem do assunto? (30% da frota, fixo por agente) */
export const divaga = (a: { id: string }) => (hash("divaga", a.id) % 1000) / 1000 < CONVERSA.divagadoras;

/** o número de falas: 2–8, mais comum 3–5 (nada que demore) */
function quantasFalas(r: Acaso): number {
  const x = r(); return x < 0.12 ? 2 : x < 0.35 ? 3 : x < 0.6 ? 4 : x < 0.8 ? 5 : x < 0.9 ? 6 : x < 0.96 ? 7 : 8;
}
/** a ordem de quem fala: quem puxa começa; ninguém fala duas vezes seguidas; às vezes um terceiro entra */
function ordemDasFalas(r: Acaso, presentes: readonly AgenteIA[], n: number): AgenteIA[] {
  const out: AgenteIA[] = [escolher(r, presentes)];
  while (out.length < n) { const ult = out.at(-1)!, outros = presentes.filter((p) => p.id !== ult.id); out.push(outros.length === 1 || r() < 0.7 ? (out.at(-2) && outros.includes(out.at(-2)!) ? out.at(-2)! : escolher(r, outros)) : escolher(r, outros)); }
  return out;
}

/** quem do grupo está JUNTO (mesmo ambiente/evento) em cada janela do dia: [ini, fim, contexto, ambiente, membros] */
type Encontro = { ini: number; fim: number; contexto: ContextoConversa; ambiente: string; ids: Set<string> };
function encontrosDoGrupo(plano: PlanoDia, membros: readonly AgenteIA[]): Encontro[] {
  const lugar = (id: string, m: number) => {
    const b = plano.agentes.get(id)?.blocos.find((x) => m >= x.ini && m < x.fim);
    if (!b) return null;
    if (b.atividade === "festa") return { chave: `festa:${b.evento}`, contexto: "festa" as const, ambiente: "lounge" };
    if (b.atividade === "moto" && b.evento) return { chave: `corrida:${b.evento}`, contexto: "corrida" as const, ambiente: "circuito" };
    if (b.spot) return { chave: `estudo:${b.ambiente}`, contexto: "estudo" as const, ambiente: b.ambiente ?? "?" };
    return null;
  };
  // varre o dia de 2 em 2 min: quem está no mesmo lugar (≥ 2) abre/estende um encontro
  const out: Encontro[] = [], abertos = new Map<string, Encontro>();
  for (let m = 8 * 60; m < 24 * 60; m += 2) {
    const juntos = new Map<string, { ids: string[]; contexto: ContextoConversa; ambiente: string }>();
    for (const a of membros) { const l = lugar(a.id, m); if (l) { const j = juntos.get(l.chave) ?? { ids: [], contexto: l.contexto, ambiente: l.ambiente }; j.ids.push(a.id); juntos.set(l.chave, j); } }
    const vivos = new Set<string>();
    for (const [chave, j] of juntos) {
      if (j.ids.length < 2) continue;
      const k = `${chave}|${[...j.ids].sort().join(",")}`; vivos.add(k);
      const e = abertos.get(k); if (e) e.fim = m + 2; else { const n = { ini: m, fim: m + 2, contexto: j.contexto, ambiente: j.ambiente, ids: new Set(j.ids) }; abertos.set(k, n); out.push(n); }
    }
    for (const k of [...abertos.keys()]) if (!vivos.has(k)) abertos.delete(k);
  }
  return out;
}

/** os EPISÓDIOS de conversa do dia (o mesmo em todo cliente e no servidor) */
export function episodiosDoDia(plano: PlanoDia, flags: FlagsFrota): Episodio[] {
  if (!flags.conversas) return [];
  const grupos = new Map<number, AgenteIA[]>();
  for (const { agente } of plano.agentes.values()) (grupos.get(agente.grupo) ?? grupos.set(agente.grupo, []).get(agente.grupo)!).push(agente);
  const out: Episodio[] = [];
  for (const [g, membros] of grupos) for (const e of encontrosDoGrupo(plano, membros)) {
    const r = acasoDe("conversa", g, plano.dia, e.ini, e.ambiente), presentes = membros.filter((a) => e.ids.has(a.id));
    let m = e.ini + entre(r, 1, 6);   // o primeiro papo logo depois que se encontram ("e aí, estudando o quê?")
    while (m < e.fim - 2) {
      const n = quantasFalas(r), ordem = ordemDasFalas(r, presentes, n), quem = ordem[0]!;
      let em = m; const falas: FalaEpisodio[] = ordem.map((a) => { const f = { agente: a.id, em, cloak: flags.cloak && a.cloak }; em += entre(r, CONVERSA.turno[0], CONVERSA.turno[1]) / 60; return f; });
      out.push({ id: `${g}-${plano.dia}-${Math.round(m * 10)}`, grupo: g, dia: plano.dia, ini: m, contexto: e.contexto, ambiente: e.ambiente, foraDoTema: divaga(quem) && r() < 0.5, falas });
      m += entre(r, CONVERSA.intervalo[0], CONVERSA.intervalo[1]);
    }
  }
  return out.sort((a, b) => a.ini - b.ini);
}
/** um episódio precisa de TEXTO? (alguma fala sem cloak) */
export const precisaDeTexto = (e: Episodio) => e.falas.some((f) => !f.cloak);

// ── o TEXTO (o motor do zenith-warmer, adaptado) ───────────────────────────────────────────────────────────────────
const HUMORES = ["animado e gente boa", "meio cansado e reclamão (de leve)", "curioso e perguntador", "irônico e brincalhão", "tranquilo e good vibes", "um pouco apressado e direto", "focado, quer voltar a estudar logo", "orgulhoso de ter entendido uma coisa difícil"] as const;
const DIRECOES = [
  "faça uma pergunta curta e curiosa sobre o que o outro disse", "comente um detalhe concreto do que está estudando agora",
  "reclame de leve de uma matéria, prova ou prazo", "conte rapidinho uma coisa que aprendeu hoje", "peça uma dica ou um material pro outro",
  "faça uma piada boba sobre a situação", "discorde de leve só pra render", "combine algo pra depois (revisar junto, apresentar, entregar)",
  "reaja com uma gíria e peça um detalhe", "comente o prazo de um trabalho, TCC, artigo ou estágio",
] as const;
const DIRECOES_FORA = ["mude o assunto pra algo de rotina (comida, cansaço, planos do fim de semana)", "comente algo que viu na internet agora", "pergunte uma recomendação de música ou série"] as const;
const TEMAS_ESTUDO = ["prova", "seminário", "TCC", "artigo", "relatório de laboratório", "estágio", "lista de exercícios", "projeto em grupo", "monografia", "pesquisa de iniciação científica", "apresentação", "revisão pra prova", "trabalho do semestre", "entrevista de estágio"] as const;
export const PROIBIDO = "álcool (bebida, cerveja, ressaca, bar), drogas (cigarro, maconha), apostas (bet, cassino, loteria) e sexo";

const ONDE: Record<ContextoConversa, (amb: string) => string> = {
  estudo: (amb) => `estão estudando juntos no tablet, ${amb === "lounge" ? "nos sofás do lounge (tá rolando um som)" : amb === "biblioteca" ? "na biblioteca da Zaeon" : amb === "jardim" ? "no jardim da Zaeon, perto do espelho d'água" : "numa universidade flutuante"}`,
  corrida: () => "estão apostando corrida de moto voadora em volta da cidade Zaeon",
  festa: () => "estão na festa do lounge, dançando (o som tá rolando)",
};
/** o PROMPT do episódio: os personagens, o lugar, o assunto e, fala a fala, quem fala com qual humor e direção */
export function promptEpisodio(e: Episodio, quem: (id: string) => AgenteIA | undefined): { system: string; user: string } {
  const r = acasoDe("prompt", e.id), nomes = [...new Set(e.falas.map((f) => f.agente))].map((id) => quem(id)!).filter(Boolean);
  const tema = e.foraDoTema ? "papo do dia a dia (qualquer assunto leve)" : `estudos, trabalho ou pesquisa — puxe pra ${escolher(r, TEMAS_ESTUDO)}`;
  const system = [
    "você escreve as falas de um chat curtinho entre amigos universitários brasileiros (20-30 anos), dentro de um mundo virtual de estudos.",
    "objetivo: soar 100% humano, como mensagem de celular entre amigos.",
    "regras:",
    "- cada fala tem no máximo 90 caracteres; muitas são bem curtas (2 a 8 palavras)",
    "- letras minúsculas e pontuação relaxada; gírias naturais e VARIADAS (nunca repita a mesma gíria nem a mesma estrutura de frase na conversa)",
    "- no máximo 1 emoji em algumas falas, não em todas",
    "- nada de 'Pessoa A:' nem o nome de quem fala no começo da fala",
    "- a conversa é rápida: começa e termina nessas falas (pode terminar com alguém voltando a estudar/correr/dançar)",
    "- nunca diga que é IA, bot ou personagem; nunca cite marcas reais",
    `- conteúdo livre para todos os públicos: NUNCA mencione ${PROIBIDO}`,
    "- responda SÓ com JSON: {\"falas\": [\"...\", ...]} com exatamente as falas pedidas, na ordem",
  ].join("\n");
  const user = [
    `quem está aqui: ${nomes.map((a) => `${a.nome.split(" ")[0]} (${a.genero === "f" ? "ela" : "ele"}, cursa ${a.curso})`).join("; ")}.`,
    `onde: ${ONDE[e.contexto](e.ambiente)}.`,
    `assunto: ${tema}.`,
    `escreva ${e.falas.length} falas, nesta ordem:`,
    ...e.falas.map((f, i) => { const a = quem(f.agente)!; return `${i + 1}. ${a.nome.split(" ")[0]} — humor: ${escolher(r, HUMORES)}; direção: ${e.foraDoTema && r() < 0.5 ? escolher(r, DIRECOES_FORA) : escolher(r, DIRECOES)}`; }),
  ].join("\n");
  return { system, user };
}
/** valida o JSON da IA: as falas (n), limpas e curtas; inválido → null */
export function validarFalas(bruto: unknown, n: number): string[] | null {
  const l = (bruto as { falas?: unknown })?.falas;
  if (!Array.isArray(l) || l.length < n) return null;
  const out = l.slice(0, n).map((x) => (typeof x === "string" ? limparFala(x) : ""));
  return out.every((x) => x.length > 0) ? out : null;
}
/** tira rótulos ("Ana:"), aspas, quebra de linha; corta em 120 */
export function limparFala(s: string): string {
  return s.replace(/^\s*["'“”]+|["'“”]+\s*$/g, "").replace(/^[\p{L} ]{1,20}:\s+/u, "").replace(/\s+/g, " ").trim().slice(0, 120);
}
/** a IMPRESSÃO de uma fala pra regra "nada se repete": minúscula, sem acento, sem pontuação/emoji, espaços únicos.
 *  Duas falas com a mesma impressão = repetida */
export function normalizarFala(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

// ── responder a um USUÁRIO (as IAs sem cloak) ─────────────────────────────────────────────────────────────────────
export type TomResposta = "seco" | "corta" | "ignora";
/** 1ª e 2ª vez: SECO; 3ª e 4ª: CORTA (um pouco grosso); depois: ignora */
export const tomDaResposta = (tentativa: number): TomResposta => (tentativa <= 2 ? "seco" : tentativa <= 4 ? "corta" : "ignora");
export function promptResposta(a: AgenteIA, tom: Exclude<TomResposta, "ignora">, textoDoUsuario: string, nonce: number): { system: string; user: string } {
  const r = acasoDe("resp", a.id, nonce);
  const system = [
    `você é ${a.nome.split(" ")[0]}, ${a.genero === "f" ? "uma estudante" : "um estudante"} brasileir${a.genero === "f" ? "a" : "o"} de ${a.curso}, num mundo virtual, ocupad${a.genero === "f" ? "a" : "o"} estudando.`,
    "um desconhecido puxou assunto com você. você NÃO quer papo.",
    tom === "seco"
      ? "responda SECO e curtíssimo (1 a 4 palavras), sem continuar a conversa, sem perguntar nada de volta (no máximo um 'blz?'). exemplos do TOM (não copie): iae / opa / iai blz?"
      : "corte a conversa sendo um pouco grosseir" + (a.genero === "f" ? "a" : "o") + " mas sem ofender (1 a 5 palavras). exemplos do TOM (não copie): kkkk sai fora / vlw flw / vou é estudar",
    "minúsculas, gíria brasileira, sem emoji ou com no máximo 1. nunca diga que é IA.",
    `nunca mencione ${PROIBIDO}.`,
    "responda SÓ com JSON: {\"fala\": \"...\"}",
  ].join("\n");
  return { system, user: `ele disse: "${textoDoUsuario.slice(0, 200)}". (variação ${inteiro(r, 1, 9999)})` };
}
