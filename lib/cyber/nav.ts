/**
 * Cyberespaço — NAVEGAÇÃO com altura nos marcos andáveis (Zaeon): chão → ESCADA (rampa) → PLATAFORMA do QG.
 * PURO, sem three e sem física: o mundo continua no plano XZ; a altura (y) sai da posição + do "nível" (no chão
 * ou no alto). Regras:
 *  - do chão só se entra na escada pelo PÉ (os lados e a ilha são sólidos; não dá pra andar por baixo da ilha);
 *  - na escada, y sobe linear até o piso; passando da borda, está na plataforma;
 *  - na plataforma: muralhas são um anel sólido com um PORTÃO alinhado à escada; os pilares da casa são sólidos;
 *    não se cai pela borda (a única saída é a escada).
 */
import type { P2 } from "./colisao";
import { empurrarParaFora, type Colisor } from "./colisao";

/** Geometria andável de um marco (coordenadas de MUNDO já escaladas). */
export type NavPOI = {
  pisoY: number;        // altura do piso da plataforma (topo da ilha)
  bordaR: number;       // raio da borda da PLATAFORMA andável (o piso) — a escada encosta aqui, no portão
  chaoR: number;        // raio SÓLIDO no chão (a base da ilha): não se anda por baixo
  muralhaR: number;     // raio do anel de muralhas
  muralhaN: number;     // quantos blocos de muralha
  muralhaColR: number;  // raio do colisor de cada bloco (sobrepostos → anel contínuo)
  portaoMeia: number;   // meia-abertura angular do portão (rad)
  pilares: { n: number; r: number; colR: number };
  escada: { dir: number; largura: number; comprimento: number };   // dir = ângulo (rad) do centro pra fora, no plano (x=cos, z=sin)
};
export type MarcoNav = { x: number; z: number; nav: NavPOI };

/** Fração do comprimento a partir da qual a escada é "pé" (dá pra pisar vindo do chão). */
export const PE_DA_ESCADA = 0.85;

const angDif = (a: number, b: number) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };

/** Coordenadas no referencial da escada: `along` (do centro pra fora), `lat` (lateral), `u` (desde a borda), `t` (0 topo · 1 pé). */
export function escadaLocal(m: MarcoNav, p: P2) {
  const { dir, comprimento } = m.nav.escada;
  const ax = Math.cos(dir), az = Math.sin(dir);
  const rx = p.x - m.x, rz = p.z - m.z;
  const along = rx * ax + rz * az, lat = -rx * az + rz * ax;
  const u = along - m.nav.bordaR;
  return { along, lat, u, t: u / comprimento };
}
/** Ponto de mundo a partir de (along, lat) no referencial da escada. */
export function deEscada(m: MarcoNav, along: number, lat: number): P2 {
  const ax = Math.cos(m.nav.escada.dir), az = Math.sin(m.nav.escada.dir);
  return { x: m.x + along * ax - lat * az, z: m.z + along * az + lat * ax };
}

export function naEscada(m: MarcoNav, p: P2, folga = 0): boolean {
  const e = escadaLocal(m, p);
  return e.u >= -folga && e.u <= m.nav.escada.comprimento + folga && Math.abs(e.lat) <= m.nav.escada.largura / 2 + folga;
}
export const alturaDaEscada = (m: MarcoNav, t: number) => m.nav.pisoY * (1 - Math.min(1, Math.max(0, t)));

/** Altura do chão em (x,z) — SEM estado (usada pros avatares remotos): escada → rampa; dentro da borda → piso; fora → 0. */
export function alturaEm(m: MarcoNav, p: P2): number {
  if (naEscada(m, p)) return alturaDaEscada(m, escadaLocal(m, p).t);
  return Math.hypot(p.x - m.x, p.z - m.z) <= m.nav.bordaR ? m.nav.pisoY : 0;
}

/** Colisores da PLATAFORMA (mundo): blocos de muralha (menos o portão) + pilares. */
export function colisoresDoAlto(m: MarcoNav): Colisor[] {
  const { muralhaR, muralhaN, muralhaColR, portaoMeia, pilares, escada } = m.nav;
  const out: Colisor[] = [];
  for (let i = 0; i < muralhaN; i++) {
    const a = (i / muralhaN) * Math.PI * 2;
    if (angDif(a, escada.dir) < portaoMeia) continue;   // portão alinhado à escada
    out.push({ x: m.x + Math.cos(a) * muralhaR, z: m.z + Math.sin(a) * muralhaR, r: muralhaColR });
  }
  for (let i = 0; i < pilares.n; i++) { const a = (i / pilares.n) * Math.PI * 2; out.push({ x: m.x + Math.cos(a) * pilares.r, z: m.z + Math.sin(a) * pilares.r, r: pilares.colR }); }
  return out;
}
/** Os blocos de muralha que EXISTEM (o portão fica aberto) — o builder visual usa o mesmo critério. */
export const muralhaTemBloco = (m: MarcoNav, i: number) => angDif((i / m.nav.muralhaN) * Math.PI * 2, m.nav.escada.dir) >= m.nav.portaoMeia;

/** Empurra pra fora do CORPO da escada (do chão, só o pé é pisável). */
function foraDoCorpoDaEscada(m: MarcoNav, p: P2): P2 {
  const e = escadaLocal(m, p), meia = m.nav.escada.largura / 2 + 0.4, ate = m.nav.escada.comprimento * PE_DA_ESCADA;
  if (e.u < -0.4 || e.u > ate || Math.abs(e.lat) > meia) return p;
  return deEscada(m, e.along, e.lat >= 0 ? meia : -meia);   // sai pelo lado mais perto
}

export type Passo = { x: number; z: number; y: number; alto: boolean };

/**
 * Resolve um passo `prev → prop` num marco andável. `alto` = já está na escada/plataforma.
 * No chão: pisa na escada só pelo pé; senão, a ilha (círculo) e o corpo da escada são sólidos.
 * No alto: escada (clamp lateral; no pé volta pro chão) ou plataforma (muralhas+pilares sólidos; não cai da borda).
 */
export function resolverPasso(m: MarcoNav, alto: boolean, prev: P2, prop: P2): Passo {
  const { bordaR, escada, pisoY } = m.nav, meia = escada.largura / 2;
  if (!alto) {
    const e = escadaLocal(m, prop);
    // pisa na escada SÓ pelo pé (dentro do comprimento — nada de "meio passo" além do fim)
    if (Math.abs(e.lat) <= meia && e.t >= PE_DA_ESCADA && e.t <= 1) return { ...prop, y: alturaDaEscada(m, e.t), alto: true };
    const q = empurrarParaFora(foraDoCorpoDaEscada(m, prop), [{ x: m.x, z: m.z, r: m.nav.chaoR }]);
    return { ...q, y: 0, alto: false };
  }
  const e = escadaLocal(m, prop);
  const dCentro = Math.hypot(prop.x - m.x, prop.z - m.z);
  const naPlataforma = dCentro <= bordaR && e.u < 0;
  // faixa da escada (com margem): só aí o "alto fora da plataforma" é escada — no resto vale a borda da plataforma
  const faixaDaEscada = e.u >= -1 && Math.abs(e.lat) <= meia + 1.5;
  if (!naPlataforma && faixaDaEscada) {
    // no alto e fora da plataforma = na ESCADA: preso aos degraus (sem saltos); passou do pé → chão
    if (e.u >= escada.comprimento) return { ...prop, y: 0, alto: false };
    const lat = Math.max(-meia + 0.2, Math.min(meia - 0.2, e.lat));
    const u = Math.max(0, e.u);
    const q = deEscada(m, bordaR + u, lat);
    return { ...q, y: alturaDaEscada(m, u / escada.comprimento), alto: true };
  }
  // na plataforma: muralhas (com portão) e pilares sólidos; não cai pela borda (a saída é a escada)
  let q = empurrarParaFora(prop, colisoresDoAlto(m));
  const eq = escadaLocal(m, q);
  const dx = q.x - m.x, dz = q.z - m.z, d = Math.hypot(dx, dz), max = bordaR - 0.3;
  const naBoca = eq.along > 0 && Math.abs(eq.lat) <= meia - 0.2;   // só a boca DA ESCADA fica aberta (não o lado oposto)
  if (d > max && !naBoca) q = { x: m.x + (dx / d) * max, z: m.z + (dz / d) * max };
  void prev;
  return { ...q, y: pisoY, alto: true };
}
