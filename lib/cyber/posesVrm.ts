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

/** em pé, MASCULINA e à vontade: o peso numa perna, os pés um pouco afastados, os braços soltos com os cotovelos
 *  levemente dobrados, o tronco relaxado e a cabeça um pouco de lado */
export const POSE_MASCULINA: PoseVrm = {
  ossos: {
    hips: [0, -0.06, -0.04],
    spine: [-0.03, 0.03, 0.03],
    chest: [-0.02, 0.02, 0.02],
    head: [0.02, -0.1, -0.05],
    leftUpperArm: [0, -0.12, -1.22],
    rightUpperArm: [0, 0.12, 1.22],
    leftLowerArm: [0, -0.3, 0],
    rightLowerArm: [0, 0.3, 0],
    leftUpperLeg: [0, 0, 0.06],
    rightUpperLeg: [-0.08, 0, -0.08],
    rightLowerLeg: [0.16, 0, 0],
  },
  respira: { amp: 0.014, hz: 0.22 },
};

/** em pé, FEMININA e À VONTADE — a das JOGADORAS paradas (o dono, out/2026: "a pose idle dela poderia ser mais
 *  feminina"; acertada ao vivo na Giulia): os dois BRAÇOS SOLTOS, iguais, com os cotovelos levemente dobrados e as
 *  mãos relaxadas (a mão na cintura atravessava as costas — o dono preferiu assim); o peso na perna direita — o quadril sai pra esse lado e o tronco faz o S —, a perna
 *  esquerda à frente com o joelho dobrado e a ponta do pé; o peito alto e a cabeça inclinada, olhando de lado */
export const POSE_FEMININA_A_VONTADE: PoseVrm = {
  ossos: {
    hips: [0, -0.14, -0.09],
    spine: [0.02, 0.07, 0.07],
    chest: [-0.05, 0.05, 0.05],
    upperChest: [-0.03, 0, 0.02],
    neck: [0.02, -0.04, -0.04],
    head: [0.06, 0.12, 0.16],
    leftUpperArm: [0.08, 0.15, -1.2],
    leftLowerArm: [0, -0.4, 0],
    leftHand: [0, 0, 0.25],
    rightUpperArm: [0.08, -0.15, 1.2],
    rightLowerArm: [0, 0.4, 0],
    rightHand: [0, 0, -0.25],
    rightUpperLeg: [0.02, 0, 0.09],
    rightLowerLeg: [0.02, 0, 0],
    leftUpperLeg: [-0.3, 0, -0.06],
    leftLowerLeg: [0.55, 0, 0],
    leftFoot: [-0.25, 0, 0],
  },
  respira: { amp: 0.018, hz: 0.25 },
};

export const POSES_VRM = { feminina: POSE_FEMININA, masculina: POSE_MASCULINA } as const;
export type NomePoseVrm = keyof typeof POSES_VRM;

/** o ângulo do peito com a respiração no tempo `t` (s) */
export function respiracao(p: PoseVrm, t: number): number {
  return p.respira ? Math.sin(t * Math.PI * 2 * p.respira.hz) * p.respira.amp : 0;
}
