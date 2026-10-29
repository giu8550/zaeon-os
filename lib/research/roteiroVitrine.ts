/**
 * O ROTEIRO da Zaeon na VITRINE do hero da landing (out/2026, o dono: "uma animação que use as poses que ela faz
 * durante as conversas — quando pensa, analisa, pesquisa, gera um output, alimenta a árvore — mas aqui encaixando
 * BLUEPRINTS que representam entregáveis: foguete, motor, PCB, fontes, bateria, energia solar… pode demorar mais de
 * 22 s: ela gera, depois descansa e continua gerando"). PURO: dado há quanto tempo a vitrine está rodando, em que FASE
 * ela está, qual ENTREGÁVEL está saindo e o `gerandoHa` que as sequências da conversa (lib/research/sequenciaAvatar)
 * esperam — as mesmas cenas do chat, reaproveitadas:
 *  1. PENSAR    — os olhos acendem (a sequência "pensar");
 *  2. PESQUISAR — as telas em volta + a aranha raspando, e depois a energia com os raios ("raspar" → "energia");
 *  3. GERAR     — o BLUEPRINT do entregável se desenha traço a traço na frente dela (components/research/blueprints);
 *  4. ALIMENTAR — o blueprint vira um nó e a ÁRVORE de habilidades cresce (a sequência "arvore");
 *  5. DESCANSAR — os idles e os gestos leves dela, olhando pra quem chega (o cursor) — e recomeça com o próximo.
 */
import { DURACAO, NIVEL } from "./sequenciaAvatar";

export const ENTREGAVEIS = [
  { id: "foguete", nome: "Foguete" },
  { id: "motor", nome: "Motor a jato" },
  { id: "pcb", nome: "Placa PCB" },
  { id: "fonte", nome: "Fonte de alimentação" },
  { id: "bateria", nome: "Bateria" },
  { id: "solar", nome: "Painel solar" },
] as const;
export type IdEntregavel = (typeof ENTREGAVEIS)[number]["id"];

export type FaseVitrine = "pensar" | "pesquisar" | "gerar" | "alimentar" | "descansar";
/** quanto dura cada fase (s) — um ciclo (um entregável) ≈ 27 s; a volta pelos seis ≈ 2 min 40 s */
export const FASES: readonly (readonly [FaseVitrine, number])[] = [
  ["pensar", NIVEL.raspar],
  ["pesquisar", 6.6],
  ["gerar", 7.5],
  ["alimentar", DURACAO.arvore],
  ["descansar", 6],
];
export const CICLO = FASES.reduce((s, [, d]) => s + d, 0);

export type MomentoVitrine = {
  fase: FaseVitrine;
  /** o progresso na fase (0..1) */
  u: number;
  /** o número do ciclo (cresce sem parar) e o entregável dele */
  ciclo: number;
  entregavel: IdEntregavel;
  /** pras sequências da conversa: s "desde que a resposta começou" (null = nenhuma cena da conversa agora) */
  gerandoHa: number | null;
};

/** `t` = s desde que a vitrine começou → a fase, o progresso nela, o entregável e o `gerandoHa` das sequências */
export function momentoVitrine(t: number): MomentoVitrine {
  const tt = t > 0 ? t : 0;
  const ciclo = Math.floor(tt / CICLO);
  let r = tt - ciclo * CICLO;
  const entregavel = ENTREGAVEIS[ciclo % ENTREGAVEIS.length]!.id;
  for (const [fase, d] of FASES) {
    if (r < d) {
      const u = r / d;
      // o tempo que as sequências da conversa entendem: pensar e pesquisar são o começo de uma resposta (pensar →
      // raspar → energia); alimentar é o bloco da árvore no laço longo; gerar e descansar não usam cena da conversa
      const gerandoHa =
        fase === "pensar" ? r
        : fase === "pesquisar" ? NIVEL.raspar + r
        : fase === "alimentar" ? NIVEL.holo + Math.min(r, d - 0.001)
        : null;
      return { fase, u, ciclo, entregavel, gerandoHa };
    }
    r -= d;
  }
  return { fase: "descansar", u: 1, ciclo, entregavel, gerandoHa: null };
}
