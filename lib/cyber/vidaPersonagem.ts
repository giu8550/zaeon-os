/**
 * Cyberespaço — a VIDA PRÓPRIA dos personagens na cidadela Zaeon (PURO, sem three nem rede). É o "harness" de
 * comportamento: sem conversa (ainda), só o personagem vivendo como gente — trabalha num desktop da capela
 * (interagindo com a tela, como os jogadores na base), e depois sai: passeia pela praça, anda de moto em volta da
 * ilha, dança no lounge, fica olhando um telão, sobe num mirante e medita… e volta a trabalhar.
 *
 * A AGENDA é uma função do RELÓGIO (segundos desde uma época fixa) e de uma semente: todo cliente calcula a mesma
 * agenda e vê o personagem no mesmo lugar, fazendo a mesma coisa — sem servidor, sem rede (como os droids
 * observadores). Cada BLOCO = andar até um lugar (a rota a pé de lib/cyber/caminhos) + ficar lá fazendo a atividade.
 * A sequência é aleatória (semente por bloco), sem repetir a atividade nem o lugar, com o trabalho voltando sempre.
 * Coordenadas LOCAIS da ilha; a altura é acima do piso da ilha.
 */
import { aleatorioComSemente } from "./audio";
import { CIDADE, alturaNaCidade, computadoresLocais, mundo, rumoDaPista } from "./ceu";
import { MIRANTES, TELOES } from "./terra";
import { POIS, marcoNav } from "./landmarks";
import { alturaEm, deEscada } from "./nav";
import { pontoNaRota, rotaAPe, comprimento } from "./caminhos";
import type { P2 } from "./colisao";

export type Atividade = "trabalhar" | "passear" | "moto" | "dancar" | "observar" | "meditar";
/** um lugar da agenda: onde ela CHEGA andando (`pos`, local) e pra onde fica virada (`rumo`, facing) */
export type Lugar = { id: string; atividade: Atividade; pos: P2; rumo: number; mirante?: number };

/** a velocidade a pé (m/s) — calma (o jogador anda a 4) */
export const VEL_A_PE = 3;
/** a época da agenda (s, UTC): 1º/out/2026 */
export const EPOCA = Date.UTC(2026, 9, 1) / 1000;

/** quanto tempo ela fica em cada atividade (s, mín–máx) e o peso do sorteio */
export const ATIVIDADES: Record<Atividade, { fica: readonly [number, number]; peso: number }> = {
  trabalhar: { fica: [180, 360], peso: 3 },
  passear: { fica: [25, 60], peso: 2 },
  moto: { fica: [70, 100], peso: 1.2 },
  dancar: { fica: [90, 180], peso: 1.5 },
  observar: { fica: [45, 90], peso: 1.5 },
  meditar: { fica: [120, 240], peso: 1.2 },
};

const telaoAFrente = (i: number, d: number) => { const t = TELOES[i]!; return { x: t.x + Math.sin(t.rot) * d, z: t.z + Math.cos(t.rot) * d, rumo: t.rot + Math.PI }; };
const marcoDoMirante = (i: number) => { const poi = POIS.find((p) => p.id === (i === 0 ? "zaeon" : `mirante-${i}`)); return poi ? marcoNav(poi) : null; };
/** o pé da escada da pirâmide do mirante (local) */
function peDoMirante(i: number): P2 {
  const mn = marcoDoMirante(i)!, w = deEscada(mn, mn.nav.bordaR + mn.nav.escada.comprimento + 2.5, 0);
  return { x: w.x - CIDADE.centro.x, z: w.z - CIDADE.centro.z };
}
/** a moto dela: estacionada AO LADO do lote da Zaeon (local) */
export const VAGA_DA_NINA: P2 & { rumo: number } = { x: -60, z: -92, rumo: Math.atan2(60, 92) };

/** os LUGARES da cidadela */
export const LUGARES: readonly Lugar[] = [
  // os 8 desktops da capela: em pé do lado do globo, virada pra tela
  ...computadoresLocais().map((c, i) => { const a = Math.atan2(c.z, c.x); return { id: `desktop-${i}`, atividade: "trabalhar" as const, pos: { x: Math.cos(a) * 19.4, z: Math.sin(a) * 19.4 }, rumo: Math.atan2(Math.cos(a), Math.sin(a)) }; }),
  // a pista do lounge (lá em cima)
  ...[[-387, -4], [-383, 3], [-389, 5], [-381, -6]].map(([x, z], i) => ({ id: `pista-${i}`, atividade: "dancar" as const, pos: { x: x!, z: z! }, rumo: rumoDaPista() })),
  // de frente pros telões dos mirantes 1–3 (o 0 é a Recepção, a casa da Zaeon)
  ...[1, 2, 3].map((i) => { const f = telaoAFrente(i, 16); return { id: `telao-${i}`, atividade: "observar" as const, pos: { x: f.x, z: f.z }, rumo: f.rumo }; }),
  // meditar no alto das pirâmides dos mirantes 1–3 (chega no pé da escada; a subida é parte da atividade)
  ...[1, 2, 3].map((i) => { const p = peDoMirante(i), m = MIRANTES[i]!; return { id: `mirante-${i}`, atividade: "meditar" as const, pos: p, rumo: Math.atan2(m.x - p.x, m.z - p.z), mirante: i }; }),
  // passeios pela praça
  ...[[110, 20], [60, -140], [-150, 40], [20, 160], [-60, -180], [170, -60], [-120, -60], [140, 90]].map(([x, z], i) => ({ id: `praca-${i}`, atividade: "passear" as const, pos: { x: x!, z: z! }, rumo: Math.atan2(-x!, -z!) })),
  // a moto
  { id: "moto", atividade: "moto", pos: { x: VAGA_DA_NINA.x, z: VAGA_DA_NINA.z }, rumo: VAGA_DA_NINA.rumo },
];

export type Bloco = { n: number; ini: number; atividade: Atividade; lugar: number; de: number; viagem: number; fim: number };

/** sorteia o próximo bloco a partir do anterior (determinístico pela semente e pelo número do bloco) */
export function proximoBloco(ant: Bloco, semente: number): Bloco {
  const n = ant.n + 1, r = aleatorioComSemente((semente * 7919 + n * 104729) >>> 0);
  const semTrabalhar = ant.atividade !== "trabalhar" && ant.n > 0 && r() < 0.55;   // volta pro trabalho com frequência
  let atividade: Atividade = "trabalhar";
  if (!semTrabalhar) {
    const opcoes = (Object.keys(ATIVIDADES) as Atividade[]).filter((a) => a !== ant.atividade);
    const total = opcoes.reduce((s, a) => s + ATIVIDADES[a].peso, 0); let x = r() * total;
    atividade = opcoes.find((a) => (x -= ATIVIDADES[a].peso) < 0) ?? opcoes[0]!;
  }
  if (atividade === ant.atividade) atividade = "passear";
  const candidatos = LUGARES.map((l, i) => ({ l, i })).filter(({ l, i }) => l.atividade === atividade && i !== ant.lugar);
  const lugar = candidatos[Math.floor(r() * candidatos.length)]!.i;
  const a = LUGARES[ant.lugar]!.pos, b = LUGARES[lugar]!.pos;
  const viagem = Math.max(6, (Math.hypot(b.x - a.x, b.z - a.z) * 1.15) / VEL_A_PE);
  const [fmin, fmax] = ATIVIDADES[atividade].fica, fica = fmin + r() * (fmax - fmin);
  const ini = ant.fim;
  return { n, ini, atividade, lugar, de: ant.lugar, viagem, fim: ini + viagem + fica };
}

/** o bloco em que o relógio `t` (s, UTC) cai — anda a partir da época (ou de um bloco já conhecido, `cache`) */
export function blocoEm(t: number, semente: number, cache?: Bloco | null): Bloco {
  let b: Bloco = cache && cache.ini <= t ? cache : { n: 0, ini: EPOCA - 1, atividade: "trabalhar", lugar: semente % 8, de: semente % 8, viagem: 0, fim: EPOCA };
  while (b.fim <= t) b = proximoBloco(b, semente);
  return b;
}

/** o que ela está fazendo agora (pra o corpo): onde (local), a altura acima do piso, pra onde olha e as flags da pose */
export type Estado = {
  atividade: Atividade; fase: "andando" | "ficando"; lugar: string;
  pos: P2; y: number; rumo: number;
  andando: boolean; sentado: number; danca: number; meditando: number;
  /** de moto: a pose da moto no mundo local (y acima do piso) */
  moto: { x: number; y: number; z: number; rumo: number; voando: boolean; vel: number; curva: number } | null;
};

const rotas = new Map<string, P2[]>();
/** a rota a pé entre dois lugares (cacheada) */
export function rotaEntre(de: number, para: number): P2[] {
  const k = `${de}>${para}`; let r = rotas.get(k);
  if (!r) { const a = LUGARES[de]!.pos, b = LUGARES[para]!.pos; r = rotaAPe(a, b) ?? [a, b]; rotas.set(k, r); }
  return r;
}

/** a altura do chão (acima do piso da ilha) num ponto local — o lounge e a escada inclusos */
const alturaLocal = (p: P2) => alturaNaCidade(mundo(p));

/** o VOO de moto (y acima do piso): sobe, sai pela borda, dá a volta na ilha por fora, volta e pousa na vaga */
export const VOO_DA_MOTO = { sobe: 6, sai: 9, raio: 275, altura: 55 } as const;
export function motoEm(k: number, dur: number): NonNullable<Estado["moto"]> {
  const V = VOO_DA_MOTO, v0 = VAGA_DA_NINA, a0 = Math.atan2(v0.z, v0.x), borda = { x: Math.cos(a0) * V.raio, z: Math.sin(a0) * V.raio };
  const volta = Math.max(10, dur - 2 * (V.sobe + V.sai)), s3 = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
  if (k < V.sobe) { const u = s3(k / V.sobe); return { x: v0.x, y: u * V.altura, z: v0.z, rumo: v0.rumo, voando: u > 0.05, vel: 4, curva: 0 }; }
  if (k < V.sobe + V.sai) { const u = s3((k - V.sobe) / V.sai); return { x: v0.x + (borda.x - v0.x) * u, y: V.altura, z: v0.z + (borda.z - v0.z) * u, rumo: Math.atan2(borda.x - v0.x, borda.z - v0.z), voando: true, vel: 22, curva: 0 }; }
  const kv = k - V.sobe - V.sai;
  if (kv < volta) { const ang = a0 + (kv / volta) * Math.PI * 2; return { x: Math.cos(ang) * V.raio, y: V.altura + Math.sin(kv * 0.4) * 2, z: Math.sin(ang) * V.raio, rumo: Math.atan2(-Math.sin(ang), Math.cos(ang)), voando: true, vel: (Math.PI * 2 * V.raio) / volta, curva: 0.35 }; }
  const kr = kv - volta;
  if (kr < V.sai) { const u = s3(kr / V.sai); return { x: borda.x + (v0.x - borda.x) * u, y: V.altura, z: borda.z + (v0.z - borda.z) * u, rumo: Math.atan2(v0.x - borda.x, v0.z - borda.z), voando: true, vel: 22, curva: 0 }; }
  const u = s3((kr - V.sai) / V.sobe); return { x: v0.x, y: (1 - u) * V.altura, z: v0.z, rumo: v0.rumo, voando: u < 0.95, vel: 4, curva: 0 };
}

/** subir/descer a escada da pirâmide do mirante e meditar no centro do salão */
export const MEDITA = { sobe: 9 } as const;
function noMirante(i: number, k: number, dur: number): { pos: P2; y: number; rumo: number; andando: boolean; meditando: number } {
  const mn = marcoDoMirante(i)!, pe = mn.nav.bordaR + mn.nav.escada.comprimento + 2.5;
  const fora = mn.nav.escada.dir + Math.PI;   // de costas pra escada: olhando a vista
  const em = (along: number) => { const w = deEscada(mn, along, 0); return { local: { x: w.x - CIDADE.centro.x, z: w.z - CIDADE.centro.z }, y: alturaEm(mn, w) }; };
  const sobe = Math.min(MEDITA.sobe, dur / 3);
  const rumoSobe = Math.atan2(Math.cos(fora), Math.sin(fora));
  if (k < sobe) { const p = em(pe * (1 - k / sobe)); return { pos: p.local, y: p.y, rumo: rumoSobe, andando: true, meditando: 0 }; }
  if (k > dur - sobe) { const p = em(pe * ((k - (dur - sobe)) / sobe)); return { pos: p.local, y: p.y, rumo: rumoSobe + Math.PI, andando: true, meditando: 0 }; }
  const c = em(0);
  return { pos: c.local, y: c.y, rumo: rumoSobe, andando: false, meditando: 1 };
}

/** o ESTADO no relógio `t` */
export function estadoEm(t: number, semente: number, cache?: Bloco | null): Estado & { bloco: Bloco } {
  const b = blocoEm(t, semente, cache), lugar = LUGARES[b.lugar]!, k = t - b.ini;
  const base = { atividade: b.atividade, lugar: lugar.id, bloco: b, sentado: 0, danca: 0, meditando: 0, moto: null };
  if (k < b.viagem) {   // andando até lá
    const r = rotaEntre(b.de, b.lugar), L = comprimento(r), p = pontoNaRota(r, (L * k) / b.viagem);
    return { ...base, fase: "andando", pos: { x: p.x, z: p.z }, y: alturaLocal(p), rumo: p.rumo, andando: true };
  }
  const kf = k - b.viagem, fica = b.fim - b.ini - b.viagem;
  if (b.atividade === "moto") {
    const m = motoEm(kf, fica);
    return { ...base, fase: "ficando", pos: { x: m.x, z: m.z }, y: m.y, rumo: m.rumo, andando: false, moto: m };
  }
  if (b.atividade === "meditar" && lugar.mirante !== undefined) {
    const m = noMirante(lugar.mirante, kf, fica);
    return { ...base, fase: "ficando", pos: m.pos, y: m.y, rumo: m.rumo, andando: m.andando, meditando: m.meditando };
  }
  return {
    ...base, fase: "ficando", pos: lugar.pos, y: alturaLocal(lugar.pos), rumo: lugar.rumo, andando: false,
    sentado: b.atividade === "trabalhar" ? 1 : 0, danca: b.atividade === "dancar" ? 1 : 0,
  };
}
