/**
 * Frota de IAs — a AGENDA DO DIA (PURO, determinística). Cada IA leva o dia no seu ritmo:
 *  - começa a partir das 9h (+ o atraso de costume dela, que muda um pouco a cada dia);
 *  - ESTUDA de 5 a 8 h no total (as mulheres tendem a estudar mais — o `foco` delas é maior), em blocos de ~1 h, com
 *    INTERVALOS de 30 a 60 min em que sai do modo estudo e faz outra coisa;
 *  - no tempo todo do dia: a maior parte estudando no tablet nas PLATAFORMAS DE ESTUDO (de preferência nas
 *    UNIVERSIDADES flutuantes), um pouco nos SOFÁS DO LOUNGE (onde rola som), MOTO visitando outros lugares do mapa e
 *    pouca gente a pé na própria Zaeon — e com CONTEXTO: em turma, nos pontos de interesse (os telões dos mirantes, o
 *    salão da capela), nunca vagando (out/2026, o dono pediu levar o movimento pras universidades);
 *  - às vezes, à noite, a FESTA no lounge com o grupo (só acontece se estiver rolando som — o engine confere na hora);
 *  - os amigos se ACHAM: escolhem o mesmo lugar de estudo com frequência e, quando os intervalos se cruzam, fazem
 *    CORRIDA de moto juntos (em dupla ou em bando).
 * Tempo em MINUTOS desde a meia-noite (hora de Fortaleza). Tudo sai de sementes (agente, dia): o mesmo em todo cliente.
 */
import { acasoDe, entre, inteiro, ponderado, escolher, type Acaso } from "./aleatorio";
import type { AgenteIA } from "./frota";

export type Atividade = "estudo-plataforma" | "estudo-lounge" | "moto" | "andar" | "festa";
export type Bloco = {
  ini: number; fim: number; atividade: Atividade;
  /** onde (estudo: o ambiente; moto/andar: o roteiro do passeio) */
  ambiente?: AmbienteEstudo;
  /** atividade em GRUPO (corrida de moto, festa): o id do evento — quem tem o mesmo id está junto */
  evento?: string;
  /** passeio a pé (`andar`): a TURMA no dia (grupo|dia) — os amigos sorteiam os mesmos pontos de interesse e ficam juntos */
  turma?: string;
};
/** os ambientes de estudo (as universidades flutuantes e as salas de convivência da Zaeon). A ORDEM importa: quem acha
 *  o seu lotado vai pro primeiro com lugar (lib/cyber/frota/plano) — as universidades vêm antes */
export const AMBIENTES_ESTUDO = ["univ", "ufc", "unifor", "uece", "biblioteca", "jardim"] as const;
/** o peso de cada ambiente na escolha do lugar de estudo: as universidades levam a maior parte (a Zaeon ~18%) */
export const PESO_AMBIENTE: Readonly<Record<(typeof AMBIENTES_ESTUDO)[number], number>> = { univ: 3, ufc: 2, unifor: 2, uece: 2, biblioteca: 1, jardim: 1 };
/** `cidadela` = o lugar FIXO de quem tem credencial na hierarquia da cidadela (lib/cyber/frota/hierarquia) */
export type AmbienteEstudo = (typeof AMBIENTES_ESTUDO)[number] | "lounge" | "cidadela";

/** as chaves que o painel CEO liga e desliga */
export type FlagsFrota = {
  ativa: boolean; estudoPlataforma: boolean; estudoLounge: boolean; moto: boolean; andar: boolean; festa: boolean;
  corridas: boolean; conversas: boolean; cloak: boolean; mochila: boolean; responderUsuarios: boolean;
};
export const FLAGS_PADRAO: FlagsFrota = { ativa: true, estudoPlataforma: true, estudoLounge: true, moto: true, andar: true, festa: true, corridas: true, conversas: true, cloak: true, mochila: true, responderUsuarios: true };

/** a proporção do dia (o pedido do dono; out/2026: menos lounge e menos pedestre na Zaeon — eram 40/20/30/10) */
export const PROPORCAO = { "estudo-plataforma": 57, "estudo-lounge": 8, moto: 30, andar: 5 } as const;
/** os CONTROLES POR ÁREA que o painel admin mexe (lib/cyber/frota/config `areas`): a proporção do dia, o peso de cada
 *  lugar de estudo, quantos lugares no CHÃO do lounge e quantas vagas por estacionamento. O padrão = as constantes daqui */
export type AreasFrota = {
  proporcao: { estudoPlataforma: number; estudoLounge: number; moto: number; andar: number };
  pesos: Record<(typeof AMBIENTES_ESTUDO)[number], number>;
  loungeChao: number; vagas: number;
};
export const AREAS_PADRAO: AreasFrota = {
  proporcao: { estudoPlataforma: PROPORCAO["estudo-plataforma"], estudoLounge: PROPORCAO["estudo-lounge"], moto: PROPORCAO.moto, andar: PROPORCAO.andar },
  pesos: { ...PESO_AMBIENTE }, loungeChao: 60, vagas: 33,
};
/** os pesos do lugar de estudo (sem nenhum peso: ninguém estuda nas plataformas) */
const algumPeso = (ar: AreasFrota) => Object.values(ar.pesos).some((v) => v > 0);
export const REGRAS = {
  inicio: 9 * 60,
  /** estudo total por dia (min) */
  estudoMin: 5 * 60, estudoMax: 8 * 60,
  /** blocos de estudo e intervalos (min): quem tem mais FOCO estuda em blocos mais longos e para menos tempo */
  bloco: [35, 80] as const, intervalo: [30, 60] as const,
  /** a festa (início entre 19h e 21h, dura 40–100 min) e a chance do grupo ir num dia */
  festaIni: [19 * 60, 21 * 60] as const, festaDur: [40, 100] as const, festaChance: 0.35,
  /** chance de folgar o dia */
  folga: 0.05,
  /** a corrida: precisa de pelo menos esse tanto de intervalo em comum (min) */
  corridaMin: 12,
} as const;

/** o dia (número) de um instante — na hora de Fortaleza (UTC−3) */
export const FUSO_MIN = -3 * 60;
export const diaDe = (ms: number) => Math.floor((ms + FUSO_MIN * 60000) / 86400000);
export const minutoDoDia = (ms: number) => { const m = (ms + FUSO_MIN * 60000) / 60000; return m - Math.floor(m / 1440) * 1440; };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** a escolha do lugar de estudo do bloco: plataforma × lounge (PROPORCAO), com a preferência do GRUPO no dia */
function lugarDeEstudo(r: Acaso, flags: FlagsFrota, preferido: AmbienteEstudo | null, ar: AreasFrota): { atividade: Atividade; ambiente: AmbienteEstudo } | null {
  const pesos = { "estudo-plataforma": flags.estudoPlataforma && preferido ? ar.proporcao.estudoPlataforma : 0, "estudo-lounge": flags.estudoLounge ? ar.proporcao.estudoLounge : 0 };
  if (!pesos["estudo-plataforma"] && !pesos["estudo-lounge"]) return null;
  const at = ponderado(r, pesos);
  if (at === "estudo-lounge") return { atividade: at, ambiente: "lounge" };
  return { atividade: at, ambiente: r() < 0.62 && preferido ? preferido : ponderado(r, ar.pesos) };   // o grupo tende a estudar junto
}
/** o que fazer no intervalo: moto × andar (PROPORCAO), puxado pelo gosto de cada um */
function atividadeDoIntervalo(r: Acaso, a: AgenteIA, flags: FlagsFrota, ar: AreasFrota): Atividade | null {
  const pesos = { moto: flags.moto ? ar.proporcao.moto * (0.6 + 0.8 * a.ritmo.moto) : 0, andar: flags.andar ? ar.proporcao.andar * (1.4 - 0.8 * a.ritmo.moto) : 0 };
  if (!pesos.moto && !pesos.andar) return null;
  return ponderado(r, pesos);
}

/** a agenda de UM agente no dia (sem os eventos de grupo — veja `agendaDoGrupo`). `full` = o MODO FULL (o dono quebra a
 *  regra por uns dias): o dia é CONTÍNUO, da meia-noite à meia-noite — estudo e intervalos se alternando o dia inteiro,
 *  sem folga e sem hora de começar (todo mundo online o tempo todo) */
export function agendaBase(a: AgenteIA, dia: number, flags: FlagsFrota, preferido: AmbienteEstudo | null, full = false, ar: AreasFrota = AREAS_PADRAO): Bloco[] {
  if (!flags.ativa) return [];
  const r = acasoDe("agenda", a.id, dia);
  if (r() < REGRAS.folga && !full) return [];   // folga
  const hum = a.ritmo.humor;
  // o começo: 9h + o costume dela, variando com o humor do dia (nunca antes das 9h); no modo full, logo depois da meia-noite
  const ini = full ? entre(r, 0, 12) : REGRAS.inicio + Math.max(0, a.ritmo.chegada * (1 + (r() - 0.5) * hum * 1.6) + entre(r, -10, 25));
  // o total de estudo do dia: 5–8 h, puxado pelo foco (mais pras que estudam mais), variando com o humor
  const foco = clamp(a.ritmo.foco + (r() - 0.5) * hum * 0.7, 0, 1);
  const total = full ? 24 * 60 : Math.round(REGRAS.estudoMin + (REGRAS.estudoMax - REGRAS.estudoMin) * foco);
  const out: Bloco[] = [];
  let t = ini, estudado = 0, guarda = 0;
  // no modo full, METADE começa o dia por um intervalo (todo mundo estudando junto à meia-noite lotava as salas)
  if (full && r() < 0.5) { const at = atividadeDoIntervalo(r, a, flags, ar), dur = Math.round(entre(r, REGRAS.intervalo[0], REGRAS.intervalo[1])); if (at) out.push({ ini: t, fim: t + dur, atividade: at, ...(at === "andar" ? { turma: `${a.grupo}|${dia}` } : {}) }); t += dur; }
  while (estudado < total - 5 && t < 24 * 60 && guarda++ < (full ? 200 : 40)) {
    const lugar = lugarDeEstudo(r, flags, preferido, ar);
    if (lugar) {
      const [b0, b1] = REGRAS.bloco, alvo = b0 + (b1 - b0) * (0.25 + 0.6 * foco), dur = Math.min(total - estudado, Math.round(alvo + entre(r, -12, 12)));
      out.push({ ini: t, fim: t + dur, atividade: lugar.atividade, ambiente: lugar.ambiente }); t += dur; estudado += dur;
    } else estudado = total;   // estudo desligado no painel: o dia vira só intervalos
    if (estudado >= total - 5 && lugar) break;
    const at = atividadeDoIntervalo(r, a, flags, ar);
    const [i0, i1] = REGRAS.intervalo, dur = Math.round(Math.min(i1, Math.max(i0, i0 + (i1 - i0) * (0.95 - 0.8 * foco) + entre(r, -8, 8))));
    if (at) out.push({ ini: t, fim: t + dur, atividade: at, ...(at === "andar" ? { turma: `${a.grupo}|${dia}` } : {}) });
    t += dur;
    if (!lugar && !at) break;
  }
  return out.filter((b) => b.fim > b.ini && b.ini < 24 * 60).map((b) => ({ ...b, fim: Math.min(b.fim, 24 * 60 - 1) }));
}

/** a agenda do GRUPO no dia: as de cada um + o lugar de estudo preferido do grupo + a FESTA (todos juntos, à noite) +
 *  as CORRIDAS (intervalos de moto que se cruzam viram corrida juntos, na janela em comum) */
export function agendaDoGrupo(membros: readonly AgenteIA[], dia: number, flags: FlagsFrota, full = false, ar: AreasFrota = AREAS_PADRAO): Map<string, Bloco[]> {
  const out = new Map<string, Bloco[]>();
  if (!membros.length) return out;
  const g = membros[0]!.grupo, rg = acasoDe("grupo", g, dia);
  const preferido = algumPeso(ar) ? ponderado(rg, ar.pesos) : null;
  for (const a of membros) out.set(a.id, agendaBase(a, dia, flags, preferido, full, ar));
  // CORRIDAS: cada intervalo de moto que cruza o de um amigo vira um evento (o maior trecho em comum)
  if (flags.corridas && flags.moto) {
    const motos = membros.flatMap((a) => (out.get(a.id) ?? []).filter((b) => b.atividade === "moto").map((b) => ({ a, b })));
    for (let i = 0; i < motos.length; i++) {
      const x = motos[i]!; if (x.b.evento) continue;
      const juntos = motos.filter((y) => y.a.id !== x.a.id && !y.b.evento && Math.min(x.b.fim, y.b.fim) - Math.max(x.b.ini, y.b.ini) >= REGRAS.corridaMin);
      if (!juntos.length) continue;
      const turma = [x, ...juntos.filter((y, k, l) => l.findIndex((z) => z.a.id === y.a.id) === k)];
      const ini = Math.max(...turma.map((y) => y.b.ini)), fim = Math.min(...turma.map((y) => y.b.fim));
      if (fim - ini < REGRAS.corridaMin) continue;
      const id = `corrida-${g}-${dia}-${Math.round(ini)}`;
      for (const y of turma) y.b.evento = id;   // (a corrida é o trecho [ini, fim] de cada um — o resto é passeio)
      for (const y of turma) { y.b.ini = Math.max(y.b.ini, ini - 4); }
    }
  }
  // FESTA: o grupo vai junto (quem gosta) — começa entre 19h e 21h, depois do dia de todo mundo
  if (flags.festa && rg() < REGRAS.festaChance) {
    const fimDoDia = full ? 0 : Math.max(...membros.map((a) => (out.get(a.id) ?? []).at(-1)?.fim ?? 0));   // (full: o dia não acaba — a festa abre espaço)
    const ini = Math.max(fimDoDia + 15, Math.round(entre(rg, REGRAS.festaIni[0], REGRAS.festaIni[1]))), dur = inteiro(rg, REGRAS.festaDur[0], REGRAS.festaDur[1]);
    const vao = membros.filter((a) => (out.get(a.id) ?? []).length && a.ritmo.festa > 0.25);
    if (vao.length >= 2 && ini + dur < 24 * 60) for (const a of vao) {
      const fim = ini + dur, ag = out.get(a.id)!;
      // abre o espaço da festa na agenda (no modo full ela está cheia): corta o que cruza [ini, fim] — o resto continua
      const resto = ag.flatMap((b): Bloco[] => (b.fim <= ini || b.ini >= fim ? [b] : [...(b.ini < ini - 5 ? [{ ...b, fim: ini }] : []), ...(b.fim > fim + 5 ? [{ ...b, ini: fim, evento: undefined }] : [])]));
      const festa: Bloco = { ini, fim, atividade: "festa", ambiente: "lounge", evento: `festa-${g}-${dia}` };
      out.set(a.id, [...resto, festa].sort((x, y) => x.ini - y.ini));
    }
  }
  return out;
}

/** o bloco em que o agente está num minuto do dia (ou null = offline) */
export function blocoEm(agenda: readonly Bloco[], min: number): Bloco | null {
  for (const b of agenda) if (min >= b.ini && min < b.fim) return b;
  return null;
}

/** o dia `dia` está no MODO FULL? (`ate` = até quando — epoch ms; o dia conta se COMEÇA antes disso) */
export const fullNoDia = (dia: number, ate: number | null | undefined) => !!ate && dia * 86400000 - FUSO_MIN * 60000 < ate;
