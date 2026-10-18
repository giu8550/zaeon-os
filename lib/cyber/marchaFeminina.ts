/**
 * Cyberespaço — a MARCHA FEMININA (PURO, sem three): uma camada por cima da animação de andar/correr do esqueleto
 * (o mesmo clipe pra todos), nos corpos VRM femininos (lib/cyber/estiloAvatar `pose: "feminina"`). Pack de realismo,
 * out/2026, a partir do que a biomecânica da marcha mais concorda (Bruening et al. 2015; Smith et al. 2002):
 *  - a PELVE inclina mais pros lados (obliquidade: o lado da perna no ar desce) e GIRA mais no plano horizontal;
 *  - o TRONCO e a CABEÇA ficam mais ESTÁVEIS (compensam o giro da pelve — o olhar segue reto);
 *  - os BRAÇOS balançam mais, mais perto do corpo, com o cotovelo um pouco mais dobrado;
 *  - os passos um pouco mais pra DENTRO (as coxas fecham de leve — os pés perto da linha do meio).
 *
 * `fase` = de −1 a 1, quem está à frente (+1 = a perna ESQUERDA à frente) e `vel` = o quanto anda (0 parado, 1 andando,
 * ~1,6 correndo). Devolve a rotação a SOMAR (rad, Euler XYZ do três, no osso NORMALIZADO do VRM — o VRM olha pro +Z, a
 * esquerda é o +X, o +Y pra cima; o mesmo de lib/cyber/posesVrm).
 */
import type { Euler3 } from "./posesVrm";

export const MARCHA_FEMININA = {
  /** pelve: obliquidade (rola em Z) e giro (Y) por fase */
  obliquidade: 0.075, giroPelve: 0.13,
  /** tronco e cabeça: a fração do giro da pelve que eles DESFAZEM (estáveis) */
  contraTronco: 0.75, contraCabeca: 0.95,
  /** braços: o balanço extra (X, pra frente/trás), o quanto fecham no corpo (Z) e o cotovelo a mais (Y) */
  bracoBalanco: 0.28, bracoFecha: 0.12, cotovelo: 0.22,
  /** coxas: o quanto fecham pra dentro (Z) — os passos perto da linha do meio */
  coxaFecha: 0.05,
} as const;

/** a FASE da passada a partir de quanto cada coxa vai pra frente (a componente pra frente do eixo coxa→joelho; o VRM
 *  olha pro +Z): +1 = a esquerda bem à frente, −1 = a direita */
export function faseDaPassada(frenteCoxaE: number, frenteCoxaD: number): { fase: number; abertura: number } {
  const d = frenteCoxaE - frenteCoxaD, abertura = Math.abs(d);
  return { fase: Math.max(-1, Math.min(1, d / 0.7)), abertura };
}
/** o quanto ANDA, pela abertura das pernas: parado ~0 (as coxas juntas), andando ~0,5–0,8, correndo mais */
export const velDaAbertura = (abertura: number) => Math.max(0, Math.min(1.6, (abertura - 0.06) / 0.5));

const somar = (a: Euler3 | undefined, b: Euler3): Euler3 => (a ? [a[0] + b[0], a[1] + b[1], a[2] + b[2]] : b);
export function camadaFeminina(fase: number, vel: number): Record<string, Euler3> {
  const M = MARCHA_FEMININA, k = Math.max(0, Math.min(1.6, vel)), s = Math.max(-1, Math.min(1, fase));
  if (k < 0.01) return {};
  const giro = M.giroPelve * s * k, obl = M.obliquidade * s * k;
  const out: Record<string, Euler3> = {};
  // a pelve: quando a esquerda vai à frente (s>0), o quadril esquerdo gira pra frente (Y−) e o lado dela (no ar) desce (Z+)
  out.hips = [0, -giro, obl];
  // o tronco desfaz o giro e a inclinação (espalhado entre a coluna e o peito); a cabeça segura o olhar reto
  out.spine = [0, giro * M.contraTronco * 0.5, -obl * 0.6];
  out.chest = [0, giro * M.contraTronco * 0.5, -obl * 0.3];
  out.head = [0, giro * (M.contraCabeca - M.contraTronco), 0];
  // os braços: o OPOSTO da perna (s>0 = esquerda à frente → braço direito à frente), fechando no corpo, cotovelo dobrado
  const bal = M.bracoBalanco * s * Math.min(1, k);
  out.leftUpperArm = [bal, 0, M.bracoFecha * Math.min(1, k)];
  out.rightUpperArm = [-bal, 0, -M.bracoFecha * Math.min(1, k)];
  out.leftLowerArm = somar(out.leftLowerArm, [0, -M.cotovelo * Math.min(1, k), 0]);
  out.rightLowerArm = somar(out.rightLowerArm, [0, M.cotovelo * Math.min(1, k), 0]);
  // as coxas fecham de leve (os pés pra linha do meio)
  out.leftUpperLeg = [0, 0, -M.coxaFecha * Math.min(1, k)];
  out.rightUpperLeg = [0, 0, M.coxaFecha * Math.min(1, k)];
  return out;
}
