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

/** a guarda de alerta (o pé esquerdo à frente, a mão esquerda mais à frente); `t` = a respiração */
export function poseAlerta(t: number): PoseAcao {
  const resp = 0.012 * Math.sin(t * 2.6);
  return {
    inclina: -0.07, desce: 0.13 + resp,
    tronco: n([0.2, 0.98, -0.04]), cabeca: n([0.05, 0.998, 0]),
    braco: (l) => n([0.22, -0.72, 0.62 * l]),
    ante: (l) => (l > 0 ? n([0.86, 0.42, -0.28]) : n([0.66, 0.6, 0.42 * l])),
    coxa: (l) => (l > 0 ? n([0.55, -0.8, 0.22]) : n([-0.38, -0.88, -0.28])),
    canela: (l) => (l > 0 ? n([-0.36, -0.93, 0.05]) : n([-0.42, -0.9, -0.05])),
    pe: (l) => (l > 0 ? n([0.9, -0.42, 0.1]) : n([0.55, -0.6, -0.55])),
  };
}

/** os PESOS das poses de ação no instante: o sprint segue a velocidade; o dash acende rápido e solta em 0,15 s depois
 *  do arranque; o alerta entra quando o dash acaba, fica `ALERTA.dura` s e sai em `ALERTA.sai` s */
export const ALERTA = { dura: 1.5, sai: 0.45 } as const;
export function pesoAlerta(tDesdeFimDash: number): number {
  if (tDesdeFimDash < 0) return 0;
  const entra = Math.min(1, tDesdeFimDash / 0.12), sai = tDesdeFimDash < ALERTA.dura ? 1 : Math.max(0, 1 - (tDesdeFimDash - ALERTA.dura) / ALERTA.sai);
  return entra * sai;
}
