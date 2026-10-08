/**
 * Cyberespaço — POSES próprias dos personagens com corpo VRM (PURO, sem three). O corpo VRM copia o esqueleto mixamo
 * do corpo padrão (components/cyber/AvatarVrm `espelharNoVrm`) — e o "parado" dele é o idle do soldado (base aberta,
 * joelhos dobrados), que numa personagem feminina fica estranho. Uma pose aqui SOBREPÕE essa cópia, osso a osso.
 *
 * Os ângulos (rad, Euler XYZ do three) são a rotação LOCAL de cada osso NORMALIZADO do VRM a partir da pose T (no VRM
 * 1.0, em repouso os eixos são os do mundo: a personagem olha pro +Z, a esquerda dela é o +X, o +Y é pra cima).
 */
export type Euler3 = readonly [number, number, number];
export type PoseVrm = {
  ossos: Readonly<Record<string, Euler3>>;
  /** a respiração: quanto o peito sobe/desce (rad) e a frequência (Hz) */
  respira?: { amp: number; hz: number };
};

/** em pé, FEMININA (contrapposto): o peso na perna direita, a esquerda com o joelho dobrado e o pé à frente e pra
 *  dentro; o quadril inclinado pro lado do apoio, o tronco compensando; os braços descem e as mãos se encontram na
 *  frente; a cabeça inclinada de leve */
export const POSE_FEMININA: PoseVrm = {
  ossos: {
    hips: [0, 0.1, 0.06],
    spine: [0.02, -0.04, -0.05],
    chest: [0.02, -0.02, -0.03],
    neck: [0.03, 0, 0.04],
    head: [0.04, 0.08, 0.12],
    leftUpperArm: [0, -0.55, -1.08],
    rightUpperArm: [0, 0.55, 1.08],
    leftLowerArm: [0, -1.25, 0],
    rightLowerArm: [0, 1.25, 0],
    leftHand: [0, 0, 0.25],
    rightHand: [0, 0, -0.25],
    leftUpperLeg: [-0.22, 0, -0.08],
    leftLowerLeg: [0.45, 0, 0],
    leftFoot: [-0.12, 0, 0],
    rightUpperLeg: [0.02, 0, 0.04],
    rightLowerLeg: [0.02, 0, 0],
  },
  respira: { amp: 0.018, hz: 0.25 },
};

export const POSES_VRM = { feminina: POSE_FEMININA } as const;
export type NomePoseVrm = keyof typeof POSES_VRM;

/** o ângulo do peito com a respiração no tempo `t` (s) */
export function respiracao(p: PoseVrm, t: number): number {
  return p.respira ? Math.sin(t * Math.PI * 2 * p.respira.hz) * p.respira.amp : 0;
}
