/**
 * Cyberespaço — o RITUAL do dono (PURO, sem three nem rede). O dono liga o ritual na "call" dentro da nave (o buraco
 * negro da sala de reuniões). Reformulado a pedido do dono (out/2026) — o ritual agora é:
 *  - FUMAÇA E TROVÕES (a "tempestade"): as nuvens se formam em ~8 s em CINCO lugares — o topo da capela da cidadela, o
 *    topo das duas salas de estudo (biblioteca e jardim), o topo do lounge e o topo do templo em cima do lounge —, os
 *    raios caem e cada um TROVEJA com som pra quem está por perto (na nave também). Nada de cortar a música do lounge
 *    nem de raio queimando caixa;
 *  - os ANUNCIADORES (agora só 2 efeitos, que seguem a MÚSICA do lounge): o lounge fica ESCURO com pausas de luz neon na
 *    batida (balada), e a ESCADARIA em curva vai ficando cada vez mais VERMELHA, com mais raios e mais fumaça na torre do
 *    templo em cima do lounge.
 * O ritual NUNCA acaba sozinho: só pelo botão (toggle) — e acaba DEVAGAR, as nuvens se desmanchando (`DESMANCHA_S`).
 * O estado mora no conteúdo da sala (lib/lounge3d/tipos `ritual`) e chega por evento (EV_RITUAL) — quem entra depois
 * pega o mesmo instante `tempestade` (relógio do servidor) e calcula a mesma fase.
 */
export type Ritual = {
  /** o instante (relógio do servidor, ms) em que a tempestade começou a se formar; 0 = desligada */
  tempestade: number;
  /** os ANUNCIADORES estão ligados? (os 2 efeitos da música: a balada escura no lounge e a escadaria vermelha) */
  droids: boolean;
  /** o instante (ms, servidor) em que o dono TIROU O VÉU da nave (o evento, perto das nuvens); 0 = a nave invisível */
  veu: number;
  /** o RITUAL DA NAVE (tecla K): a nave toca a música dela e gera a mandala, as nuvens e os trovões em volta, em escala
   *  menor (menos partículas) — por ela mesma, onde estiver */
  nave: boolean;
};
export const RITUAL_OFF: Ritual = { tempestade: 0, droids: false, veu: 0, nave: false };
export const ritualDesligado = (r: Ritual | null | undefined) => !r || (r.tempestade <= 0 && !r.droids && r.veu <= 0 && !r.nave);

/** a FORMAÇÃO da fumaça (s) — "cerca de 8 segundos"; os raios (com trovão) começam no meio dela; `ENERGIZA_S` = a
 *  tempestade formada por inteiro */
export const FORMACAO_S = 8, RAIOS_DESDE_S = 4, ENERGIZA_S = 8.6;
/** quanto tempo o apagar leva (s): desligado no botão, a fumaça se desmancha devagar e os efeitos somem aos poucos */
export const DESMANCHA_S = 12;

export function sanitizarRitual(v: unknown): Ritual {
  if (!v || typeof v !== "object") return RITUAL_OFF;
  const o = v as Record<string, unknown>;
  const ms = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  return { tempestade: ms(o.tempestade), droids: o.droids === true, veu: ms(o.veu), nave: o.nave === true };
}

/** a INTENSIDADE da tempestade (0..1) no instante `agora` (relógio do servidor, ms): sobe em `FORMACAO_S` e fica em 1
 *  (não acaba sozinha) */
export function intensidadeDaTempestade(r: Ritual | null | undefined, agora: number): number {
  if (!r || r.tempestade <= 0) return 0;
  const s = (agora - r.tempestade) / 1000;
  if (s < 0) return 0;
  const k = Math.min(1, s / FORMACAO_S);
  return k * k * (3 - 2 * k);
}
export type FaseRitual = "off" | "formando" | "raios" | "armada";
/** a fase da tempestade: formando (só fumaça) → raios (caindo, com trovão) → armada (formada por inteiro) */
export function faseDaTempestade(r: Ritual | null | undefined, agora: number): FaseRitual {
  if (!r || r.tempestade <= 0) return "off";
  const s = (agora - r.tempestade) / 1000;
  if (s < 0) return "off";
  if (s < RAIOS_DESDE_S) return "formando";
  if (s < ENERGIZA_S) return "raios";
  return "armada";
}
/** o instante (ms, servidor) em que a tempestade fica formada por inteiro */
export const instanteDaEnergia = (r: Ritual) => r.tempestade + ENERGIZA_S * 1000;

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

// ───────────── o APAGAR devagar ─────────────
/** a intensidade MOSTRADA (0..1) indo atrás da do ritual: subindo, acompanha (a formação já é suave); descendo (o dono
 *  desligou), cai devagar — some em `DESMANCHA_S` s */
export function suavizarRitual(atual: number, alvo: number, dt: number): number {
  if (alvo >= atual) return alvo;
  return Math.max(alvo, atual - dt / DESMANCHA_S);
}

// ───────────── os ANUNCIADORES (os 2 efeitos da música) ─────────────
/** a BALADA no lounge, como numa festa de verdade (o dono, out/2026): o lounge fica ESCURO e, na batida, as LUZES
 *  ACENDEM de vez por um instante — o estouro de luz neon (`segura` s no máximo) — e APAGAM de novo (`decai`). Com
 *  música os estouros vêm na batida; sem ela, de tempos em tempos. `escuro` = o véu na tela de quem está DENTRO do
 *  lounge; `brilho` = o quanto o estouro clareia por cima da cena */
export const BALADA = { escuro: 0.88, segura: 0.12, decai: 10, brilho: 0.42, semMusica: [2.2, 4.5] as const } as const;
/** a LUZ do estouro (0..1) `desde` s depois dele: acesa no máximo por `segura`, e apagando rápido */
export const luzDoFlash = (desde: number) => (desde < 0 ? 0 : desde <= BALADA.segura ? 1 : Math.exp(-(desde - BALADA.segura) * BALADA.decai));
/** a opacidade do véu escuro: `liga` (0..1, o efeito ligado e suavizado) × o escuro — o estouro de luz o tira inteiro */
export const escuroDaBalada = (liga: number, luz: number) => Math.max(0, liga * BALADA.escuro * (1 - Math.max(0, Math.min(1, luz))));
/** o quanto o estouro CLAREIA a cena (a luz neon acesa por cima, somada) */
export const brilhoDaBalada = (liga: number, luz: number) => Math.max(0, liga * BALADA.brilho * Math.max(0, Math.min(1, luz)));
/** a cor neon de cada flash (gira entre magenta, ciano, violeta e verde-limão — um por batida) */
export const NEON = [0xff2bd6, 0x22e6ff, 0x9b5cff, 0xb6ff3a] as const;
export const corDoFlash = (batida: number) => NEON[((batida % NEON.length) + NEON.length) % NEON.length]!;

/** a ESCADARIA em curva reagindo à música: `vermelho` (0..1) SOBE enquanto a música toca (e um pouco a cada batida) e
 *  desce devagar quando ela para — com o vermelho vêm mais raios e mais fumaça na torre do templo */
export const ESCADARIA_VERMELHA = { sobe: 1 / 90, porBatida: 0.012, desce: 1 / 45 } as const;
export function passoDaEscadaria(v: number, dt: number, tocando: boolean, batida: boolean): number {
  const n = tocando ? v + dt * ESCADARIA_VERMELHA.sobe + (batida ? ESCADARIA_VERMELHA.porBatida : 0) : v - dt * ESCADARIA_VERMELHA.desce;
  return Math.max(0, Math.min(1, n));
}
/** a chance de um RAIO cair na torre do templo numa batida, e a FUMAÇA (intensidade das nuvens) lá, pelo vermelho */
export const raioNaBatida = (vermelho: number) => 0.12 + 0.7 * vermelho;
export const fumacaDaTorre = (vermelho: number) => 0.35 + 0.65 * vermelho;

// ───────────── o modo TURBO da nave ─────────────
/** a nave em turbo (Shift, como correr a pé): `fator` × a velocidade de cruzeiro, com uma rampa de `rampa` s */
export const TURBO_NAVE = { fator: 2.6, rampa: 0.9 } as const;
/** a sensação de velocidade na tela (0..1) pilotando: só em turbo, pela velocidade real no plano */
export function sensacaoDaNave(vel: number, turbo: number): number {
  const base = 30;   // (VOO.vel) — abaixo disso, nada
  return Math.max(0, Math.min(1, ((vel - base) / (base * (TURBO_NAVE.fator - 1))) * 0.85)) * turbo;
}
