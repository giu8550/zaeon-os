/**
 * Câmera do cyberespaço — órbita livre em 3ª pessoa com "olhar pra cima". PURO (vetores simples, sem three).
 * Arrastar pra cima/baixo muda o `pitch`. Acima de zero a câmera sobe e olha pro personagem; arrastando pra baixo
 * ela desce até ENCOSTAR no chão (não atravessa) e, daí em diante, o OLHAR inclina pro céu — dá pra ver a Zaeon,
 * as estrelas e o buraco negro de baixo, sem a câmera ir pra dentro do piso.
 */
export const PITCH_MIN = -1.1;
export const PITCH_MAX = 1.25;
/** altura mínima da câmera acima do chão sob o personagem */
export const CAM_FOLGA_CHAO = 0.4;
const ELEV_MAX = 1.35;   // ~77°: olhar quase pro zênite

type V3 = { x: number; y: number; z: number };
export const limitarPitch = (p: number) => Math.max(PITCH_MIN, Math.min(PITCH_MAX, p));

/**
 * `olho` = ponto que a câmera segue (cabeça do personagem); `chaoY` = altura do chão sob ele (0 na praça; o piso
 * quando está na plataforma). Devolve onde a câmera fica e pra onde olha.
 */
export function poseDaCamera(o: { olho: V3; az: number; pitch: number; dist: number; chaoY: number }): { pos: V3; olhar: V3 } {
  const { olho, az, dist } = o, pitch = limitarPitch(o.pitch);
  const piso = o.chaoY + CAM_FOLGA_CHAO;
  // pitch em que a câmera encosta no chão
  const pChao = Math.asin(Math.max(-1, Math.min(1, (piso - olho.y) / dist)));
  const p = Math.max(pitch, pChao);
  const pos = { x: olho.x + Math.sin(az) * Math.cos(p) * dist, y: olho.y + Math.sin(p) * dist, z: olho.z + Math.cos(az) * Math.cos(p) * dist };
  if (pitch >= pChao) return { pos, olhar: { ...olho } };
  // abaixo disso: a câmera fica no chão e o OLHAR sobe proporcional ao quanto se arrastou além
  const dx = olho.x - pos.x, dy = olho.y - pos.y, dz = olho.z - pos.z, h = Math.hypot(dx, dz) || 1e-6;
  const e0 = Math.atan2(dy, h), e = Math.min(ELEV_MAX, e0 + (pChao - pitch) * 1.6);
  const L = 10;
  return { pos, olhar: { x: pos.x + (dx / h) * Math.cos(e) * L, y: pos.y + Math.sin(e) * L, z: pos.z + (dz / h) * Math.cos(e) * L } };
}

/** elevação (rad) do olhar — pra testes/HUD */
export function elevacaoDoOlhar(c: { pos: V3; olhar: V3 }): number {
  const dx = c.olhar.x - c.pos.x, dy = c.olhar.y - c.pos.y, dz = c.olhar.z - c.pos.z;
  return Math.atan2(dy, Math.hypot(dx, dz));
}
