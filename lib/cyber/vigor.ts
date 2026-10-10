/**
 * Cyberespaço — o VIGOR (PURO): a barra de fôlego do HUD (pedido do dono, out/2026: no lugar dos botões de ação, as
 * barras de SAÚDE, VIGOR e do uso de IA). Correr (o sprint) gasta aos poucos, o DASH custa um pedaço de uma vez; parado
 * de esforço, recupera depois de um respiro. Esvaziou: EXAUSTO — não corre nem dá dash até voltar a `volta`. O jato da
 * mochila NÃO gasta (sem vigor no ar a pessoa despencaria da ilha).
 */
export const VIGOR = {
  /** quanto o sprint gasta por segundo (≈9 s de corrida com a barra cheia) */
  corrida: 0.11,
  /** quanto um dash custa */
  dash: 0.22,
  /** quanto recupera por segundo, depois de `espera` s sem esforço */
  recupera: 0.24, espera: 0.8,
  /** exausto: só volta a correr/dar dash com isso de vigor */
  volta: 0.25,
} as const;
export type EstadoVigor = { v: number; exausto: boolean; /** último esforço (s, relógio do jogo) */ esforcoEm: number };
export const vigorCheio = (): EstadoVigor => ({ v: 1, exausto: false, esforcoEm: -1e9 });

/** um passo: `correndo` = está gastando com o sprint agora */
export function passoVigor(s: EstadoVigor, correndo: boolean, dt: number, agora: number): EstadoVigor {
  let { v, exausto, esforcoEm } = s;
  if (correndo && !exausto) { v = Math.max(0, v - VIGOR.corrida * dt); esforcoEm = agora; if (v <= 0) exausto = true; }
  else if (agora - esforcoEm >= VIGOR.espera) v = Math.min(1, v + VIGOR.recupera * dt);
  if (exausto && v >= VIGOR.volta) exausto = false;
  return { v, exausto, esforcoEm };
}
/** pode correr agora? */
export const podeCorrer = (s: EstadoVigor) => !s.exausto && s.v > 0;
/** gasta um dash (null = sem vigor pra isso) */
export function gastarDash(s: EstadoVigor, agora: number): EstadoVigor | null {
  if (s.exausto || s.v < VIGOR.dash) return null;
  const v = s.v - VIGOR.dash;
  return { v, exausto: v <= 0.001, esforcoEm: agora };
}
