/**
 * Cyberespaço — ATALHOS de rota da nave ("⬇ Chão", "⬆ Cidade", "Zaeon"). PURO. Não é teletransporte: o piloto
 * automático gera as MESMAS entradas dos botões de movimento (direção, subir, descer), então a nave voa à vista de
 * todos pelo caminho. Qualquer botão de movimento cancela (no engine). A rota contorna a ilha da cidade (sai pela
 * borda, do lado do destino) e cruza o mapa numa altitude livre (acima da Zaeon, abaixo do fundo da ilha).
 */
import { CIDADE, mundo } from "./ceu";
import { HELIPORTO } from "./landmarks";
import { VOO, type ComandoVoo, type EstadoVoo } from "./voo";

export type DestinoRota = "chao" | "cidade" | "zaeon";
export type Waypoint = { x: number; y: number; z: number; pousar?: boolean };

/** altitude de cruzeiro no chão: acima da cúpula da Zaeon (~26 m), bem abaixo do fundo da ilha (~156 m) */
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

/** onde cada atalho pousa: heliporto (chão), hangar (Cidade) ou a cúpula da Zaeon (topo do dono) */
export function alvoDoAtalho(destino: DestinoRota, zaeon?: { x: number; z: number; topo: number }): Waypoint | null {
  if (destino === "chao") return { x: HELIPORTO.x, y: 0, z: HELIPORTO.z, pousar: true };
  if (destino === "cidade") { const h = mundo(CIDADE.hangar); return { x: h.x, y: CIDADE.pisoY, z: h.z, pousar: true }; }
  return zaeon ? { x: zaeon.x, y: zaeon.topo, z: zaeon.z, pousar: true } : null;
}

/** a rota (waypoints) da posição atual até pousar no destino */
export function rotaPara(destino: DestinoRota, s: EstadoVoo, zaeon?: { x: number; z: number; topo: number }): Waypoint[] {
  const alvo = alvoDoAtalho(destino, zaeon); if (!alvo) return [];
  const rota: Waypoint[] = [];
  const altoCidade = CIDADE.pisoY + ACIMA_DA_CIDADE, naCidade = s.y >= CIDADE.pisoY - 0.5 && daCidade(s) <= CIDADE.bordaR + 2;
  const naColuna = daCidade(s) < CIDADE.bordaR + 2;
  let p = { x: s.x, y: s.y, z: s.z };
  if (destino === "cidade") {
    if (!naCidade) {
      // embaixo da ilha: sai pela lateral (do lado do hangar) antes de subir
      const sai = saidaDaIlha(alvo, Math.max(p.y, 3));
      if (naColuna) { rota.push(sai); p = sai; }
      rota.push({ x: p.x, y: altoCidade, z: p.z });                 // sobe por fora da ilha
      const borda = saidaDaIlha(alvo, altoCidade);
      rota.push(borda);                                              // chega pela borda do lado do hangar
    } else if (p.y < altoCidade - 1) rota.push({ x: p.x, y: altoCidade, z: p.z });
    rota.push({ x: alvo.x, y: altoCidade, z: alvo.z });
    rota.push(alvo);
    return rota;
  }
  // chão / Zaeon: se estiver na Cidade (ou embaixo dela), sai pela borda do lado do destino
  if (naCidade) {
    if (p.y < altoCidade - 1) { rota.push({ x: p.x, y: altoCidade, z: p.z }); p = { ...p, y: altoCidade }; }
    const sai = saidaDaIlha(alvo, altoCidade); rota.push(sai); p = sai;
  } else if (naColuna && p.y < CIDADE.pisoY) {
    const sai = saidaDaIlha(alvo, Math.max(p.y, 3)); rota.push(sai); p = sai;
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
