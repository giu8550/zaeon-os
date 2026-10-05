/**
 * Cyberespaço — a CIDADE ZAEON no céu (QG do dono), acima do buraco negro. PURO, sem three.
 * Conceito das cidades flutuantes (estilo Avatar): uma ilha monumental + ilhotas em volta. Não há caminho físico
 * até lá: o BURACO NEGRO é o PORTAL (clicar nele ou pisar no anel embaixo dele) e um portal de volta na cidade leva
 * de novo à praça. Entrar é AÇÃO PRIVILEGIADA (validada no servidor): o QG é do dono.
 *
 * Coordenadas: `centro` no plano (x,z) do mundo; tudo que é "local" é relativo ao centro (sem giro).
 */
import { empurrarParaFora, type Colisor, type P2 } from "./colisao";

/** buraco negro (CenaCosmica): centro e raio do horizonte */
export const BURACO_NEGRO = { x: 0, y: 16, z: -110, r: 6 };

export const CIDADE = {
  centro: { x: BURACO_NEGRO.x, z: BURACO_NEGRO.z },
  pisoY: 190,           // piso da cidade: BEM acima do buraco negro (y=16) — flutuando nas alturas
  bordaR: 40,           // borda da ilha principal
  andavelR: 34,         // até onde se anda (as muralhas ficam em 37)
  muralhaR: 37,
  ilhaAltura: 34,       // a ilha (cone invertido) vai do piso até pisoY - ilhaAltura
  cidadela: { r: 14, pilares: 12, pilarColR: 1.1 },              // cúpula = SALA DE COMPUTADORES
  computadores: { n: 16, r: 8, colR: 0.9 },                      // estações em anel, viradas pro centro
  mesaHolo: { r: 2.4 },
  hangar: { x: 22, z: 8, r: 6 },                                 // plataforma da nave (local)
  portalVolta: { x: -21, z: 10, r: 2.2 },                        // anel de volta pra praça (local)
  chegada: { x: -16, z: 14 },                                    // onde se aparece ao entrar (local)
  /** anel de entrada no CHÃO, embaixo do buraco negro (mundo) */
  portalEntrada: { x: BURACO_NEGRO.x, z: BURACO_NEGRO.z, r: 9 },
} as const;

export const mundo = (l: P2): P2 => ({ x: CIDADE.centro.x + l.x, z: CIDADE.centro.z + l.z });

/** posições (locais) das estações de computador: anel virado pro centro, com uma abertura de passagem */
export function computadoresLocais(): { x: number; z: number; rot: number }[] {
  const { n, r } = CIDADE.computadores, out: { x: number; z: number; rot: number }[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, rot: Math.atan2(-Math.cos(a), -Math.sin(a)) }); }
  return out;
}

/** colisores da plataforma (mundo): pilares da cidadela, estações, mesa holográfica */
export function colisoresDaCidade(): Colisor[] {
  const out: Colisor[] = [];
  const { cidadela, computadores, mesaHolo } = CIDADE;
  for (let i = 0; i < cidadela.pilares; i++) { const a = (i / cidadela.pilares) * Math.PI * 2; out.push({ ...mundo({ x: Math.cos(a) * cidadela.r, z: Math.sin(a) * cidadela.r }), r: cidadela.pilarColR }); }
  for (const c of computadoresLocais()) out.push({ ...mundo(c), r: computadores.colR });
  out.push({ ...mundo({ x: 0, z: 0 }), r: mesaHolo.r });
  return out;
}

/** passo andando na cidade: colisores sólidos e não cai da borda */
export function resolverCidade(prop: P2): P2 {
  let q = empurrarParaFora(prop, colisoresDaCidade());
  const c = CIDADE.centro, dx = q.x - c.x, dz = q.z - c.z, d = Math.hypot(dx, dz);
  if (d > CIDADE.andavelR) q = { x: c.x + (dx / d) * CIDADE.andavelR, z: c.z + (dz / d) * CIDADE.andavelR };
  return q;
}

export const dentroDe = (p: P2, alvo: { x: number; z: number; r: number }) => Math.hypot(p.x - alvo.x, p.z - alvo.z) <= alvo.r;
/** pisou no anel de entrada (chão, embaixo do buraco negro)? */
export const noPortalEntrada = (p: P2) => dentroDe(p, CIDADE.portalEntrada);
/** na cidade, pisou no portal de volta? */
export const noPortalVolta = (p: P2) => dentroDe(p, { ...mundo(CIDADE.portalVolta), r: CIDADE.portalVolta.r });
/** estação de computador mais próxima (índice) dentro de `alcance`, ou -1 */
export function computadorPerto(p: P2, alcance = 2.6): number {
  let melhor = -1, md = alcance;
  computadoresLocais().forEach((c, i) => { const w = mundo(c), d = Math.hypot(p.x - w.x, p.z - w.z); if (d < md) { md = d; melhor = i; } });
  return melhor;
}

/** volume sólido da ilha (pra NAVE): cilindro aproximado [pisoY - ilhaAltura, pisoY + 6] × bordaR */
export function foraDaIlha(p: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const c = CIDADE.centro, dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
  const base = CIDADE.pisoY - CIDADE.ilhaAltura, topo = CIDADE.pisoY;
  if (d > CIDADE.bordaR || p.y < base || p.y > topo) return p;
  // dentro do volume: sai pelo lado mais perto (cima = pousa no piso; baixo; ou radialmente)
  const paraCima = topo - p.y, paraBaixo = p.y - base, paraFora = CIDADE.bordaR - d;
  if (paraCima <= paraBaixo && paraCima <= paraFora) return { ...p, y: topo };
  if (paraBaixo <= paraFora) return { ...p, y: base };
  const k = d > 1e-4 ? CIDADE.bordaR / d : 1;
  return { x: c.x + (d > 1e-4 ? dx * k : CIDADE.bordaR), y: p.y, z: c.z + (d > 1e-4 ? dz * k : 0) };
}

/** o chão sob a nave: piso da cidade se está sobre ela (e acima do piso), senão o chão do mapa */
export function chaoDaNave(p: { x: number; y: number; z: number }): number {
  const c = CIDADE.centro;
  return Math.hypot(p.x - c.x, p.z - c.z) <= CIDADE.andavelR && p.y >= CIDADE.pisoY - 0.5 ? CIDADE.pisoY : 0;
}
