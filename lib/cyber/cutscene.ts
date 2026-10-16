/**
 * CUTSCENES do cyberespaço (PURO, sem three) — o tutorial como um RPG (out/2026): enquanto um personagem fala, a câmera
 * deixa a órbita de 3ª pessoa e ENQUADRA outra coisa (o Droid, a Zaeon, os telões, a Sala do Saber), com as faixas de
 * cinema. Um PLANO é foco + ângulo + distância; o engine MISTURA a pose do plano com a da câmera normal pelo PESO
 * (0 = a câmera de sempre, 1 = só o plano), que sobe e desce suave — "a câmera volta pro personagem devagar".
 */
export type V3 = { x: number; y: number; z: number };
/** um plano de câmera: olha pro `foco`, de `az` (rumo horizontal: a câmera fica em foco + (sin az, ·, cos az)·dist),
 *  `pitch` (acima do horizonte) e `dist` */
export type Plano = { foco: V3; az: number; pitch: number; dist: number };
export type Pose = { pos: V3; olhar: V3 };

/** quanto tempo a câmera leva pra ENTRAR na cena e pra VOLTAR (s); `voltaLenta` = o fim do tutorial */
export const RITMO_CENA = { entra: 0.9, volta: 1.3, voltaLenta: 3.2 } as const;
/** a altura das faixas de cinema (fração da tela, cada uma) com a cena inteira */
export const FAIXA_CINEMA = 0.085;

export function poseDoPlano(p: Plano): Pose {
  const cp = Math.cos(p.pitch);
  return {
    pos: { x: p.foco.x + Math.sin(p.az) * cp * p.dist, y: p.foco.y + Math.sin(p.pitch) * p.dist, z: p.foco.z + Math.cos(p.az) * cp * p.dist },
    olhar: { ...p.foco },
  };
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp3 = (a: V3, b: V3, k: number): V3 => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k) });
/** a curva do peso (suave nas pontas) */
export const suave = (w: number) => { const x = Math.max(0, Math.min(1, w)); return x * x * (3 - 2 * x); };
/** a câmera de verdade: a normal misturada com a da cena pelo peso (já suavizado) */
export function misturarPose(normal: Pose, cena: Pose, w: number): Pose {
  const k = suave(w);
  return { pos: lerp3(normal.pos, cena.pos, k), olhar: lerp3(normal.olhar, cena.olhar, k) };
}
/** o peso anda pro alvo (1 com cena, 0 sem) no ritmo certo */
export function passoPeso(w: number, temCena: boolean, dt: number, lenta = false): number {
  if (temCena) return Math.min(1, w + dt / RITMO_CENA.entra);
  return Math.max(0, w - dt / (lenta ? RITMO_CENA.voltaLenta : RITMO_CENA.volta));
}
/** a pose da cena também anda suave quando o plano muda (telão dos problemas → das soluções): `k` por segundo */
export function seguirPose(atual: Pose, alvo: Pose, dt: number, k = 1.8): Pose {
  const f = 1 - Math.exp(-dt * k);
  return { pos: lerp3(atual.pos, alvo.pos, f), olhar: lerp3(atual.olhar, alvo.olhar, f) };
}

/** o plano do DROID falando: a câmera ao lado de quem ouve, olhando pro Droid (os dois na tela, ele em destaque) */
export function planoConversa(quemFala: V3, quemOuve: V3, o: { lado?: number; pitch?: number; recuo?: number } = {}): Plano {
  const dx = quemOuve.x - quemFala.x, dz = quemOuve.z - quemFala.z, d = Math.hypot(dx, dz) || 1;
  const foco = lerp3(quemFala, quemOuve, 0.28);
  return { foco, az: Math.atan2(dx, dz) + (o.lado ?? 0.55), pitch: o.pitch ?? 0.1, dist: d * 0.72 + (o.recuo ?? 4.5) };
}
/** o plano de um TELÃO: de frente pra ele (`rot` = pra onde ele está virado), longe o bastante pra caber inteiro */
export function planoTelao(t: { x: number; z: number; y: number; rot: number; larg: number }): Plano {
  return { foco: { x: t.x, y: t.y, z: t.z }, az: t.rot, pitch: 0.06, dist: t.larg * 1.25 };
}
