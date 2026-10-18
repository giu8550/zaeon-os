/**
 * Cyberespaço — a MARCHA FEMININA (PURO, sem three): uma camada por cima da animação de andar/correr do esqueleto
 * (o mesmo clipe pra todos — o do soldado, de base larga), nos corpos VRM femininos (lib/cyber/estiloAvatar
 * `pose: "feminina"`). Pack de realismo, out/2026, a partir do que a biomecânica da marcha mais concorda (Bruening et al.
 * 2015; Smith et al. 2002) e, na v2 (o dono: "poderia ser mais feminino"), o que os animadores fazem num andar feminino:
 *  - o QUADRIL vai pro lado da perna de APOIO (o deslocamento lateral — o que mais lê como "feminino") e a pelve
 *    inclina: o lado da perna no ar desce; e ela GIRA no plano horizontal com a passada;
 *  - os OMBROS compensam ao contrário (tronco e cabeça estáveis, o olhar reto), o peito um pouco mais alto;
 *  - os BRAÇOS junto do corpo, o cotovelo dobrado, o balanço maior, as mãos soltas;
 *  - os passos CRUZAM pra linha do meio (um pé na frente do outro).
 *
 * `fase` = de −1 a 1, qual perna está à frente (+1 = a ESQUERDA); `apoio` = de −1 a 1, sobre qual perna está o peso
 * (+1 = a ESQUERDA — um quarto de passada depois da fase); `vel` = o quanto anda (0 parado, 1 andando, ~1,6 correndo).
 * Devolve a rotação a SOMAR (rad, Euler XYZ, no osso NORMALIZADO do VRM — ele olha pro +Z, a esquerda é o +X, o +Y
 * pra cima; o mesmo de lib/cyber/posesVrm) e o deslocamento LATERAL do quadril (m, +X = pra esquerda).
 */
import type { Euler3 } from "./posesVrm";

export const MARCHA_FEMININA = {
  /** o quadril vai pro lado do apoio (m) */
  deslocQuadril: 0.05,
  /** pelve: obliquidade (rola em Z: o lado do apoio sobe) e giro (Y) com a passada */
  obliquidade: 0.14, giroPelve: 0.17,
  /** a fração do giro da pelve que o tronco e a cabeça DESFAZEM, e a fração da inclinação que os ombros invertem */
  contraTronco: 0.85, contraCabeca: 0.98, contraOmbro: 0.9,
  /** o peito um pouco mais alto (a coluna arqueia, X−) e a cabeça firme */
  peito: 0.07,
  /** braços: o balanço extra (X), o quanto fecham no corpo (Z), o cotovelo a mais (Y) e a mão solta (Z) */
  bracoBalanco: 0.3, bracoFecha: 0.22, cotovelo: 0.4, maoSolta: 0.25,
  /** coxas: o quanto fecham pra dentro (Z) — os pés cruzam pra linha do meio */
  coxaFecha: 0.11,
} as const;

/** a FASE da passada a partir de quanto cada coxa vai pra frente (a componente pra frente do eixo coxa→joelho; o VRM
 *  olha pro +Z): +1 = a esquerda bem à frente, −1 = a direita */
export function faseDaPassada(frenteCoxaE: number, frenteCoxaD: number): { fase: number; abertura: number } {
  const d = frenteCoxaE - frenteCoxaD, abertura = Math.abs(d);
  return { fase: Math.max(-1, Math.min(1, d / 0.7)), abertura };
}
/** o quanto ANDA, pela abertura das pernas: parado ~0 (as coxas juntas), andando ~0,5–0,8, correndo mais */
export const velDaAbertura = (abertura: number) => Math.max(0, Math.min(1.6, (abertura - 0.06) / 0.5));
/** o APOIO (−1..1) a partir de como a fase está MUDANDO: a perna que vai pra trás é a que pisa (o peso em cima dela).
 *  `dFase` = a variação da fase por segundo; `ritmo` = a variação típica (a média do |dFase| — normaliza). +1 = esquerda */
export function apoioDaFase(dFase: number, ritmo: number): number {
  if (ritmo < 1e-3) return 0;
  return Math.max(-1, Math.min(1, -dFase / ritmo));
}

const somar = (a: Euler3 | undefined, b: Euler3): Euler3 => (a ? [a[0] + b[0], a[1] + b[1], a[2] + b[2]] : b);
export function camadaFeminina(fase: number, vel: number, apoio = 0): { ossos: Record<string, Euler3>; desloc: number } {
  const M = MARCHA_FEMININA, k = Math.max(0, Math.min(1.6, vel)), s = Math.max(-1, Math.min(1, fase)), a = Math.max(-1, Math.min(1, apoio));
  if (k < 0.01) return { ossos: {}, desloc: 0 };
  // andando (k≈1) é o máximo; correndo, o balanço diminui (o corpo vai pra frente, não pros lados)
  const w = Math.min(1, k) * (k > 1 ? Math.max(0.45, 1 - (k - 1) * 0.9) : 1);
  const giro = M.giroPelve * s * w, obl = M.obliquidade * a * w;
  const out: Record<string, Euler3> = {};
  // a pelve: a esquerda à frente (s>0) gira o quadril esquerdo pra frente (Y−); o apoio na esquerda (a>0) sobe o lado dela (Z+)
  out.hips = [0, -giro, obl];
  // o tronco desfaz o giro; os ombros inclinam ao CONTRÁRIO da pelve; o peito sobe (arqueia, X−)
  out.spine = [-M.peito * w * 0.5, giro * M.contraTronco * 0.5, -obl * (0.5 + M.contraOmbro * 0.5)];
  out.chest = [-M.peito * w * 0.5, giro * M.contraTronco * 0.5, -obl * M.contraOmbro * 0.5];
  out.head = [0, giro * (M.contraCabeca - M.contraTronco), obl * 0.15];
  // os braços: o OPOSTO da perna (s>0 = esquerda à frente → braço direito à frente), junto do corpo, cotovelo dobrado,
  // o antebraço acompanhando o balanço e a mão solta
  const bal = M.bracoBalanco * s * w;
  out.leftUpperArm = [bal, 0, M.bracoFecha * w];
  out.rightUpperArm = [-bal, 0, -M.bracoFecha * w];
  out.leftLowerArm = somar(out.leftLowerArm, [bal * 0.4, -M.cotovelo * w, 0]);
  out.rightLowerArm = somar(out.rightLowerArm, [-bal * 0.4, M.cotovelo * w, 0]);
  out.leftHand = [0, 0, M.maoSolta * w];
  out.rightHand = [0, 0, -M.maoSolta * w];
  // as coxas fecham (os pés cruzam pra linha do meio)
  out.leftUpperLeg = [0, 0, -M.coxaFecha * w];
  out.rightUpperLeg = [0, 0, M.coxaFecha * w];
  return { ossos: out, desloc: M.deslocQuadril * a * w };
}
