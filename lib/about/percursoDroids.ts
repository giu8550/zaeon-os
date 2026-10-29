/**
 * O PERCURSO dos droids no fundo do "Sobre nós" (out/2026, o dono: "nossos droids passeando em cima do lounge, perto da
 * pirâmide, e depois nos caminhos da esquerda, do centro e da direita — estilo cutscene, mas como fundo"). PURO: os
 * pontos por onde a curva fechada passa, no referencial da SALA do lounge (lib/cyber/temploCosmico — y = 0 no pátio do
 * lounge; o salão fica 14 m abaixo). Quem desenha (components/about/cenaFundoDroids) espelha tudo como o jogo: o lounge
 * fica à ESQUERDA de quem está no salão e o Rasta à DIREITA.
 */
import { CAMPUS, PIRAMIDE, PONTE_LOUNGE, RASTA, SALAO, TORRE_TI, ESTUDO, ESP } from "@/lib/cyber/temploCosmico";

export type Ponto = { x: number; y: number; z: number };
export type Trecho = "piramide" | "esquerda" | "centro" | "direita";
export type Parada = Ponto & { trecho: Trecho };

const yS = -SALAO.desce;   // o piso do salão
const P = PIRAMIDE, E = ESTUDO, ED = ESP(ESTUDO), B = PONTE_LOUNGE.b, T = TORRE_TI, R = RASTA;

/** a curva (fechada: do último volta pro primeiro) */
export const PARADAS: readonly Parada[] = [
  // 1. o SALÃO: chegam pela frente e dão a volta na pirâmide, baixo, olhando o monumento
  { x: SALAO.x, y: yS + 7, z: SALAO.z + 38, trecho: "piramide" },
  { x: P.x + 22, y: yS + 9, z: P.z + 6, trecho: "piramide" },
  { x: P.x + 6, y: yS + 13, z: P.z - 22, trecho: "piramide" },
  { x: P.x - 20, y: yS + 11, z: P.z - 8, trecho: "piramide" },
  // 2. a ESQUERDA: o lounge de estudos, a ponte subindo e um laço por cima do lounge
  { x: (P.x + E.x) / 2, y: yS + 12, z: E.z + 10, trecho: "esquerda" },
  { x: E.x, y: yS + 26, z: E.z, trecho: "esquerda" },
  { x: B.x, y: 9, z: B.z, trecho: "esquerda" },
  { x: -10, y: 12, z: 24, trecho: "esquerda" },
  { x: 22, y: 14, z: -16, trecho: "esquerda" },
  { x: -34, y: 10, z: -40, trecho: "esquerda" },
  // 3. o CENTRO: de volta pelo salão e o CAMINHO DO MEIO (o campus), subindo do lado da torre de TI
  { x: SALAO.x + 16, y: yS + 18, z: SALAO.z - 46, trecho: "centro" },
  { x: SALAO.x + 18, y: yS + 30, z: (SALAO.z + CAMPUS.zFim) / 2, trecho: "centro" },
  { x: SALAO.x + 10, y: yS + 40, z: CAMPUS.zFim + 30, trecho: "centro" },
  { x: T.x + T.baseR + 6, y: 40, z: T.z + 6, trecho: "centro" },
  { x: T.x + 20, y: 66, z: T.z - T.baseR - 8, trecho: "centro" },
  { x: T.x - T.baseR - 10, y: 52, z: T.z - 10, trecho: "centro" },
  // 4. a DIREITA: por cima do campus até o Rasta, uma volta nele e o retorno pelo lounge de estudos da direita
  { x: SALAO.x - 70, y: 26, z: SALAO.z - 120, trecho: "direita" },
  { x: R.x + 34, y: 16, z: R.z - 44, trecho: "direita" },
  { x: R.x - 30, y: 18, z: R.z - 20, trecho: "direita" },
  { x: R.x - 20, y: 14, z: R.z + 40, trecho: "direita" },
  { x: ED.x, y: yS + 24, z: ED.z + 4, trecho: "direita" },
  { x: SALAO.x - 26, y: yS + 9, z: SALAO.z + 30, trecho: "direita" },
];

/** quanto tempo uma volta inteira leva (s) — devagar, como um passeio */
export const VOLTA_S = 150;
