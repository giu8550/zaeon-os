/**
 * Cyberespaço — ATALHOS de rota da nave ("Heliporto", na praça, e "Zaeon"). PURO. Não é teletransporte: o piloto
 * automático gera as MESMAS entradas dos botões de movimento (direção, subir, descer), então a nave voa à vista de
 * todos pelo caminho. Qualquer botão de movimento cancela (no engine). A rota contorna a ilha da cidade (sai pela
 * borda, do lado do destino) e cruza o mapa numa altitude livre (abaixo do fundo da ilha da Zaeon).
 */
import { CIDADE } from "./ceu";
import { poseDaDoca } from "./naveQG";
import { HELIPORTO } from "./landmarks";
import { VOO, type ComandoVoo, type EstadoVoo } from "./voo";

export type DestinoRota = "heliporto" | "zaeon";
export type Waypoint = { x: number; y: number; z: number; pousar?: boolean };

/** altitude de cruzeiro perto da praça: acima das bases e do heliporto, bem abaixo da ponta da agulha da Zaeon */
export const CRUZEIRO = 40;
const FOLGA_BORDA = 8, ACIMA_DA_CIDADE = 8;

const daCidade = (p: { x: number; z: number }) => Math.hypot(p.x - CIDADE.centro.x, p.z - CIDADE.centro.z);
/** ponto fora da ilha, na borda, do lado de `rumo` (o destino) */
function saidaDaIlha(rumo: { x: number; z: number }, y: number): Waypoint {
  const c = CIDADE.centro; let dx = rumo.x - c.x, dz = rumo.z - c.z; const d = Math.hypot(dx, dz);
  if (d < 1e-6) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
  const r = CIDADE.bordaR + FOLGA_BORDA;
  return { x: c.x + dx * r, y, z: c.z + dz * r };
}

/** onde cada atalho pousa: no heliporto (na ilha da praça) ou atracada na doca da Zaeon */
export function alvoDoAtalho(destino: DestinoRota): Waypoint {
  if (destino === "heliporto") return { x: HELIPORTO.x, y: 0, z: HELIPORTO.z, pousar: true };
  const d = poseDaDoca(); return { x: d.x, y: d.y, z: d.z };   // atraca PAIRANDO na doca, ao lado da ilha (sem pousar)
}

/** a rota (waypoints) da posição atual até pousar no destino */
export function rotaPara(destino: DestinoRota, s: EstadoVoo): Waypoint[] {
  const alvo = alvoDoAtalho(destino);
  const rota: Waypoint[] = [];
  const altoCidade = CIDADE.pisoY + ACIMA_DA_CIDADE, naCidade = s.y >= CIDADE.pisoY - 0.5 && daCidade(s) <= CIDADE.bordaR + 2;
  const naColuna = daCidade(s) < CIDADE.bordaR + 2;
  let p = { x: s.x, y: s.y, z: s.z };
  if (destino === "zaeon") {
    // pra doca da Zaeon (céu): embaixo da ilha, decola e sai pela lateral; sobe POR FORA; atraca ao lado da ilha, do lado da doca
    if (!naCidade) {
      if (naColuna) {
        const yv = Math.max(p.y, VOO.decolar + SOLTA_V + 2);
        if (yv > p.y + 1) { rota.push({ x: p.x, y: yv, z: p.z }); p = { ...p, y: yv }; }
        const sai = saidaDaIlha(alvo, yv); rota.push(sai); p = sai;
      }
      rota.push({ x: p.x, y: altoCidade, z: p.z });
      rota.push(saidaDaIlha(alvo, altoCidade));
    } else if (p.y < altoCidade - 1) rota.push({ x: p.x, y: altoCidade, z: p.z });
    rota.push({ x: alvo.x, y: altoCidade, z: alvo.z });
    rota.push(alvo);
    return rota;
  }
  // se estiver na Zaeon (ou embaixo da ilha), sai pela borda do lado do destino
  if (naCidade) {
    if (p.y < altoCidade - 1) { rota.push({ x: p.x, y: altoCidade, z: p.z }); p = { ...p, y: altoCidade }; }
    const sai = saidaDaIlha(alvo, altoCidade); rota.push(sai); p = sai;
  } else if (naColuna && p.y < CIDADE.pisoY) {
    // embaixo da ilha: decola o bastante (no chão a nave não anda de lado) e sai pela lateral
    const yv = Math.max(p.y, VOO.decolar + SOLTA_V + 2);
    if (yv > p.y + 1) { rota.push({ x: p.x, y: yv, z: p.z }); p = { ...p, y: yv }; }
    const sai = saidaDaIlha(alvo, yv); rota.push(sai); p = sai;
  }
  const cruz = Math.max(CRUZEIRO, alvo.y + 12);
  if (Math.abs(p.y - cruz) > 1) rota.push({ x: p.x, y: cruz, z: p.z });   // desce (ou sobe) até o cruzeiro, por fora da ilha
  rota.push({ x: alvo.x, y: cruz, z: alvo.z });
  rota.push(alvo);
  return rota;
}

/** distância a partir da qual se SOLTA o botão (a nave freia e chega no ponto) */
export const SOLTA_H = VOO.vel / VOO.freio, SOLTA_V = VOO.sobe / VOO.freio;

/**
 * Um quadro do piloto automático: as entradas dos botões (direção em MUNDO, subir, descer) pro waypoint atual e a
 * rota restante. `pousado` vem do passo anterior do voo. Termina (`chegou`) quando pousa no último ponto.
 */
export function seguirRota(s: EstadoVoo, rota: Waypoint[], pousado: boolean): { cmd: ComandoVoo; rota: Waypoint[]; chegou: boolean } {
  const parado: ComandoVoo = { wx: 0, wz: 0, subir: false, descer: false };
  let r = rota;
  for (let guarda = 0; guarda < 8 && r.length; guarda++) {
    const w = r[0]!, dx = w.x - s.x, dz = w.z - s.z, dh = Math.hypot(dx, dz), dy = w.y - s.y;
    if (w.pousar) {
      if (dh > 1.5 && !pousado) return { cmd: { wx: dh > SOLTA_H * 0.6 ? dx / dh : 0, wz: dh > SOLTA_H * 0.6 ? dz / dh : 0, subir: false, descer: dh <= SOLTA_H * 2 }, rota: r, chegou: false };
      if (pousado) { r = r.slice(1); if (!r.length) return { cmd: parado, rota: r, chegou: true }; continue; }
      return { cmd: { ...parado, descer: true }, rota: r, chegou: false };
    }
    const horiz = dh > SOLTA_H, vert = Math.abs(dy) > SOLTA_V;
    if (!horiz && !vert) { r = r.slice(1); continue; }   // chegou nesse ponto: segue pro próximo
    return { cmd: { wx: horiz ? dx / dh : 0, wz: horiz ? dz / dh : 0, subir: vert && dy > 0, descer: vert && dy < 0 }, rota: r, chegou: false };
  }
  return { cmd: parado, rota: r, chegou: !r.length };
}
