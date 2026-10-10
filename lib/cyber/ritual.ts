/**
 * Cyberespaço — o RITUAL da chegada do dono (PURO, sem three nem rede). O dono liga o ritual na "call" dentro da nave
 * (o buraco negro da sala de reuniões — o que antes o levava direto pra cabine do DJ). Ligado, todo mundo na sala vê:
 *  - a TEMPESTADE se formando em ~8 s em cima da capela do templo (as nuvens, depois os raios pegando a ponta);
 *  - no fim da formação, o 1º trovão ENERGIZA as caixas do lounge: a música cala um instante e o som do raio sai do
 *    buraco negro em cima da cabine do DJ; daí em diante, todo raio em cima da capela tem som;
 *  - os ANUNCIADORES (droids ofanim) saem da nave e ficam rodeando cada pessoa no mapa, louvando o dono em voz alta.
 * O estado mora no conteúdo da sala (lib/lounge3d/tipos `ritual`) e chega por evento (EV_RITUAL) — quem entra depois
 * pega o mesmo instante `tempestade` (relógio do servidor) e calcula a mesma fase. Acaba quando o dono CHEGA no lounge
 * (o cliente dele desliga) — ou sozinho, depois de `MAX_MS`.
 */
import type { P2 } from "./colisao";

export type Ritual = {
  /** o instante (relógio do servidor, ms) em que a tempestade começou a se formar; 0 = desligada */
  tempestade: number;
  /** os anunciadores estão soltos pelo mapa? */
  droids: boolean;
};
export const RITUAL_OFF: Ritual = { tempestade: 0, droids: false };
export const ritualDesligado = (r: Ritual | null | undefined) => !r || (r.tempestade <= 0 && !r.droids);

/** a FORMAÇÃO das nuvens (s) — "cerca de 8 segundos"; os raios começam no meio dela; `ENERGIZA_S` = o 1º trovão que
 *  energiza as caixas do lounge (o som sai do buraco negro em cima da cabine do DJ) */
export const FORMACAO_S = 8, RAIOS_DESDE_S = 4, ENERGIZA_S = 8.6;
/** por segurança, a tempestade se apaga sozinha depois disso (o dono esqueceu ligada) */
export const MAX_MS = 3 * 3600 * 1000;
/** quanto tempo o apagar leva (s): as nuvens se desmancham devagar quando o dono chega */
export const DESMANCHA_S = 12;

export function sanitizarRitual(v: unknown): Ritual {
  if (!v || typeof v !== "object") return RITUAL_OFF;
  const o = v as Record<string, unknown>;
  const t = typeof o.tempestade === "number" && Number.isFinite(o.tempestade) && o.tempestade > 0 ? Math.floor(o.tempestade) : 0;
  return { tempestade: t, droids: o.droids === true };
}

/** a INTENSIDADE da tempestade (0..1) no instante `agora` (relógio do servidor, ms): sobe em `FORMACAO_S`, fica em 1,
 *  some depois de `MAX_MS` */
export function intensidadeDaTempestade(r: Ritual | null | undefined, agora: number): number {
  if (!r || r.tempestade <= 0) return 0;
  const s = (agora - r.tempestade) / 1000;
  if (s < 0 || s > MAX_MS / 1000) return 0;
  const k = Math.min(1, s / FORMACAO_S);
  return k * k * (3 - 2 * k);
}
export type FaseRitual = "off" | "formando" | "raios" | "armada";
/** a fase da tempestade: formando (só nuvens) → raios (sem som, ainda) → armada (energizou: todo raio tem som) */
export function faseDaTempestade(r: Ritual | null | undefined, agora: number): FaseRitual {
  if (!r || r.tempestade <= 0) return "off";
  const s = (agora - r.tempestade) / 1000;
  if (s < 0 || s > MAX_MS / 1000) return "off";
  if (s < RAIOS_DESDE_S) return "formando";
  if (s < ENERGIZA_S) return "raios";
  return "armada";
}
/** o instante (ms, servidor) em que o 1º trovão energiza as caixas */
export const instanteDaEnergia = (r: Ritual) => r.tempestade + ENERGIZA_S * 1000;

// ───────────── os ANUNCIADORES ─────────────
/** cada pessoa no mapa ganha UM anunciador: um droid (ofanim) rodeando a cabeça dela — `altura` acima dos pés, no raio
 *  `raio`, dando uma volta a cada `volta` s; a fala (o louvor) sai a cada `fala` s (mín–máx), cada droid no seu tempo */
export const ANUNCIADOR = { altura: 3.2, raio: 1.7, volta: 7, fala: [7, 13] as const, escala: 0.75 } as const;
/** o que os anunciadores dizem (o pedido do dono) */
export const FRASE_LOUVOR = "Louvado seja o Senhor Jesus Cristo";
/** onde o anunciador `k` (índice estável de quem ele rodeia) está no instante `t` (s), em volta de `alvo` */
export function posDoAnunciador(k: number, t: number, alvo: { x: number; y: number; z: number }): { x: number; y: number; z: number; rumo: number } {
  const fase = k * 2.399, a = fase + (t / ANUNCIADOR.volta) * Math.PI * 2 * (k % 2 ? -1 : 1);
  const x = alvo.x + Math.cos(a) * ANUNCIADOR.raio, z = alvo.z + Math.sin(a) * ANUNCIADOR.raio;
  return { x, y: alvo.y + ANUNCIADOR.altura + 0.25 * Math.sin(t * 1.3 + fase), z, rumo: Math.atan2(alvo.x - x, alvo.z - z) };
}
/** o próximo instante de fala do anunciador `k` depois de `t` (s): um intervalo de `fala` (mín–máx), determinístico
 *  pela semente (k, t) */
export function proximaFala(k: number, t: number): number {
  const [a, b] = ANUNCIADOR.fala;
  let x = ((k + 1) * 9301 + Math.floor(t * 10) * 49297) >>> 0;
  x = (x * 1103515245 + 12345) % 2147483648;
  return t + a + (x / 2147483648) * (b - a);
}

// ───────────── o modo TURBO da nave ─────────────
/** a nave em turbo (Shift, como correr a pé): `fator` × a velocidade de cruzeiro, com uma rampa de `rampa` s */
export const TURBO_NAVE = { fator: 2.6, rampa: 0.9 } as const;
/** a sensação de velocidade na tela (0..1) pilotando: só em turbo, pela velocidade real no plano */
export function sensacaoDaNave(vel: number, turbo: number): number {
  const base = 30;   // (VOO.vel) — abaixo disso, nada
  return Math.max(0, Math.min(1, ((vel - base) / (base * (TURBO_NAVE.fator - 1))) * 0.85)) * turbo;
}

/** a chegada do dono: o ritual acaba quando ele pisa NO LOUNGE (a pé) — `noLounge` vem do engine */
export const chegou = (fundador: boolean, noLounge: boolean, r: Ritual | null | undefined) => fundador && noLounge && !!r && r.tempestade > 0;

/** um ponto (mundo) onde um anunciador "nasce" ao sair da nave: a porta de trás dela */
export const nascimentoDoAnunciador = (porta: P2, y: number) => ({ x: porta.x, y: y + 2, z: porta.z });
