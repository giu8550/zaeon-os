/**
 * Cyberespaço — VOO da nave do dono. PURO. Movimento relativo à câmera (como andar), subir/descer, inércia leve,
 * limites do mapa, colisão com a ilha da cidade e com marcos sólidos; POUSO quando encosta no chão (do mapa, da
 * cidade ou do TOPO de um marco) — aí dá pra sair da nave e interagir ali. Os botões de movimento (subir, descer,
 * direção) levam a nave a QUALQUER lugar do mapa; `passoVooSub` deixa o voo igual em qualquer FPS.
 */
import { foraDaIlha, chaoDaNave } from "./ceu";
import type { Colisor } from "./colisao";

export type EstadoVoo = { x: number; y: number; z: number; yaw: number; vx: number; vy: number; vz: number };
export type ComandoVoo = { wx: number; wz: number; subir: boolean; descer: boolean };

/** vel/sobe em m/s; `dtMax` = maior quadro aceito (aba que voltou do fundo); `subpasso` = passo da física */
/** `freio`: soltar a direção para a nave em poucos metros (paira ali) */
/** `decolar`: no chão (ou a menos disso acima dele) a nave NÃO anda de lado — tem que subir primeiro */
export const VOO = { vel: 30, sobe: 38, inercia: 3, freio: 7, decolar: 1.5, yMax: 420, raioMapa: 540, dtMax: 0.25, subpasso: 1 / 60 };

/** folga de pouso: o topo dos marcos flutua (±0,15 m); parada a até isso acima do chão = pousada */
export const POUSO_TOL = 0.3;

/** cilindros sólidos pra nave (ex.: a Zaeon): { x, z, r, topo }. Quem vem DE CIMA para no topo (pousa ali). */
export type Pilar = Colisor & { topo: number; base?: number };

/** o chão sob a nave: o mais alto entre o mapa/cidade e o topo dos pilares embaixo dela */
export function chaoDoVoo(p: { x: number; y: number; z: number }, solidos: Pilar[] = []): number {
  let c = chaoDaNave(p);
  for (const s of solidos) if (Math.hypot(p.x - s.x, p.z - s.z) < s.r && p.y >= s.topo - 0.5 && s.topo > c) c = s.topo;
  return c;
}

/** `teto`: altura máxima (a nave vai até `VOO.yMax`; a moto voadora tem um teto bem mais baixo) */
export function passoVoo(s: EstadoVoo, c: ComandoVoo, dt: number, solidos: Pilar[] = [], teto: number = VOO.yMax): { s: EstadoVoo; pousado: boolean; chaoY: number } {
  // pousada / rente ao chão: a direção não move a nave (só subir decola); ao descer pra pousar, para de andar
  const rente = s.y - chaoDoVoo(s, solidos) < VOO.decolar;
  const m = rente ? 0 : Math.hypot(c.wx, c.wz);
  const k = Math.min(1, dt * (m > 0 ? VOO.inercia : VOO.freio)), ky = Math.min(1, dt * (c.subir || c.descer ? VOO.inercia : VOO.freio));
  const tx = m > 0 ? (c.wx / m) * VOO.vel : 0, tz = m > 0 ? (c.wz / m) * VOO.vel : 0;
  const ty = (c.subir ? VOO.sobe : 0) - (c.descer ? VOO.sobe : 0);
  let { x, y, z, yaw, vx, vy, vz } = s;
  vx += (tx - vx) * k; vz += (tz - vz) * k; vy += (ty - vy) * ky;
  x += vx * dt; y += vy * dt; z += vz * dt;
  if (Math.hypot(vx, vz) > 0.5) { let d = Math.atan2(vx, vz) - yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; yaw += d * Math.min(1, dt * 4); }
  // limites do mapa
  const r = Math.hypot(x, z); if (r > VOO.raioMapa) { x *= VOO.raioMapa / r; z *= VOO.raioMapa / r; }
  if (y > teto) { y = teto; vy = Math.min(vy, 0); }
  // sólidos: ilha da cidade e marcos (cilindros). Vindo de cima → fica no topo; de lado → desliza pra fora.
  ({ x, y, z } = foraDaIlha({ x, y, z }));
  for (const p of solidos) {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d >= p.r || y >= p.topo || (p.base !== undefined && y <= p.base)) continue;   // `base`: sólido só de base a topo (ilhota flutuante)
    if (s.y >= p.topo - POUSO_TOL) { y = p.topo; vy = Math.max(0, vy); continue; }   // em cima (tolera a flutuação do marco)
    const kk = d > 1e-4 ? p.r / d : 1; x = p.x + (d > 1e-4 ? dx * kk : p.r); z = p.z + (d > 1e-4 ? dz * kk : 0);
  }
  const chaoY = chaoDoVoo({ x, y, z }, solidos);
  let pousado = false;
  // encostou (ou está a um fio, parada): pousa e acompanha o chão — o topo dos marcos sobe e desce devagar
  if (y <= chaoY || (y <= chaoY + POUSO_TOL && vy <= 1e-6)) { y = chaoY; vy = Math.max(0, vy); pousado = true; }
  return { s: { x, y, z, yaw, vx, vy, vz }, pousado, chaoY };
}

/** o mesmo passo, independente de FPS: usa o dt REAL (até `dtMax`) dividido em subpassos de no máximo `subpasso` */
export function passoVooSub(s: EstadoVoo, c: ComandoVoo, dt: number, solidos: Pilar[] = [], teto: number = VOO.yMax): { s: EstadoVoo; pousado: boolean; chaoY: number } {
  const total = Math.min(VOO.dtMax, Math.max(0, dt)), n = Math.max(1, Math.ceil(total / VOO.subpasso - 1e-9)), h = total / n;
  let r = { s, pousado: false, chaoY: 0 };
  for (let i = 0; i < n; i++) r = passoVoo(r.s, c, h, solidos, teto);
  return r;
}

/**
 * Os sólidos de voo de um marco andável (medidas do preset da Zaeon × escala, a partir da base `altura`):
 * o CORPO (ilha + muralhas, até o alto delas) e a CÚPULA da casa — em cima dela fica o topo do dono, onde a nave pousa.
 */
export function pilaresDoMarco(m: { x: number; z: number; chaoR: number; altura: number; escala: number; cupula: boolean }): Pilar[] {
  const out: Pilar[] = [{ x: m.x, z: m.z, r: m.chaoR, topo: m.altura + 3.7 * m.escala }];
  if (m.cupula) out.push({ x: m.x, z: m.z, r: 3.9 * m.escala, topo: m.altura + 8.4 * m.escala });
  return out;
}
