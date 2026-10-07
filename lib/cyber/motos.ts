/**
 * Cyberespaço — MOTOS VOADORAS (PURO). Dois ESTACIONAMENTOS: um no chão, perto da praça, e outro na ZAEON (a ilha no
 * céu, aberta pra todos). As motos são pra QUALQUER pessoa (a nave é do dono). Mesmo controle da nave (direção
 * relativa à câmera, subir/descer, pousa ao encostar, no chão não anda de lado — tem que decolar), outro modelo e
 * outra pose (montado). Dá pra ir de moto do chão até a Zaeon e voltar.
 *  - presença: quem está montado manda `moto: { s: vaga, y, yaw }` — os outros veem a moto e escondem a da vaga;
 *  - descer da moto: ela VOLTA pra vaga (o estacionamento fica igual pra todo mundo, sem estado no servidor).
 */
import { CIDADE, mundo } from "./ceu";
import { VOO } from "./voo";

export type Lote = { id: "chao" | "zaeon"; x: number; z: number; rot: number; ceu: boolean };
/** vagas por estacionamento, distância entre elas (m) e o raio do piso (as bases do chão desviam dele) */
export const ESTACIONAMENTO = { n: 4, espacamento: 3.4, r: 10 } as const;
/** a frente das vagas aponta pro centro (a praça, no chão; o centro da ilha, na Zaeon) */
const lote = (id: Lote["id"], x: number, z: number, cx: number, cz: number, ceu: boolean): Lote => ({ id, x, z, rot: Math.atan2(cx - x, cz - z), ceu });
const ZAEON_LOCAL = { x: -30, z: -30 };   // entre as torres da muralha, longe da doca da nave, do lounge, do portal e das bases
export const LOTES: Lote[] = [
  lote("chao", -50, 22, 0, 0, false),
  lote("zaeon", mundo(ZAEON_LOCAL).x, mundo(ZAEON_LOCAL).z, CIDADE.centro.x, CIDADE.centro.z, true),
];
/** o lote da Zaeon no referencial da ilha (o piso desenhado dentro dela, flutuando junto) */
export const LOTE_ZAEON_LOCAL = { ...ZAEON_LOCAL, rot: Math.atan2(-ZAEON_LOCAL.x, -ZAEON_LOCAL.z) };
export const TOTAL_VAGAS = LOTES.length * ESTACIONAMENTO.n;

/** a moto é modelada em ~1:1 e escalada no render pra proporção do avatar (~2 m) */
export const ESCALA_MOTO = 1.25;

export const MOTO = {
  /** teto do voo de moto: o mesmo da nave (a Zaeon é aberta — dá pra subir até lá de moto) */
  teto: VOO.yMax,
  /** altura do QUADRIL do piloto sentado, JÁ na escala do render (o topo do banco fica em ~1,05 × ESCALA_MOTO) */
  banco: 1.14 * 1.25,
  /** quão perto pra montar (m, no plano) */
  alcance: 3.2,
} as const;

export type Vaga = { x: number; z: number; yaw: number; ceu: boolean };
/** posição (mundo) e rumo de cada vaga — enfileiradas de lado, viradas pro centro; índice = lote × n + i. Constante:
 *  calculada uma vez (o engine pergunta várias vezes por quadro) e congelada (ninguém mexe sem querer). */
let vagasCache: readonly Readonly<Vaga>[] | null = null;
export function vagas(): readonly Readonly<Vaga>[] {
  return (vagasCache ??= Object.freeze(calcularVagas().map((v) => Object.freeze(v))));
}
function calcularVagas(): Vaga[] {
  const e = ESTACIONAMENTO;
  return LOTES.flatMap((l) => {
    const c = Math.cos(l.rot), s = Math.sin(l.rot);
    return Array.from({ length: e.n }, (_, i) => {
      const lx = (i - (e.n - 1) / 2) * e.espacamento;   // ao longo da fila (perpendicular à frente)
      return { x: l.x + lx * c, z: l.z - lx * s, yaw: l.rot, ceu: l.ceu };
    });
  });
}

/** a vaga LIVRE mais perto de `p` (no alcance, no MESMO nível: chão ou Zaeon), ou -1 */
export function motoPerto(p: { x: number; z: number }, ocupadas: Set<number>, ceu = false): number {
  let melhor = -1, md: number = MOTO.alcance;
  vagas().forEach((v, i) => { if (ocupadas.has(i) || v.ceu !== ceu) return; const d = Math.hypot(p.x - v.x, p.z - v.z); if (d < md) { md = d; melhor = i; } });
  return melhor;
}

/** a moto na presença: vaga inteira válida, altura/rumo finitos e com teto; lixo → nada */
export function motoDe(v: unknown): { moto?: { s: number; y: number; yaw: number } } {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  const s = typeof o.s === "number" && Number.isInteger(o.s) && o.s >= 0 && o.s < TOTAL_VAGAS ? o.s : null;
  const y = typeof o.y === "number" && Number.isFinite(o.y) ? Math.min(MOTO.teto, Math.max(0, o.y)) : null;
  const yaw = typeof o.yaw === "number" && Number.isFinite(o.yaw) ? Math.min(10, Math.max(-10, o.yaw)) : null;
  return s === null || y === null || yaw === null ? {} : { moto: { s, y, yaw } };
}
