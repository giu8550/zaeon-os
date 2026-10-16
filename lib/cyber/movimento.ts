/**
 * Cyberespaço — o MOVIMENTO TURBINADO do personagem (PURO, sem three): a noção de VELOCIDADE, o DESVIO e o IMPACTO.
 *  - SPRINT: segurando correr (Shift / CORRER) ele corre (7,5 m/s); continuou segurando em movimento, em ~0,7 s entra no
 *    SPRINT — 2× a corrida (15 m/s), com a rampa curta (sem tranco);
 *  - DASH (C / DASH): um arranque curto (~5 m em 0,18 s) pra onde se está indo (parado: pra frente), no chão e no ar;
 *    recarga curta; durante o começo dele o corpo fica INTOCÁVEL (`intocavel` — o desvio de golpes do combate);
 *  - VOO TURBO: no ar de mochila, segurando correr, os jatos dão 2× (32 m/s pra frente);
 *  - a SENSAÇÃO DE VELOCIDADE na tela (a mesma da moto — components/cyber/VelocidadeTela): sai da velocidade de verdade
 *    no plano, então sprint, dash e voo turbo acendem as linhas/o FOV na medida.
 */

export const SPRINT = {
  /** m/s: andar, correr e o sprint (2× a corrida) */
  andar: 4, correr: 7.5, sprint: 15,
  /** s segurando correr (em movimento) até o sprint começar, e quanto dura a rampa até a velocidade cheia */
  espera: 0.7, rampa: 0.35,
} as const;

/** a velocidade a pé (m/s): `correndo` = segurando correr; `tCorrendo` = há quanto tempo (s) segura correr andando */
export function velocidadeAPe(correndo: boolean, tCorrendo: number): number {
  if (!correndo) return SPRINT.andar;
  const k = Math.max(0, Math.min(1, (tCorrendo - SPRINT.espera) / SPRINT.rampa));
  return SPRINT.correr + (SPRINT.sprint - SPRINT.correr) * k * k * (3 - 2 * k);
}
/** está no sprint (a velocidade já passou do meio do caminho entre correr e o sprint) */
export const emSprint = (correndo: boolean, tCorrendo: number) => velocidadeAPe(correndo, tCorrendo) > (SPRINT.correr + SPRINT.sprint) / 2;

export const DASH = {
  /** m/s durante o arranque, quanto dura (s) e a recarga (s, contada do começo) */
  vel: 34, dur: 0.18, recarga: 0.55,
  /** s INTOCÁVEL a partir do começo (o desvio) */
  intocavel: 0.25,
} as const;
export type EstadoDash = { ini: number; dir: { x: number; z: number } } | null;

/** pode dar o dash agora? (a recarga conta do começo do último) */
export const podeDash = (d: EstadoDash, agora: number) => !d || agora - d.ini >= DASH.recarga;
/** começa um dash na direção `dir` (mundo; zero = sem direção → `frente`, o rumo do corpo) */
export function iniciarDash(agora: number, dir: { x: number; z: number } | null, frente: number): NonNullable<EstadoDash> {
  const n = dir ? Math.hypot(dir.x, dir.z) : 0;
  return { ini: agora, dir: n > 1e-3 ? { x: dir!.x / n, z: dir!.z / n } : { x: Math.sin(frente), z: Math.cos(frente) } };
}
/** quanto o dash já andou `tau` s depois de começar (m): a velocidade cai no fim (v = V·(1 − 0,6·(τ/D)²) — sai deslizando) */
const andouDash = (tau: number) => { const t = Math.max(0, Math.min(DASH.dur, tau)); return DASH.vel * (t - (0.2 * t * t * t) / (DASH.dur * DASH.dur)); };
/** a distância total de um dash (m) */
export const DISTANCIA_DASH = andouDash(DASH.dur);
/** o deslocamento do dash entre o quadro anterior (`tAnt`) e agora (m, mundo) — null quando acabou. Pelo TEMPO, não
 *  pelo dt: a mesma distância a 20 ou a 144 fps (com o dt cortado, a 5 fps o arranque cabia num quadro só) */
export function passoDash(d: EstadoDash, tAnt: number, agora: number): { x: number; z: number } | null {
  if (!d) return null;
  if (agora - d.ini >= DASH.dur && tAnt - d.ini >= DASH.dur) return null;
  const v = andouDash(agora - d.ini) - andouDash(tAnt - d.ini);
  return { x: d.dir.x * v, z: d.dir.z * v };
}
/** está intocável agora (o começo do dash) */
export const intocavel = (d: EstadoDash, agora: number) => !!d && agora - d.ini < DASH.intocavel;

/** o multiplicador dos jatos no VOO TURBO (segurando correr no ar) */
export const VOO_TURBO = 2;

/** a SENSAÇÃO DE VELOCIDADE (0..1) de quem está a pé ou voando de mochila, pela velocidade no plano (m/s). No chão:
 *  andar e correr não acendem nada, o sprint (15) acende mais da metade, o dash (30) cheio. No ar: o voo normal (16) não
 *  acende (é o de sempre), o turbo (32) acende cheio */
export const sensacaoAPe = (v: number, noAr = false) => Math.max(0, Math.min(1, noAr ? (v - 16) / 16 : (v - 8) / 11));
/** a força do TREMOR de um impacto (0..1): pouso forte (`f` = impactoDoPouso) ou o dash batendo em alguma coisa */
export const tremorDoImpacto = (f: number) => Math.max(0, Math.min(1, f)) * 0.35;
