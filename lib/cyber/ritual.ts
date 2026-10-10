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
  /** o instante (ms, servidor) em que o dono TIROU O VÉU da nave (o evento, perto das nuvens); 0 = a nave invisível */
  veu: number;
  /** o RITUAL DA NAVE (tecla K): a nave toca a música dela e gera a mandala, as nuvens e os trovões em volta, em escala
   *  menor (menos partículas) — por ela mesma, onde estiver */
  nave: boolean;
};
export const RITUAL_OFF: Ritual = { tempestade: 0, droids: false, veu: 0, nave: false };
export const ritualDesligado = (r: Ritual | null | undefined) => !r || (r.tempestade <= 0 && !r.droids && r.veu <= 0 && !r.nave);

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
  const ms = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  return { tempestade: ms(o.tempestade), droids: o.droids === true, veu: ms(o.veu), nave: o.nave === true };
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

/** o CORTE DA MÚSICA do lounge pelos raios (o dono, out/2026): o ritual usa os raios que já estão no lounge como
 *  mensageiros — um acerta a caixa da ESQUERDA e cala aquele lado, outro (um pouco depois) acerta a da DIREITA e cala
 *  o outro; depois a música do lounge para de vez e só se ouve a que sai da NAVE do dono. Segundos desde o começo */
export const CORTE = { esquerda: ENERGIZA_S, direita: ENERGIZA_S + 1.7, total: ENERGIZA_S + 3.6 } as const;
export type Corte = { esquerda: boolean; direita: boolean; total: boolean };
/** o que já foi cortado no instante `agora` (ms, servidor) */
export function corteDasCaixas(r: Ritual | null | undefined, agora: number): Corte {
  if (!r || r.tempestade <= 0) return { esquerda: false, direita: false, total: false };
  const s = (agora - r.tempestade) / 1000;
  if (s > MAX_MS / 1000) return { esquerda: false, direita: false, total: false };
  return { esquerda: s >= CORTE.esquerda, direita: s >= CORTE.direita, total: s >= CORTE.total };
}

/** a NAVE do dono é INVISÍVEL (só o formato e os propulsores). Chegando no PERÍMETRO das NUVENS da capela em cima do
 *  lounge (o ritual ligado), o dono ESCOLHE tirar o véu — um evento (`ritual.veu`): um vento a revela inteira, e ela
 *  fica revelada até o ritual acabar. `d` = a distância (m) da nave ao centro das nuvens; `perimetro` = até onde o
 *  evento pode ser disparado; `veu` = quanto o véu leva pra sair (s) */
export const REVELACAO = { perimetro: 220, veu: 1.6 } as const;
/** a nave está no perímetro das nuvens (dá pra tirar o véu)? */
export const noPerimetro = (r: Ritual | null | undefined, d: number) => !!r && r.tempestade > 0 && d <= REVELACAO.perimetro;
/** o véu saindo: 0 (invisível) → 1 (inteira) em `veu` s desde o evento (`agora` ms, servidor); sem ritual/sem evento, 0 */
export function revelacaoDaNave(r: Ritual | null | undefined, agora: number): number {
  if (!r || r.tempestade <= 0 || r.veu <= 0) return 0;
  const k = Math.max(0, Math.min(1, (agora - r.veu) / 1000 / REVELACAO.veu));
  return k * k * (3 - 2 * k);
}

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
