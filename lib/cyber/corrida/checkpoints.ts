/**
 * Corridas de moto — a CORRIDA DE CHECKPOINTS (PURO), pedida pelo dono (out/2026): SEM estatística (nada de tempo de
 * volta, recorde ou ranking) — é só o circuito: pegar o PRÓXIMO checkpoint (os anéis da pista, na ordem, dando a volta
 * quantas vezes der). Quem pegar MAIS checkpoints até o fim do tempo GANHA. Não vale passar por FORA: o anel só conta
 * cruzado por DENTRO e no sentido da pista (`cruzou`, de lib/cyber/corrida/corrida); pulou um, ele continua o próximo.
 *  - SOLO: eu contra 3 bots; EM DUPLA: eu e mais uma pessoa (quem estiver no box de largada) contra 2 bots;
 *  - o BOX DE LARGADA fica do lado da largada do Anel da Praça (lá embaixo, onde passam as motos);
 *  - os BOTS andam pela pista pelo RELÓGIO e pela SEMENTE da corrida: os dois da dupla veem os mesmos bots, no mesmo lugar;
 *  - quem chama a dupla manda `cr` (a semente e a hora da largada) na pose; quem entra usa a mesma; o placar de cada
 *    pessoa vai na pose (`ck`).
 */
import { cruzou } from "./corrida";
import { pistaPorId, type P3, type Pista } from "./pistas";

/** a pista das corridas de checkpoint: a do anel em volta da praça (curta, técnica) */
export const PISTA_CK = "anel-da-praca";
/** a contagem antes da largada (s) e quanto dura a corrida (s) */
export const CONTAGEM_CK = 3, DURACAO_CK = 120;
/** quanto tempo depois do convite a dupla larga (ms) — dá tempo da outra pessoa aceitar */
export const ESPERA_DUPLA_MS = 9000;

export type ModoCk = "solo" | "dupla";
export type BotCk = { id: string; nome: string; cor: string; /** m/s de cruzeiro */ vel: number; /** o vai-e-vem do ritmo */ amp: number; fase: number; /** atrás do grid (m) */ atras: number };
export type CorridaCk = {
  modo: ModoCk; semente: number;
  /** a hora da LARGADA (ms, relógio de quem chamou — a contagem acaba aqui) */
  inicio: number;
  bots: BotCk[];
  /** o PRÓXIMO checkpoint (índice do portão da pista) e quantos eu já peguei */
  proximo: number; meus: number;
  /** a minha vaga no grid (0 = quem chamou, 1 = quem entrou na dupla) */
  vaga: number;
};

const NOMES_BOTS = ["Ômega", "Faísca", "Nebulosa", "Vórtice", "Cometa", "Quasar", "Pulsar", "Órbita"] as const;
const CORES_BOTS = ["#ff6ad5", "#9affd0", "#ffc46b", "#a98bff", "#5afff2", "#ff9a3c", "#7dd3ff", "#f2ff5a"] as const;

/** pseudo-aleatório pela semente (mulberry32) */
function acaso(semente: number): () => number {
  let a = semente >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** os bots da corrida (determinísticos pela semente): ritmos diferentes, dá pra ganhar de todos pilotando bem */
export function botsDaCorrida(semente: number, modo: ModoCk): BotCk[] {
  const r = acaso(semente), n = modo === "solo" ? 3 : 2, ini = Math.floor(r() * NOMES_BOTS.length);
  return Array.from({ length: n }, (_, k) => {
    const j = (ini + k * 3) % NOMES_BOTS.length;
    return { id: `bot-ck-${k}`, nome: `Bot ${NOMES_BOTS[j]}`, cor: CORES_BOTS[j]!, vel: 62 + r() * 30 + k * 4, amp: 6 + r() * 6, fase: r() * Math.PI * 2, atras: 12 + k * 10 };
  });
}

/** uma corrida nova (`inicio` = a hora da largada, ms) */
export function novaCorridaCk(modo: ModoCk, semente: number, inicio: number, vaga = 0): CorridaCk {
  return { modo, semente, inicio, bots: botsDaCorrida(semente, modo), proximo: 1, meus: 0, vaga };
}

/** a fase pelo relógio: contagem (antes da largada), correndo, ou fim */
export function faseCk(c: CorridaCk, agora: number): { fase: "contagem" | "correndo" | "fim"; contagem: number; resta: number } {
  const t = (agora - c.inicio) / 1000;
  if (t < 0) return { fase: "contagem", contagem: Math.ceil(-t), resta: DURACAO_CK };
  if (t >= DURACAO_CK) return { fase: "fim", contagem: 0, resta: 0 };
  return { fase: "correndo", contagem: 0, resta: DURACAO_CK - t };
}

/** quanto o bot andou (m) `t` s depois da largada — o ritmo vai e vem, mas nunca anda pra trás */
export const andouBot = (b: BotCk, t: number) => (t <= 0 ? 0 : b.vel * t + (b.amp / 0.35) * (Math.sin(t * 0.35 + b.fase) - Math.sin(b.fase)));

/** o grid (onde se larga): o da pista, e cada vaga um pouco atrás/de lado (a dupla não larga uma em cima da outra) */
export function gridCk(pista: Pista, vaga: number): P3 & { rumo: number } {
  const g = pista.grid, lado = vaga % 2 === 0 ? -7 : 7, atras = Math.floor(vaga / 2) * 10;
  return { x: g.x + Math.cos(g.rumo) * lado - Math.sin(g.rumo) * atras, y: g.y, z: g.z - Math.sin(g.rumo) * lado - Math.cos(g.rumo) * atras, rumo: g.rumo };
}

/** onde o bot está agora (a pista em metros, a partir de um pouco atrás do grid) e quantos checkpoints já pegou */
export function botEm(b: BotCk, pista: Pista, c: CorridaCk, agora: number): P3 & { rumo: number; ck: number } {
  const t = (agora - c.inicio) / 1000, sGrid = 30 - b.atras, s = sGrid + andouBot(b, Math.min(t, DURACAO_CK));
  const p = pista.ponto(s), passo = pista.comprimento / pista.portoes.length;
  // os portões ficam em i·passo; o 1º a pegar é o 1 (o 0 é a largada, atrás do grid): conta os que ele já passou
  const ck = Math.max(0, Math.floor(s / passo) - Math.floor(sGrid / passo));
  return { ...p, ck };
}

/** um quadro meu: a moto foi de `de` até `para` — cruzou o próximo checkpoint POR DENTRO? (fora da corrida, nada) */
export function passoCk(c: CorridaCk, pista: Pista, de: P3, para: P3, agora: number): { c: CorridaCk; pegou: boolean } {
  if (faseCk(c, agora).fase !== "correndo") return { c, pegou: false };
  const g = pista.portoes[c.proximo]!;
  if (!cruzou(g, de, para)) return { c, pegou: false };
  return { c: { ...c, proximo: (c.proximo + 1) % pista.portoes.length, meus: c.meus + 1 }, pegou: true };
}

export type Concorrente = { id: string; nome: string; cor: string; ck: number; eu?: boolean };
/** o resultado: mais checkpoints ganha (empate: quem é gente na frente do bot; entre gentes, os dois) */
export function vencedores(lista: readonly Concorrente[]): Concorrente[] {
  const max = Math.max(...lista.map((x) => x.ck));
  const topo = lista.filter((x) => x.ck === max), gente = topo.filter((x) => !x.id.startsWith("bot-ck-"));
  return gente.length ? gente : topo;
}

/** o `cr` da pose: "semente:inicio" (quem chama a dupla) — e o inverso */
export const crDe = (c: { semente: number; inicio: number }) => `${c.semente}:${c.inicio}`;
export function lerCr(cr: unknown): { semente: number; inicio: number } | null {
  if (typeof cr !== "string") return null;
  const m = /^(\d{1,10}):(\d{12,14})$/.exec(cr); if (!m) return null;
  return { semente: Number(m[1]), inicio: Number(m[2]) };
}

/** o BOX DE LARGADA (mundo): um anel grande do lado da largada da pista, um pouco acima — entra-se nele de moto */
export const BOX_CK = (() => {
  const p = pistaPorId(PISTA_CK)!, g = p.grid, lado = 60;
  return { x: g.x + Math.cos(g.rumo) * lado, y: g.y + 6, z: g.z - Math.sin(g.rumo) * lado, r: 22, rumo: g.rumo };
})();
/** está dentro do box? (de moto: perto do centro, numa faixa de altura generosa) */
export const noBoxCk = (p: P3) => Math.hypot(p.x - BOX_CK.x, p.z - BOX_CK.z) <= BOX_CK.r && Math.abs(p.y - BOX_CK.y) < 30;
