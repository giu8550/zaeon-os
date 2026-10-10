/**
 * Cyberespaço — as ETAPAS do carregamento (PURO): o engine monta o mundo em etapas, cedendo a vez pro navegador entre
 * elas (a tela não congela) e avisando a tela de loading do que está carregando. NADA aparece antes de tudo estar
 * pronto: corpos, mundo, sons decodificados, imagens, shaders compilados e o primeiro quadro desenhado.
 * O `peso` é o quanto cada etapa ocupa da barra (≈ o tempo que ela leva).
 */
import { UNIVERSIDADES_NO_MAPA } from "./plataformas";

const TODAS_ETAPAS = [
  { id: "corpo", rotulo: "Despertando os corpos dos avatares", peso: 7 },
  { id: "hiperespaco", rotulo: "Abrindo o hiperespaço", peso: 3 },
  { id: "praca", rotulo: "Erguendo a praça das bases", peso: 3 },
  { id: "mirantes", rotulo: "Levantando a Recepção e os Mirantes da Terra", peso: 5 },
  { id: "terra", rotulo: "Baixando a imagem da Terra (NASA)", peso: 3 },
  { id: "veias", rotulo: "Crescendo as veias da Zaeon", peso: 5 },
  { id: "zaeon", rotulo: "Construindo a cidade Zaeon", peso: 16 },
  { id: "univ", rotulo: "Montando a UNILAB", peso: 5 },
  { id: "campi", rotulo: "Montando os campi (UFC, UNIFOR, UECE)", peso: 7 },
  { id: "solana", rotulo: "Montando a Solana House", peso: 3 },
  { id: "nave", rotulo: "Atracando a Nave-QG", peso: 3 },
  { id: "motos", rotulo: "Estacionando as motos voadoras", peso: 6 },
  { id: "sons", rotulo: "Afinando os sons do cyberespaço", peso: 10 },
  { id: "pessoas", rotulo: "Chamando quem está na sala", peso: 4 },
  { id: "shaders", rotulo: "Compilando a luz (shaders)", peso: 10 },
  { id: "quadro", rotulo: "Desenhando o primeiro quadro", peso: 3 },
] as const;
export type IdEtapa = (typeof TODAS_ETAPAS)[number]["id"];
/** as etapas que de fato rodam (sem universidades no mapa, a UNILAB e os campi não montam) */
export const ETAPAS: readonly (typeof TODAS_ETAPAS)[number][] = TODAS_ETAPAS.filter((e) => UNIVERSIDADES_NO_MAPA || (e.id !== "univ" && e.id !== "campi"));
export type Carregando = { etapa: IdEtapa; rotulo: string; /** 0..1 da barra inteira */ progresso: number; /** detalhe opcional ("23/41 sons") */ detalhe?: string };

const TOTAL = ETAPAS.reduce((s, e) => s + e.peso, 0);
/** a barra (0..1) estando na etapa `id`, `dentro` (0..1) dela */
export function progressoDe(id: IdEtapa, dentro = 0): number {
  let antes = 0;
  for (const e of ETAPAS) { if (e.id === id) return Math.min(1, (antes + e.peso * Math.max(0, Math.min(1, dentro))) / TOTAL); antes += e.peso; }
  return 1;
}
export const carregando = (id: IdEtapa, dentro = 0, detalhe?: string): Carregando => ({ etapa: id, rotulo: TODAS_ETAPAS.find((e) => e.id === id)!.rotulo, progresso: progressoDe(id, dentro), detalhe });

/** as dicas que passam na tela de loading (rodando) */
export const DICAS = [
  "W A S D anda · ESPAÇO voa · F faz a ação do lugar.",
  "Os telões dos Mirantes mostram a Terra AO VIVO: terremotos, incêndios e tempestades reais.",
  "Na capela, o coração da Zaeon bate — o raio azul corre pelas veias até a borda.",
  "Pegue uma moto no estacionamento: F monta, P pousa.",
  "Os buracos negros levam pras universidades, pra Solana House e pra praça.",
  "Na sua base, F abre a sua Sala de Estudos.",
] as const;
