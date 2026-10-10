/**
 * Cyberespaço — as POSES DE AÇÃO do movimento turbinado (PURO; lib/cyber/movimento), no estilo HACK AND SLASH. Mesmo
 * formato das poses capturadas (lib/cyber/poses): a DIREÇÃO de cada segmento no referencial do corpo (frente, cima,
 * esquerda) — o avatar aponta os próprios ossos (components/cyber/AvatarLuz `apontar`), e o corpo VRM copia.
 *  - SPRINT ("corrida ninja"): o corpo todo inclina, o tronco mais ainda, os braços esticados PRA TRÁS — as pernas são
 *    da animação de corrida (mais rápida);
 *  - DASH: a INVESTIDA baixa — perna da frente dobrada, a de trás esticada, tronco projetado, braços abertos pra trás;
 *  - ALERTA (logo depois do dash): a GUARDA — joelhos dobrados, base larga (um pé à frente), cotovelos abertos e as mãos
 *    na frente do peito, respirando.
 * `lado` de cada membro: +1 = esquerdo (o eixo "esquerda" aponta pra fora dele), −1 = direito.
 */
import type { Dir3 } from "./poses";

export type PoseAcao = {
  /** inclinação do CORPO inteiro (rad, negativa = pra frente, girando no quadril) e quanto o quadril desce (m) */
  inclina: number; desce: number;
  tronco: Dir3; cabeca: Dir3;
  braco(lado: number): Dir3; ante(lado: number): Dir3;
  /** as pernas (null = deixa a animação — o sprint corre com as pernas da corrida) */
  coxa: ((lado: number) => Dir3) | null; canela: ((lado: number) => Dir3) | null; pe: ((lado: number) => Dir3) | null;
};
const n = (v: Dir3): Dir3 => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };

/** a corrida ninja: `t` (s) só balança os braços de leve (o vento) */
export function poseSprint(t: number): PoseAcao {
  const vento = 0.06 * Math.sin(t * 14);
  return {
    inclina: -0.24, desce: 0.06,
    tronco: n([0.36, 0.93, 0]), cabeca: n([0.3, 0.95, 0]),
    braco: (l) => n([-0.66, -0.68, 0.3 * l + vento * l]),
    ante: (l) => n([-0.92, -0.3, 0.22 * l]),
    coxa: null, canela: null, pe: null,
  };
}

/** a investida do dash (a perna ESQUERDA vai na frente) */
export function poseDash(): PoseAcao {
  return {
    inclina: -0.32, desce: 0.2,
    tronco: n([0.42, 0.9, 0]), cabeca: n([0.15, 0.99, 0]),
    braco: (l) => n([-0.55, -0.55, 0.62 * l]),
    ante: (l) => n([-0.85, -0.15, 0.5 * l]),
    coxa: (l) => (l > 0 ? n([0.72, -0.66, 0.1]) : n([-0.55, -0.83, -0.1])),
    canela: (l) => (l > 0 ? n([-0.18, -0.98, 0]) : n([-0.85, -0.52, 0])),
    pe: (l) => (l > 0 ? n([0.8, -0.6, 0]) : n([-0.25, -0.97, 0])),
  };
}

/** a GUARDA de alerta depois do dash — a "postura de poder" dos heróis de jogo de ação (referência do dono: o Delsin de
 *  inFAMOUS Second Son), pra passar sensação de PERIGO: tronco curvado pra frente (sem ficar ereto) com a cabeça baixa
 *  olhando por cima, BRAÇOS BEM ABERTOS pros lados e pra baixo, base larga e joelhos dobrados. A RESPIRAÇÃO OFEGANTE
 *  move o corpo todo: no inspirar o peito e os ombros sobem e os braços se ABREM e sobem; no expirar caem. E o peso
 *  balança devagar de um lado pro outro (o predador medindo o adversário). `tDesde` = s desde o esforço (o fôlego acalma) */
export function poseAlerta(t: number, tDesde = 1): PoseAcao {
  const folego = 0.5 + 0.5 * Math.exp(-tDesde * 0.9), r = Math.sin(t * 11) * folego;   // ~1,75 respirações/s
  const balanco = Math.sin(t * 1.6) * 0.07;
  return {
    inclina: -0.15 - 0.03 * r, desce: 0.24 + 0.03 * r,
    tronco: n([0.4 - 0.07 * r, 0.91, balanco]), cabeca: n([-0.16, 0.99, -balanco * 0.5]),
    braco: (l) => n([0.12, -0.5 + 0.17 * r, (0.84 + 0.06 * r) * l]),
    ante: (l) => n([0.3 - 0.05 * r, -0.36 + 0.16 * r, (0.88 + 0.04 * r) * l]),
    coxa: (l) => (l > 0 ? n([0.3, -0.74, 0.6]) : n([-0.16, -0.77, -0.62])),
    canela: (l) => n([-0.3, -0.94, 0.14 * l]),
    pe: (l) => (l > 0 ? n([0.88, -0.4, 0.25]) : n([0.6, -0.5, -0.62])),
  };
}

/** o HERO LANDING (o pouso de super-herói, só de queda ALTA): joelho direito no chão, o pé esquerdo plantado à frente,
 *  o punho direito no chão, o braço esquerdo aberto pra trás, tronco debruçado e a cabeça baixa */
export function poseHeroi(): PoseAcao {
  return {
    inclina: -0.3, desce: 0.47,
    tronco: n([0.72, 0.69, 0]), cabeca: n([0.45, 0.89, 0]),
    braco: (l) => (l > 0 ? n([-0.5, -0.42, 0.76]) : n([0.42, -0.9, -0.12])),
    ante: (l) => (l > 0 ? n([-0.72, -0.25, 0.65]) : n([0.12, -0.99, 0])),
    coxa: (l) => (l > 0 ? n([0.95, -0.2, 0.22]) : n([0.1, -0.99, -0.12])),
    canela: (l) => (l > 0 ? n([0.02, -1, 0]) : n([-0.98, -0.18, 0])),
    pe: (l) => (l > 0 ? n([0.9, -0.42, 0.05]) : n([-0.6, 0.3, 0])),
  };
}
/** quanto o HERO LANDING pesa `t` s depois do impacto: crava na hora, segura e levanta */
export const HEROI = { segura: 0.6, levanta: 0.5, trava: 0.45, alturaMin: 9 } as const;
export function pesoHeroi(t: number): number {
  if (t < 0) return 0;
  const entra = Math.min(1, t / 0.05), sai = t < HEROI.segura ? 1 : Math.max(0, 1 - (t - HEROI.segura) / HEROI.levanta);
  return entra * sai * sai * (3 - 2 * sai);
}

/** a DECOLAGEM com impulso: agacha `espera` s (parado mais, correndo quase nada — o embalo continua) e lança. Os braços
 *  vão pra trás no agachamento e sobem na hora do impulso. `tD` = s desde o comando */
export const DECOLAGEM = { esperaParado: 0.16, esperaAndando: 0.07, impulso: 12 } as const;
export function bracosDaDecolagem(tD: number, espera: number): { braco(l: number): Dir3; ante(l: number): Dir3; w: number } {
  const u = tD - espera, lanca = Math.max(0, Math.min(1, u / 0.12));
  const w = tD < espera ? Math.min(1, tD / Math.max(0.03, espera * 0.6)) : Math.max(0, 1 - Math.max(0, u - 0.25) / 0.3);
  const mistura = (a: Dir3, b: Dir3): Dir3 => n([a[0] + (b[0] - a[0]) * lanca, a[1] + (b[1] - a[1]) * lanca, a[2] + (b[2] - a[2]) * lanca]);
  return { w, braco: (l) => mistura([-0.5, -0.83, 0.22 * l], [0.45, 0.55, 0.32 * l]), ante: (l) => mistura([-0.55, -0.82, 0.1 * l], [0.25, 0.95, 0.1 * l]) };
}

/** os PESOS das poses de ação no instante: o sprint segue a velocidade; o dash acende rápido e solta em 0,15 s depois
 *  do arranque; o alerta entra quando o dash acaba, fica `ALERTA.dura` s e sai em `ALERTA.sai` s */
export const ALERTA = { dura: 1.5, sai: 0.45 } as const;
export function pesoAlerta(tDesdeFimDash: number): number {
  if (tDesdeFimDash < 0) return 0;
  const entra = Math.min(1, tDesdeFimDash / 0.12), sai = tDesdeFimDash < ALERTA.dura ? 1 : Math.max(0, 1 - (tDesdeFimDash - ALERTA.dura) / ALERTA.sai);
  return entra * sai;
}
