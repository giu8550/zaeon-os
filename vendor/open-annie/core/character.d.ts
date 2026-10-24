// Tipos (Zaeon) do Character do open-annie (character.js) — só o que usamos.
import type * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";

import type { Pacote } from "./motion";
export type Energia = "gentle" | "moderate" | "high";
export type GestoCabeca = "nod" | "shake" | "tilt" | "duck" | "bnod" | "btilt";

export class Character {
  /** monta sobre um VRM já carregado (`pack` = o pacote de movimento do motion.fetchPack; `talk` = o da camada de fala) */
  constructor(vrm: VRM, camera: THREE.Camera, seed: number, o?: { pack?: Pacote | null; talk?: Pacote | null });
  static load(o: {
    url: string; scene: THREE.Object3D; camera: THREE.Camera; seed?: number;
    onProgress?: (e: ProgressEvent) => void;
    motion?: { packs?: string[]; talk?: string | null };
    hide?: { materials?: string[]; springs?: string | null } | null;
  }): Promise<Character>;
  vrm: VRM;
  camera: THREE.Camera;
  meta: Record<string, { loop: boolean; duration: number; kind: string }>;
  energy: Energia;
  listening: boolean;
  speaking: boolean;
  current: { name: string; idle: boolean; kind: string; endsAt: number } | null;
  /** (Zaeon) a camada por cima da pose, antes da colisão e do vrm.update */
  overlay?: ((c: Character, now: number, dt: number) => void) | null;
  playClip(name: string, o?: { energy?: Energia }): boolean;
  gesture(name: GestoCabeca, o?: { side?: number }): boolean;
  setFace(name: string, intensity?: number): boolean;
  setMouth(weights: Record<string, number>, speaking: boolean): void;
  hear(now: number, f: { amp: number; db: number } | null, userSpeaking?: boolean, userLevel?: number): void;
  transcript(text: string, now: number): void;
  bargeIn(): void;
  update(now: number, dt: number): void;
}
