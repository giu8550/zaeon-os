/**
 * Cyberespaço — o SHOW do lounge durante a música (PURO, sem three). O "olho" em cima do DJ é modular: no RITUAL ele é
 * o olho; com MÚSICA tocando, dele nasce uma MANDALA de geometria sagrada (começa pela flor da vida, nunca em forma de
 * olho) que vai mudando de forma, pulsando no grave, crescendo em complexidade e em área; de dentro saem SERPENTES que
 * rodeiam a parte de cima do lounge; depois uma NÉVOA se forma no ambiente (como na capela do templo) com TROVÕES leves,
 * que se intensificam a cada TURNO de 1 min da música (níveis 1, 2 e 3 — até 3 trovões por turno, em velocidades
 * distintas, os 3 juntos só no nível 3); depois das serpentes vêm TENTÁCULOS maiores (polvo), balançando no compasso.
 * Tudo é função do PONTO DA MÚSICA (lib/lounge3d/musica `posicaoAgora`, no relógio do servidor): todo mundo vê o
 * mesmo show no mesmo instante, a cada faixa (recomeça na próxima), e a playlist dá a volta sozinha.
 */

/** as FORMAS da mandala, na ordem em que aparecem (uma a cada `DURACAO_FORMA` s; depois da última, dá a volta) */
export const FORMAS = ["florDaVida", "sementeDaVida", "cuboDeMetatron", "sriYantra", "hexagrama", "arvoreDaVida", "toro", "espiralDeFibonacci", "vesicaPiscis", "merkaba"] as const;
export type Forma = (typeof FORMAS)[number];
export const DURACAO_FORMA = 18, TRANSICAO = 3;
/** a mandala nasce do centro (s desde o começo da faixa) */
export const NASCIMENTO = { ini: 0, dur: 6 } as const;
/** as serpentes saem da mandala; os tentáculos vêm depois delas; a névoa se forma antes do 1º trovão */
export const SERPENTES = { ini: 28, dur: 14, n: 6 } as const;
export const TENTACULOS = { ini: 75, dur: 20, n: 5 } as const;
/** as FITAS DE DNA em volta da mandala (a progressão, nível 2) */
export const DNA = { ini: 110, dur: 20 } as const;
export const NEVOA = { ini: 44, dur: 16 } as const;
/** o TURNO: 1 min de música; o nível dos trovões sobe por turno (1 → 2 → 3) — até `MAX_TROVOES` por turno */
export const TURNO_S = 60, MAX_TROVOES = 3;

export type EstadoShow = {
  /** 0..1: a mandala nascendo do centro (0 = só o ponto) */
  nascimento: number;
  /** a forma atual e a próxima, com a mistura (0 = só a atual, 1 = só a próxima) */
  forma: number; proxima: number; mistura: number;
  /** complexidade (0..1) e o fator de ÁREA (1 = o tamanho de nascença; cresce ao longo da faixa) */
  complexidade: number; area: number;
  /** as serpentes (0..1 saindo da mandala), os tentáculos (0..1) e as fitas de DNA (0..1) */
  serpentes: number; tentaculos: number; dna: number;
  /** a névoa (0..1) e o nível dos trovões (0 = ainda nenhum, 1..3) */
  nevoa: number; nivel: 0 | 1 | 2 | 3;
  /** o turno atual (0 = o 1º minuto) */
  turno: number;
};
const s3 = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
const rampa = (t: number, ini: number, dur: number) => s3((t - ini) / dur);

/** o nível dos trovões no instante `t` (s da faixa): 0 antes da névoa; a partir do 1º minuto, 1; depois 2 e 3 */
export function nivelDoTurno(t: number): 0 | 1 | 2 | 3 {
  if (t < TURNO_S) return 0;
  return Math.min(3, Math.floor(t / TURNO_S)) as 1 | 2 | 3;
}
/** o estado do show no ponto `t` (s desde o começo da faixa; `tocando` false = tudo recolhido) */
export function estadoDoShow(t: number, tocando: boolean): EstadoShow {
  if (!tocando || t < 0) return { nascimento: 0, forma: 0, proxima: 1, mistura: 0, complexidade: 0, area: 1, serpentes: 0, tentaculos: 0, dna: 0, nevoa: 0, nivel: 0, turno: 0 };
  const k = Math.floor(t / DURACAO_FORMA), dentro = t - k * DURACAO_FORMA, n = FORMAS.length;
  const forma = k % n, proxima = (k + 1) % n, mistura = s3((dentro - (DURACAO_FORMA - TRANSICAO)) / TRANSICAO);
  return {
    nascimento: rampa(t, NASCIMENTO.ini, NASCIMENTO.dur),
    forma, proxima, mistura,
    complexidade: Math.min(0.72, t / 240),                                // a progressão desta seção para no NÍVEL 2 (o 3 fica pra depois)
    area: 1 + 1.5 * s3(t / 220),                                          // cresce até 2,5× (≈150 m) em ~4 min
    serpentes: rampa(t, SERPENTES.ini, SERPENTES.dur), tentaculos: rampa(t, TENTACULOS.ini, TENTACULOS.dur), dna: rampa(t, DNA.ini, DNA.dur),
    nevoa: rampa(t, NEVOA.ini, NEVOA.dur), nivel: nivelDoTurno(t), turno: Math.floor(t / TURNO_S),
  };
}

/** um TROVÃO do show: em que segundo do turno cai, a VELOCIDADE do relâmpago (1 = normal; cada um do turno tem a sua),
 *  e a força (0..1) */
export type Trovao = { em: number; vel: number; forca: number };
const hash = (a: number, b: number) => { let x = (a * 73856093) ^ (b * 19349663); x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
/** os trovões do turno `turno` (determinístico): no nível 1, um; no 2, dois, espalhados; no 3, os três — e só aí os
 *  três chegam a cair JUNTOS (no meio do turno), em velocidades distintas */
export function trovoesDoTurno(turno: number): Trovao[] {
  const nivel = nivelDoTurno(turno * TURNO_S); if (nivel === 0) return [];
  const vels = [0.7, 1, 1.6].map((v, i) => v * (0.85 + 0.3 * hash(turno, 7 + i)));
  if (nivel === 1) return [{ em: 12 + hash(turno, 1) * 36, vel: vels[1]!, forca: 0.45 }];
  if (nivel === 2) return [{ em: 6 + hash(turno, 1) * 20, vel: vels[0]!, forca: 0.6 }, { em: 32 + hash(turno, 2) * 22, vel: vels[2]!, forca: 0.7 }];
  const juntos = 26 + hash(turno, 3) * 8;   // os 3 juntos, no meio do turno (com diferença de frações de segundo)
  return [{ em: juntos, vel: vels[0]!, forca: 1 }, { em: juntos + 0.35 + hash(turno, 4) * 0.5, vel: vels[1]!, forca: 0.85 }, { em: juntos + 0.9 + hash(turno, 5) * 0.6, vel: vels[2]!, forca: 0.95 }];
}
/** os trovões que CAEM entre `t0` e `t1` (s da faixa; t0 < t1 — um quadro), já com o instante absoluto na faixa */
export function trovoesEntre(t0: number, t1: number): (Trovao & { t: number })[] {
  if (t1 <= t0 || t1 - t0 > TURNO_S) return [];
  const out: (Trovao & { t: number })[] = [];
  for (let turno = Math.floor(t0 / TURNO_S); turno <= Math.floor(t1 / TURNO_S); turno++) for (const tr of trovoesDoTurno(turno)) { const t = turno * TURNO_S + tr.em; if (t > t0 && t <= t1) out.push({ ...tr, t }); }
  return out;
}

/** o nome da forma `i` (pro painel/depuração) */
export const nomeDaForma = (i: number) => FORMAS[((i % FORMAS.length) + FORMAS.length) % FORMAS.length]!;
