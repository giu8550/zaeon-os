/**
 * Cyberespaço — a ÁGUA (PURO): o recurso mais VITAL do jogo (pedido do dono, out/2026 — no lugar do vigor). Correr (o
 * sprint) e o VOO TURBO (Shift no ar) gastam água, o dash custa um gole de uma vez. Ela volta DEVAGAR com a pessoa
 * parada e RÁPIDO perto das FONTES (o espelho d'água do jardim e o coração da capela — o globo com as veias azuis).
 * Hidratado, a VIDA se recupera aos poucos; com SEDE (a água zerou), a vida cai até a pessoa beber. Seco: não corre,
 * não dá dash nem turbo até voltar a `volta`.
 */
import type { P2 } from "./colisao";

export const AGUA = {
  /** quanto o sprint gasta por segundo (≈20 s de corrida com a barra cheia) */
  corrida: 0.05,
  /** quanto o voo turbo gasta por segundo (≈28 s de turbo) */
  turbo: 0.035,
  /** um dash */
  dash: 0.12,
  /** parado de esforço: recupera devagar depois de `espera` s */
  recupera: 0.03, espera: 2,
  /** numa FONTE: enche rápido */
  fonte: 0.4,
  /** seco: só volta a correr/turbo/dash com isso de água */
  volta: 0.15,
  /** com SEDE (zerou): a vida cai por segundo */
  sede: 3,
  /** hidratado (acima de `hidratado`): a vida volta por segundo */
  hidratado: 0.25, cura: 1.5,
} as const;
export type EstadoAgua = { v: number; seco: boolean; esforcoEm: number };
export const aguaCheia = (): EstadoAgua => ({ v: 1, seco: false, esforcoEm: -1e9 });

/** um passo: gastando (sprint, turbo) ou recuperando (parado; numa fonte, rápido) */
export function passoAgua(s: EstadoAgua, o: { correndo: boolean; turbo: boolean; naFonte: boolean }, dt: number, agora: number): EstadoAgua {
  let { v, seco, esforcoEm } = s;
  const gasto = (o.correndo ? AGUA.corrida : 0) + (o.turbo ? AGUA.turbo : 0);
  if (gasto > 0 && !seco) { v = Math.max(0, v - gasto * dt); esforcoEm = agora; if (v <= 0) seco = true; }
  if (o.naFonte) v = Math.min(1, v + AGUA.fonte * dt);
  else if (gasto === 0 && agora - esforcoEm >= AGUA.espera) v = Math.min(1, v + AGUA.recupera * dt);
  if (seco && v >= AGUA.volta) seco = false;
  return { v, seco, esforcoEm };
}
/** pode correr / usar o turbo agora? */
export const podeEsforcar = (s: EstadoAgua) => !s.seco && s.v > 0;
/** gasta um dash (null = sem água pra isso) */
export function gastarDashAgua(s: EstadoAgua, agora: number): EstadoAgua | null {
  if (s.seco || s.v < AGUA.dash) return null;
  const v = s.v - AGUA.dash;
  return { v, seco: v <= 0.001, esforcoEm: agora };
}
/** o efeito da água na VIDA por segundo: negativo com sede, positivo hidratado (0 no meio) */
export const efeitoNaVida = (s: EstadoAgua) => (s.v <= 0 ? -AGUA.sede : s.v >= AGUA.hidratado ? AGUA.cura : 0);

/** as FONTES de água (local da ilha + a altura acima do piso dela) */
export type Fonte = P2 & { r: number; y: number; nome: string };
export function naFonte(fontes: Fonte[], p: P2, altAcimaDaIlha: number): Fonte | null {
  for (const f of fontes) if (Math.hypot(p.x - f.x, p.z - f.z) <= f.r && Math.abs(altAcimaDaIlha - f.y) <= 6) return f;
  return null;
}
