/**
 * Cyberespaço — HUD de VOO da nave. PURO, sem three nem DOM: o que mostrar pra quem pilota com os botões de
 * movimento — altímetro ("sobre o quê"), dica contextual (por que não desce / não sobe) e os indicadores dos
 * destinos na borda da tela (pra achar o caminho pra qualquer lugar do mapa).
 */
import { CIDADE, mundo } from "./ceu";
import { HELIPORTO } from "./landmarks";
import type { Pilar } from "./voo";

type P3 = { x: number; y: number; z: number };
const daCidade = (p: { x: number; z: number }) => Math.hypot(p.x - CIDADE.centro.x, p.z - CIDADE.centro.z);

export type Sobre = "cidade" | "zaeon" | "chao";
/** sobre o que a nave está (pro altímetro) */
export function sobreOQue(p: P3, zaeon: Pilar[] = []): Sobre {
  if (daCidade(p) <= CIDADE.bordaR && p.y >= CIDADE.pisoY - 0.5) return "cidade";
  const corpo = zaeon[0];
  if (corpo && Math.hypot(p.x - corpo.x, p.z - corpo.z) < corpo.r && p.y >= corpo.topo - 0.5) return "zaeon";
  return "chao";
}
export const ROTULO_SOBRE: Record<Sobre, string> = { cidade: "sobre a Cidade", zaeon: "sobre a Zaeon", chao: "sobre o chão" };

/**
 * Dica de quem segura um botão e "não acontece nada": DESCER pousada em cima da Cidade (ou da Zaeon) — tem que sair
 * pela borda; SUBIR travada embaixo da ilha — tem que sair pela lateral. Sem dica: null.
 */
export function dicaDeVoo(o: { s: P3; subir: boolean; descer: boolean; pousado: boolean; zaeon?: Pilar[] }): string | null {
  const { s } = o, base = CIDADE.pisoY - CIDADE.ilhaAltura, sob = sobreOQue(s, o.zaeon);
  if (o.descer && o.pousado && sob === "cidade") return "Saia pela borda da ilha pra descer até o chão";
  if (o.descer && o.pousado && sob === "zaeon") return "Saia pela lateral da Zaeon pra descer até o chão";
  if (o.subir && daCidade(s) < CIDADE.bordaR && s.y <= base + 0.5 && s.y > 1) return "A ilha está em cima — saia pela lateral pra subir";
  return null;
}

export type Destino = { id: string; nome: string; x: number; y: number; z: number };
/** destinos principais do mapa (o indicador mostra nome + distância) */
export function destinosDeVoo(o: { zaeon?: { x: number; z: number; y: number }; minhaBase?: { x: number; z: number } } = {}): Destino[] {
  const h = mundo(CIDADE.hangar);
  const out: Destino[] = [
    { id: "praca", nome: "Praça", x: 0, y: 0, z: 0 },
    { id: "heliporto", nome: "Heliporto", x: HELIPORTO.x, y: 0, z: HELIPORTO.z },
    { id: "cidade", nome: "Cidade", x: h.x, y: CIDADE.pisoY, z: h.z },
  ];
  if (o.zaeon) out.push({ id: "zaeon", nome: "Zaeon", ...o.zaeon });
  if (o.minhaBase) out.push({ id: "base", nome: "Minha base", x: o.minhaBase.x, y: 0, z: o.minhaBase.z });
  return out;
}

/**
 * Onde desenhar o indicador: no próprio alvo se ele está na tela; senão preso na moldura (com `margem`; embaixo,
 * `baixo` reserva o espaço dos botões de movimento), na direção dele. `ndc` = posição projetada (-1..1),
 * `atras` = o alvo está atrás da câmera (a projeção vem espelhada).
 */
export function indicadorNaBorda(ndc: { x: number; y: number }, atras: boolean, w: number, h: number, margem = 36, baixo = margem): { x: number; y: number; naBorda: boolean; ang: number } {
  let nx = ndc.x, ny = ndc.y;
  if (atras) { nx = -nx; ny = -ny; }
  const cx = w / 2, cy = h / 2, bx0 = margem, bx1 = w - margem, by0 = margem, by1 = Math.max(cy + 1, h - baixo);
  let px = cx + nx * cx, py = cy - ny * cy;
  if (!atras && px >= bx0 && px <= bx1 && py >= by0 && py <= by1) return { x: px, y: py, naBorda: false, ang: 0 };
  // direção a partir do centro, escalada até encostar na moldura
  const dx = px - cx, dy = Math.abs(px - cx) < 1e-6 && Math.abs(py - cy) < 1e-6 ? 1 : py - cy;   // bem atrás: aponta pra baixo
  const kx = dx > 0 ? (bx1 - cx) / dx : dx < 0 ? (bx0 - cx) / dx : Infinity;
  const ky = dy > 0 ? (by1 - cy) / dy : dy < 0 ? (by0 - cy) / dy : Infinity;
  const k = Math.min(kx, ky);
  px = cx + dx * k; py = cy + dy * k;
  return { x: px, y: py, naBorda: true, ang: Math.atan2(dy, dx) };
}

/** afasta rótulos que se sobrepõem (larg × alt px): quem vem depois sobe (ou desce, se estiver na metade de cima) */
export function separarIndicadores<T extends { x: number; y: number }>(ps: T[], h: number, larg = 130, alt = 24): T[] {
  const out: T[] = [];
  for (const p of ps) {
    const q = { ...p }, passo = q.y < h / 2 ? alt : -alt;
    for (let i = 0; i < ps.length && out.some((o) => Math.abs(o.x - q.x) < larg && Math.abs(o.y - q.y) < alt); i++) q.y += passo;
    out.push(q);
  }
  return out;
}

/** distância legível ("34 m", "1,2 km") */
export const distTexto = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);
