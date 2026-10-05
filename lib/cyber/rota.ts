/**
 * Cyberespaço — ATALHOS de rota da nave ("Heliporto", "QG do Andrei" e "Zaeon"). PURO. Não é teletransporte: o piloto
 * automático gera as MESMAS entradas dos botões de movimento (direção, subir, descer), então a nave voa à vista de
 * todos pelo caminho. Qualquer botão de movimento cancela (no engine). A rota contorna a ilha da cidade (sai pela
 * borda, do lado do destino) e cruza o mapa numa altitude livre (acima do QG, abaixo do fundo da ilha da Zaeon).
 */
import { CIDADE, mundo } from "./ceu";
import { HELIPORTO } from "./landmarks";
import { VOO, type ComandoVoo, type EstadoVoo } from "./voo";

export type DestinoRota = "heliporto" | "qg" | "zaeon";
export type Waypoint = { x: number; y: number; z: number; pousar?: boolean };

/** altitude de cruzeiro no chão: acima da cúpula do QG (~26 m), bem abaixo do fundo da ilha da Zaeon (~156 m) */
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

/** onde cada atalho pousa: no heliporto (chão) ou no ponto de pouso do QG (`qg`, sobre as muralhas do lado do portão) */
export function alvoDoAtalho(destino: DestinoRota, qg?: { x: number; y: number; z: number }): Waypoint | null {
  if (destino === "heliporto") return { x: HELIPORTO.x, y: 0, z: HELIPORTO.z, pousar: true };
  if (destino === "zaeon") { const h = mundo(CIDADE.hangar); return { x: h.x, y: CIDADE.pisoY, z: h.z, pousar: true }; }
  return qg ? { ...qg, pousar: true } : null;
}

/** ponto de pouso do QG: sobre as muralhas, do lado do portão (fora da cúpula) — sair da nave ali = salão do QG */
export function pousoDoQG(m: { x: number; z: number; dir: number; muralhaR: number }, topoMuralhas: number): { x: number; y: number; z: number } {
  const r = m.muralhaR - 1;
  return { x: m.x + Math.cos(m.dir) * r, y: topoMuralhas, z: m.z + Math.sin(m.dir) * r };
}

/** a rota (waypoints) da posição atual até pousar no destino */
export function rotaPara(destino: DestinoRota, s: EstadoVoo, qg?: { x: number; y: number; z: number }): Waypoint[] {
  const alvo = alvoDoAtalho(destino, qg); if (!alvo) return [];
  const rota: Waypoint[] = [];
  const altoCidade = CIDADE.pisoY + ACIMA_DA_CIDADE, naCidade = s.y >= CIDADE.pisoY - 0.5 && daCidade(s) <= CIDADE.bordaR + 2;
  const naColuna = daCidade(s) < CIDADE.bordaR + 2;
  let p = { x: s.x, y: s.y, z: s.z };
  if (destino === "zaeon") {
    // pro hangar da Zaeon (céu): embaixo da ilha, decola e sai pela lateral; sobe POR FORA; entra pela borda do lado do hangar
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
