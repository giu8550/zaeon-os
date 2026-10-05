/**
 * Cyberespaço — VOO da nave do dono. PURO. Movimento relativo à câmera (como andar), subir/descer, inércia leve,
 * limites do mapa, colisão com a ilha da cidade e com marcos sólidos; POUSO quando encosta no chão (do mapa ou da
 * cidade) — aí dá pra sair da nave e interagir no chão.
 */
import { foraDaIlha, chaoDaNave } from "./ceu";
import type { Colisor } from "./colisao";

export type EstadoVoo = { x: number; y: number; z: number; yaw: number; vx: number; vy: number; vz: number };
export type ComandoVoo = { wx: number; wz: number; subir: boolean; descer: boolean };

export const VOO = { vel: 26, sobe: 18, inercia: 3, yMax: 260, raioMapa: 320 };

/** cilindros sólidos pra nave (ex.: a Zaeon): { x, z, r, topo } */
export type Pilar = Colisor & { topo: number };

export function passoVoo(s: EstadoVoo, c: ComandoVoo, dt: number, solidos: Pilar[] = []): { s: EstadoVoo; pousado: boolean; chaoY: number } {
  const k = Math.min(1, dt * VOO.inercia);
  const m = Math.hypot(c.wx, c.wz);
  const tx = m > 0 ? (c.wx / m) * VOO.vel : 0, tz = m > 0 ? (c.wz / m) * VOO.vel : 0;
  const ty = (c.subir ? VOO.sobe : 0) - (c.descer ? VOO.sobe : 0);
  let { x, y, z, yaw, vx, vy, vz } = s;
  vx += (tx - vx) * k; vz += (tz - vz) * k; vy += (ty - vy) * k;
  x += vx * dt; y += vy * dt; z += vz * dt;
  if (Math.hypot(vx, vz) > 0.5) { let d = Math.atan2(vx, vz) - yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; yaw += d * Math.min(1, dt * 4); }
  // limites do mapa
  const r = Math.hypot(x, z); if (r > VOO.raioMapa) { x *= VOO.raioMapa / r; z *= VOO.raioMapa / r; }
  if (y > VOO.yMax) { y = VOO.yMax; vy = Math.min(vy, 0); }
  // sólidos: ilha da cidade e marcos (cilindros)
  ({ x, y, z } = foraDaIlha({ x, y, z }));
  for (const p of solidos) {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d < p.r && y < p.topo) { const kk = d > 1e-4 ? p.r / d : 1; x = p.x + (d > 1e-4 ? dx * kk : p.r); z = p.z + (d > 1e-4 ? dz * kk : 0); }
  }
  const chaoY = chaoDaNave({ x, y, z });
  let pousado = false;
  if (y <= chaoY) { y = chaoY; vy = Math.max(0, vy); pousado = true; }
  return { s: { x, y, z, yaw, vx, vy, vz }, pousado, chaoY };
}
