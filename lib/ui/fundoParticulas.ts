/**
 * Lógica pura do fundo de partículas (globo → serpente → DNA) usado pelo `StarBackground`.
 *
 * Por que existe (bugs corrigidos):
 *  - A landing montava TRÊS canvases de tela cheia com a mesma animação (ParticleSystem +
 *    StarBackground do hero + StarBackground das salas), cada um com o seu ciclo de fases
 *    defasado. As "explosões" e trocas de brilho de um caíam no meio do outro → luz piscando.
 *    Agora só UMA instância desenha por vez (`donoDoFundo`).
 *  - O tempo andava por QUADRO (`timer++`): num monitor de 144 Hz tudo corria 2,4× mais
 *    rápido (pulso mais rápido), num PC fraco a 20 FPS tudo arrastava. Agora tudo anda por
 *    tempo real, normalizado pra 60 FPS (`passoNormalizado`).
 *  - Aparelho fraco recebe menos partículas e teto de 30 FPS (`perfilDoAparelho`), e o
 *    fundo se ajusta sozinho se o FPS cair (`ajustarQualidade`).
 */

/** Duração de um quadro de referência (60 FPS). As constantes abaixo são "em quadros a 60". */
export const QUADRO_MS = 1000 / 60;

/** Passo de tempo em "quadros de 60 FPS". Limitado pra a aba que volta do segundo plano não dar salto. */
export function passoNormalizado(dtMs: number): number {
  if (!Number.isFinite(dtMs) || dtMs <= 0) return 0;
  return Math.min(dtMs / QUADRO_MS, 3);
}

/** Interpolação exponencial independente de FPS: `base` é a fração por quadro a 60 FPS. */
export function fatorLerp(base: number, passo: number): number {
  return 1 - Math.pow(1 - base, passo);
}

// Fases: 0 Globo · 1 Desintegração · 2 Serpente · 3 DNA · 4 DNA "aquecido" · 5 Desintegração
export type Fase = 0 | 1 | 2 | 3 | 4 | 5;
export const DURACAO_FASE: Record<Fase, number> = { 0: 800, 1: 60, 2: 900, 3: 1800, 4: 600, 5: 100 };

export interface Relogio { fase: Fase; timer: number }

export function avancarFase(r: Relogio, passo: number): Relogio {
  let { fase, timer } = r;
  timer += passo;
  if (timer > DURACAO_FASE[fase]) {
    timer = 0;
    fase = ((fase + 1) % 6) as Fase;
  }
  return { fase, timer };
}

/** O ciclo SEM o globo (landing v3): serpente → DNA → DNA aquecido → desintegração → serpente… A fase 2
 *  acende em rampa a partir do zero da desintegração, então pular o globo não cria flash. */
export function avancarFaseSemGlobo(r: Relogio, passo: number): Relogio {
  const n = avancarFase(r, passo);
  return n.fase === 0 || n.fase === 1 ? { fase: 2, timer: 0 } : n;
}

/** Quadros pra as partículas reaparecerem depois de uma desintegração (evita o "flash" de volta). */
export const FADE_ENTRADA = 45;
const ALPHA_BASE = 0.8;

/**
 * Opacidade de TODAS as partículas na fase (uniforme por quadro → dá pra desenhar em lote).
 * Desintegração apaga até zero DENTRO da própria fase; a fase seguinte acende em rampa.
 */
export function alphaDaFase(r: Relogio): number {
  const { fase, timer } = r;
  if (fase === 1 || fase === 5) return ALPHA_BASE * Math.max(0, 1 - timer / DURACAO_FASE[fase]);
  if (fase === 0 || fase === 2) return ALPHA_BASE * Math.min(1, timer / FADE_ENTRADA);
  return ALPHA_BASE;
}

export interface PerfilAparelho {
  particulas: number;
  /** intervalo mínimo entre quadros (0 = sem teto, segue o monitor). */
  intervaloMinMs: number;
  /** teto do devicePixelRatio do canvas. */
  dprMax: number;
}

/** Quanto o aparelho aguenta, pelos sinais que o navegador dá (núcleos, memória, largura da tela). É o FUNDO: leve
 *  em qualquer máquina — teto de 30 FPS (o movimento é lento, não precisa de 60) e canvas em 1x (pontos pequenos não
 *  ganham nada com retina), e no máximo 900 partículas (eram 2000). */
export const FPS_FUNDO = 30;
export function perfilDoAparelho(sinais: { nucleos?: number; memoriaGb?: number; largura: number }): PerfilAparelho {
  const nucleos = sinais.nucleos ?? 4;
  const memoria = sinais.memoriaGb ?? 4;
  const fraco = nucleos <= 4 || memoria <= 4 || sinais.largura < 768;
  const base = { intervaloMinMs: 1000 / FPS_FUNDO, dprMax: 1 };
  if (fraco) return { particulas: 350, ...base };
  if (nucleos <= 8) return { particulas: 650, ...base };
  return { particulas: 900, ...base };
}

/**
 * Escala de perspectiva do globo. ANTES: `300 / (300 - z)` com câmera FIXA em 300 px — numa tela
 * com altura > ~940 px (todo monitor 1080p) o raio do globo passa de 300, então partículas
 * girando perto de z≈300 viravam DISCOS GIGANTES (escala de centenas/milhares) que cobriam a
 * tela e piscavam a cada volta: a "luz pulsante". Agora a câmera fica a 3 raios do centro,
 * proporcional ao globo, e a escala é limitada.
 */
export const ESCALA_MIN = 0.5, ESCALA_MAX = 1.6;
export function escalaPerspectiva(z: number, raio: number): number {
  const camera = Math.max(1, raio) * 3;
  const e = camera / (camera - z);
  return Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, e));
}

export const PARTICULAS_MIN = 300;

/**
 * Ajuste automático: se a média do passo indica que o aparelho não está dando o FPS esperado (< ~35 FPS sem teto;
 * < ~22 FPS com o teto de 30 — `passoEsperado` = o passo do teto, em quadros de 60), corta as partículas pela
 * metade (até o mínimo). Nunca aumenta de volta — evita ficar oscilando.
 */
export function ajustarQualidade(ativas: number, mediaPasso: number, passoEsperado = 1): number {
  if (mediaPasso > Math.max(1.7, passoEsperado * 1.35) && ativas > PARTICULAS_MIN) return Math.max(PARTICULAS_MIN, Math.floor(ativas / 2));
  return ativas;
}

/**
 * Dono único do fundo: várias instâncias do componente podem estar montadas ao mesmo tempo
 * (hero + seção de salas na landing), mas só a primeira desenha. Quando ela desmonta, a
 * próxima da fila assume.
 */
export function criarDono() {
  const fila: symbol[] = [];
  const ouvintes = new Set<() => void>();
  const avisar = () => ouvintes.forEach((f) => f());
  return {
    entrar(id: symbol) { if (!fila.includes(id)) { fila.push(id); avisar(); } },
    sair(id: symbol) { const i = fila.indexOf(id); if (i >= 0) { fila.splice(i, 1); avisar(); } },
    ehDono(id: symbol) { return fila[0] === id; },
    ouvir(f: () => void) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
  };
}

export const donoDoFundo = criarDono();
