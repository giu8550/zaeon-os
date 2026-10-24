// Tipos (Zaeon) do motion.js do open-annie — só o que usamos.
import type * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";

export type DadosClipe = { fps: number; duration: number; loop: boolean; frames?: number; bones: Record<string, number[]>; hips_position?: number[] };
export class ClipSampler {
  constructor(vrm: VRM, data: DadosClipe, o?: { bones?: Set<string>; fill?: Record<string, THREE.Quaternion>; name?: string; meta?: Record<string, unknown> });
  bones: Record<string, Float32Array>;
  duration: number;
  sample(t: number, out: Record<string, THREE.Quaternion>): Record<string, THREE.Quaternion>;
}
export const FINGER_BONES: string[];
export type Pacote = { id?: string; base: string; hands?: Record<string, number[]>; clips: Record<string, { file: string; loop: boolean; duration: number; kind?: string; layer?: string; energy?: string; stroke?: number; data: DadosClipe }> };
export function fetchPack(baseUrl: string, o?: { only?: (name: string, clip: unknown) => boolean }): Promise<Pacote>;
