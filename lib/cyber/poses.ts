/**
 * Cyberespaço — POSES capturadas (PURO). Animações reais da Quaternius Universal Animation Library (CC0) — pulo:
 * Jump_Start, Jump_Loop (no ar), Jump_Land (impacto) — "assadas" offline em DIREÇÕES de cada segmento do corpo
 * (braço, antebraço, coxa, canela, pé, tronco) por quadro, no referencial do personagem (frente, cima, esquerda), + a
 * altura do quadril. Assim servem pra QUALQUER esqueleto (o avatar é rig Mixamo; a biblioteca é outro rig): o avatar
 * aponta os próprios ossos pra essas direções (o mesmo `apontar` das outras poses). ~30 KB em vez do GLB de 7,6 MB.
 */
import dados from "./poses-ual.json";

export type Segmento = "bracoE" | "anteE" | "bracoD" | "anteD" | "coxaE" | "canelaE" | "coxaD" | "canelaD" | "peE" | "peD" | "tronco";
export type NomeClipe = "Jump_Start" | "Jump_Loop" | "Jump_Land";
/** direção (frente, cima, esquerda) — unitária */
export type Dir3 = [number, number, number];
export type Pose = Record<Segmento, Dir3> & { quadril: number };

const D = dados as unknown as { fps: number; segmentos: Segmento[]; clips: Record<NomeClipe, { dur: number; quadros: number[][] }> };
export const SEGMENTOS = D.segmentos;
export const duracaoClipe = (c: NomeClipe) => D.clips[c].dur;

/** a pose do clipe no instante `t` (s): interpola os quadros vizinhos (e renormaliza); `loop` repete, senão segura o fim */
export function amostrarPose(c: NomeClipe, t: number, loop: boolean): Pose {
  const { dur, quadros } = D.clips[c], n = quadros.length;
  let u = dur > 0 ? t / dur : 0;
  u = loop ? u - Math.floor(u) : Math.max(0, Math.min(1, u));
  const x = u * (n - 1), i = Math.min(n - 2, Math.floor(x)), k = x - i, a = quadros[i]!, b = quadros[i + 1]!;
  const p = {} as Pose;
  SEGMENTOS.forEach((s, j) => {
    const v: Dir3 = [a[j * 3]! + (b[j * 3]! - a[j * 3]!) * k, a[j * 3 + 1]! + (b[j * 3 + 1]! - a[j * 3 + 1]!) * k, a[j * 3 + 2]! + (b[j * 3 + 2]! - a[j * 3 + 2]!) * k];
    const m = Math.hypot(v[0], v[1], v[2]) || 1; p[s] = [v[0] / m, v[1] / m, v[2] / m];
  });
  const q = SEGMENTOS.length * 3; p.quadril = a[q]! + (b[q]! - a[q]!) * k;
  return p;
}

/** mistura duas direções (t = 0 → a, 1 → b), unitária */
export function misturar(a: Dir3, b: Dir3, t: number): Dir3 {
  const v: Dir3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m];
}

/** envelope do pouso: entra rápido (impacto), segura e solta suave no fim — `u` de 0 a 1 */
export function envelopePouso(u: number): number {
  if (u <= 0 || u >= 1) return 0;
  const sobe = Math.min(1, u * 10), s = Math.max(0, Math.min(1, (u - 0.55) / 0.45));
  return sobe * (1 - s * s * (3 - 2 * s));
}
