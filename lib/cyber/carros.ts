/**
 * Cyberespaço — a FROTA DE CARROS VOADORES (PURO). O carro (components/cyber/CarroHex) era UM só, na praça; agora a
 * Zaeon tem ESTACIONAMENTOS na plataforma central, no anel vazio entre as cabines de estudo e a borda (r ≈ 160–228 m —
 * conferido contra os colisores da cidade), e o da praça continua. Cada vaga tem a sua COR (o laranja original girado no
 * matiz). Os carros da Zaeon apontam o NARIZ pra borda: entra-se e decola-se pro céu aberto.
 *
 * Referencial dos lotes: polar no local da ilha (`ang` = atan2(z, x), `r` = distância do centro); as vagas correm em
 * FILAS tangentes ao anel, a 1ª fila mais pra dentro.
 */
import { CIDADE, mundo } from "./ceu";

export type CorCarro = { matiz: number; sat?: number; luz?: number };
/** as cores da frota (o 1º = o laranja original) */
export const CORES_CARRO: readonly CorCarro[] = [
  { matiz: 0 },                          // laranja/vermelho (o original)
  { matiz: 0.55 },                       // azul
  { matiz: 0.3, sat: -0.05 },            // verde
  { matiz: 0.75 },                       // roxo
  { matiz: 0.88 },                       // rosa
  { matiz: 0.45 },                       // ciano
  { matiz: 0.08, luz: 0.05 },            // amarelo
  { matiz: 0, sat: -1, luz: 0.25 },      // prata
];

/** um ESTACIONAMENTO de carros na Zaeon: no anel (`ang`, `r`), `filas` × `porFila`, `passo` (m) entre vagas e
 *  `entreFilas` (m) entre filas */
export type LoteCarro = { nome: string; ang: number; r: number; filas: number; porFila: number; passo: number; entreFilas: number };
export const LOTES_CARRO: readonly LoteCarro[] = [
  // LESTE: entre a escada do jardim (ang 0) e a doca da nave (ang ≈ 0,8–2,7)
  { nome: "leste", ang: 0.42, r: 188, filas: 2, porFila: 4, passo: 4.6, entreFilas: 8 },
  // (o OESTE — a cópia do leste, entre a escada do lounge e a da garagem — saiu: out/2026, o dono, "retire os repetidos")
];
/** os CARROS na Zaeon (out/2026, o dono: "a cidadela não precisa ficar com os veículos — pra pesar ainda menos", nos
 *  dois modos): desligados. O lote continua no layout (é perto dele que se chega no hub, voltando de uma sala) */
export const CARROS_NA_ZAEON = false as boolean;
/** o carro da PRAÇA (o 1º que existiu — no chão, perto das motos) */
export const CARRO_PRACA = { x: -22, z: -132, rumo: 2.01 } as const;

/** uma vaga no MUNDO: posição, rumo (o yaw do carro: +z do carro = a frente) e se é na Zaeon (o piso é o da ilha) */
export type VagaCarro = { id: string; x: number; z: number; rumo: number; zaeon: boolean; cor: CorCarro };

/** o centro (local) da vaga `i` da fila `f` de um lote, e o rumo (o nariz pra fora, pra borda) */
export function vagaDoLote(l: LoteCarro, f: number, i: number): { x: number; z: number; rumo: number } {
  const ra = { x: Math.cos(l.ang), z: Math.sin(l.ang) }, tg = { x: -ra.z, z: ra.x };
  const r = l.r + (f - (l.filas - 1) / 2) * l.entreFilas, t = (i - (l.porFila - 1) / 2) * l.passo;
  return { x: ra.x * r + tg.x * t, z: ra.z * r + tg.z * t, rumo: Math.atan2(ra.x, ra.z) };
}

/** todas as vagas (mundo): a da praça + as dos lotes da Zaeon, cada uma com a sua cor (determinístico) */
export function vagasDeCarro(): VagaCarro[] {
  const out: VagaCarro[] = [{ id: "praca", x: CARRO_PRACA.x, z: CARRO_PRACA.z, rumo: CARRO_PRACA.rumo, zaeon: false, cor: CORES_CARRO[0]! }];
  for (const l of CARROS_NA_ZAEON ? LOTES_CARRO : []) for (let f = 0; f < l.filas; f++) for (let i = 0; i < l.porFila; i++) {
    const v = vagaDoLote(l, f, i), w = mundo(v);
    out.push({ id: `${l.nome}-${f}-${i}`, x: w.x, z: w.z, rumo: v.rumo, zaeon: true, cor: CORES_CARRO[(out.length) % CORES_CARRO.length]! });
  }
  return out;
}

/** o tamanho (m) de um lote — o piso desenhado (components/cyber/Cidade) */
export const tamanhoDoLoteCarro = (l: LoteCarro) => ({ larg: l.porFila * l.passo + 2, prof: l.filas * l.entreFilas + 2 });

/** a altura do PISO onde o carro da vaga pousa: a praça (chão) ou o piso da ilha da Zaeon */
export const pisoDaVaga = (v: VagaCarro, chao: number, ilhaY: number = CIDADE.pisoY) => (v.zaeon ? ilhaY : chao);

// ───────────── ONLINE: quem está com cada carro (pela presença — como as motos, lib/cyber/motos) ─────────────
/** quantos carros existem (o índice `c` = a posição em `vagasDeCarro()` — igual em todo cliente) */
export const TOTAL_CARROS = vagasDeCarro().length;
/** dirigindo o carro `c`: a altura e o rumo (a posição x/z é a da própria pessoa na presença) */
export type CarroDirigido = { c: number; y: number; yaw: number };
/** o carro `c` que a pessoa DEIXOU estacionado fora da vaga (fica lá até alguém pegar ou ela sair do jogo) */
export type CarroLargado = { c: number; x: number; y: number; z: number; yaw: number };

const fin = (v: unknown, min: number, max: number): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null);
const indiceCarro = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < TOTAL_CARROS ? v : null);
/** saneia `carro` da presença (lixo → nada) */
export function carroDe(v: unknown): { carro?: CarroDirigido } {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>, c = indiceCarro(o.c), y = fin(o.y, -100, 800), yaw = fin(o.yaw, -10, 10);
  return c === null || y === null || yaw === null ? {} : { carro: { c, y, yaw } };
}
/** saneia `carroLargado` da presença (lixo → nada) */
export function carroLargadoDe(v: unknown): { carroLargado?: CarroLargado } {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>, c = indiceCarro(o.c), x = fin(o.x, -1540, 1540), y = fin(o.y, -100, 800), z = fin(o.z, -1540, 1540), yaw = fin(o.yaw, -10, 10);
  return c === null || x === null || y === null || z === null || yaw === null ? {} : { carroLargado: { c, x, y, z, yaw } };
}

/** alguém no mundo (`id`) e o que anuncia sobre carros */
export type DonoDeCarro = { id: string; carro?: CarroDirigido | null; carroLargado?: CarroLargado | null };
/** com quem está cada carro: DIRIGINDO vale mais que estacionado; dois no mesmo carro → o de menor id (todo cliente
 *  decide igual); um estacionado que alguém está dirigindo não conta mais. Carro fora do mapa = na vaga dele */
export type PosseCarro = { dono: string; dirige: true; y: number; yaw: number } | { dono: string; dirige: false; m: CarroLargado };
export function posseDosCarros(lista: readonly DonoDeCarro[]): Map<number, PosseCarro> {
  const out = new Map<number, PosseCarro>(), ord = [...lista].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const d of ord) if (d.carro && !out.has(d.carro.c)) out.set(d.carro.c, { dono: d.id, dirige: true, y: d.carro.y, yaw: d.carro.yaw });
  for (const d of ord) if (d.carroLargado && !out.has(d.carroLargado.c)) out.set(d.carroLargado.c, { dono: d.id, dirige: false, m: d.carroLargado });
  return out;
}
