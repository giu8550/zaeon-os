/**
 * Frota de IAs — o CORPO no instante (PURO, determinístico): dado o plano do dia de uma IA e o minuto, onde ela está e o
 * que o corpo faz. Cada bloco = VIAGEM até o lugar (no começo do bloco) + a ATIVIDADE lá:
 *  - viagem DENTRO da Zaeon (central e salas): de MOCHILA A JATO (um arco por cima das coisas — sem lotar os fios dos
 *    jogadores); sem mochila (flag), a pé na central e de moto pras salas;
 *  - entre os LUGARES DE ESTUDO (salas da Zaeon e universidades): de MOTO, de vaga em vaga — cada lugar tem um
 *    ESTACIONAMENTO (lib/cyber/estacionamentosEstudo): chega de moto, a moto FICA na vaga (`vagaMoto`) e ela vai de
 *    mochila até o lugar; na saída, volta de mochila pra vaga e sai de moto (lotou: como antes);
 *  - viagem pra FORA (universidades, praça, Solana): de MOTO, voando alto. Saindo da Zaeon, a IA vai de mochila até a
 *    GARAGEM e PEGA a moto lá (`pontoDaGaragem`: cada uma na sua vaga de decolagem); voltando, POUSA na garagem e segue
 *    de mochila — ninguém mais sobe de moto de dentro de uma sala. Fora da Zaeon (de um lugar visitado pra outro) a
 *    moto se materializa/desfaz (components/cyber/FrotaIA);
 *  - parada num lugar visitado: num ponto do CHÃO da plataforma (`spotsDe`), cada IA no seu — nada de bolo de gente
 *    num ponto só; no passeio a pé, cada uma no seu canto em volta do mirante;
 *  - ESTUDO: senta no lugar (sofá, pufe — a pose relaxada —, puff, ou no chão de perna cruzada; às vezes deita no sofá)
 *    e estuda no TABLET;
 *  - MOTO (o passeio): VOANDO quase o tempo todo — uma cadeia de pontos no céu (em volta da Zaeon, circulando os campi
 *    flutuantes, entre eles), pousando às vezes num campus por 1–2 min (`roteiroMoto`); na CORRIDA, o grupo dá voltas
 *    juntos num circuito e depois para junto num lugar;
 *  - ANDAR: a TURMA vai a pé aos PONTOS DE INTERESSE da Zaeon — os telões dos mirantes (problemas → soluções) e o
 *    salão da capela — e FICA lá (3–8 min em cada), cada um no seu lugar perto dos amigos, virado pro que está vendo
 *    (`roteiroAndar`; ninguém vagando de um lado pro outro — pedido do dono, out/2026);
 *  - FESTA: dança na pista do lounge (só se estiver rolando som — senão já foi embora).
 * Fora dos blocos: offline (não aparece). Coordenadas do MUNDO; `zaeon` = está na ilha/salas (o engine soma a boia).
 */
import { ALTURA_LOUNGE, CIDADE, colisoresDaCidade, daSala, mundo, rumoNaSala, type NomeSala } from "../ceu";
import { comprimento, pontoNaRota, rotaAPe } from "../caminhos";
import { NOS } from "../buracos";
import { fiosCosmicos, saidaDaSala } from "../fiosCosmicos";
import { nivelDoPonto } from "../niveis";
import { NIVEIS_SEPARADOS, type IdNivel } from "../nivelAtivo";
import { PIRAMIDE, PLATS, PONTES, RASTA, SALAO, TORRE_TI, alturaNoComplexo } from "../temploCosmico";
import { PLATAFORMAS, IDS_PLATAFORMAS } from "../plataformas";
import { ESTACAO, MEIO_TELOES, MIRANTES_ESTACAO, noMirante } from "../terra";
import { acasoDe, entre, inteiro, embaralhar, type Acaso } from "./aleatorio";
import type { FlagsFrota } from "./agenda";
import type { BlocoPlano } from "./plano";
import { spotsDe, type Spot } from "./lugares";
import { BOCA_NO_TEMPLO, CHEGADA_NO_TEMPLO, caminhoNoTemplo as caminhoPeloTemplo, cruzeiroNoTemplo, doLayoutT, pousoPerto, type LugarNoTemplo, type SalaTemplo, type TrechoTemplo } from "./templo";
import type { VagaEstudo } from "../estacionamentosEstudo";

type P3 = { x: number; y: number; z: number; /** é um lugar do TEMPLO CÓSMICO (o caminho a pé até ele — lib/cyber/frota/templo) */ templo?: LugarNoTemplo };
export type PoseIA = "andando" | "parado" | "mochila" | "moto" | "sentado" | "deitado" | "relaxa" | "chao" | "danca";
export type EstadoIA = {
  visivel: boolean; x: number; y: number; z: number; rumo: number; zaeon: boolean;
  pose: PoseIA;
  /** peso de sentar (0..1: abaixando/levantando), o tablet (0..1: materializando) e a altura do assento */
  sentar: number; tablet: number; assentoY: number;
  /** a moto (quando está nela) */
  moto: { vel: number; curva: number } | null;
  /** a MOTO DELA parada num estacionamento agora (chegou e está no lugar, ou ainda indo buscar) — o render desenha */
  vagaMoto: VagaEstudo | MotoNoChao | null;
  /** índice do bloco e o tipo de atividade (pra conversa e debug) */
  bloco: number; atividade: BlocoPlano["atividade"] | null; ambiente: string | null; evento: string | null;
};
/** a moto de uma IA ESTACIONADA onde ela pousou (no Templo — o trânsito: em qualquer chão aberto) */
export type MotoNoChao = { ambiente: "templo"; i: number; x: number; y: number; z: number; rumo: number; zaeon: true };
export const OFFLINE: EstadoIA = { visivel: false, x: 0, y: 0, z: 0, rumo: 0, zaeon: false, pose: "parado", sentar: 0, tablet: 0, assentoY: 0.7, moto: null, vagaMoto: null, bloco: -1, atividade: null, ambiente: null, evento: null };

/** as velocidades (m/s) e os tempos (s) */
export const MOV = { pe: 1.5, mochila: 13, moto: 42, decola: 3.5, pousa: 3.5, sobeMoto: 5, cruzeiroAcima: 28, senta: 0.8, tabletIn: 0.9, corridaVolta: 110, corridaMax: 8 * 60, rodaZaeonMax: 120 } as const;

const PISO = CIDADE.pisoY;
const local = (p: { x: number; z: number }) => ({ x: p.x - CIDADE.centro.x, z: p.z - CIDADE.centro.z });
const naZaeon = (p: { x: number; z: number }) => Math.hypot(p.x - CIDADE.centro.x, p.z - CIDADE.centro.z) < 520;
const s3 = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };

/** os pontos de VISITA de moto pelo mapa (fora da Zaeon) */
type Ponto = P3 & { id: string; estudo: boolean; /** (passeio a pé) pra onde olha parado aqui e quanto fica (s) */ olha?: number; fica?: number;
  /** (passeio nos LOUNGES) o caminho a pé desde o ponto anterior, com a altura do piso em cada vértice (sem o A* da central) */ via?: P3[] };
const VISITAS: Ponto[] = [
  ...IDS_PLATAFORMAS.map((id) => { const P = PLATAFORMAS[id]; return { id, x: P.chegada.x, y: P.y, z: P.chegada.z, estudo: id !== "solana" }; }),
  // (a PRAÇA saiu: virou a ARENA PvP — lib/cyber/arena; IA não pousa no meio da luta)
];
/** os PONTOS DE INTERESSE do passeio a pé na Zaeon central (local da ilha): a plateia na frente de cada telão dos
 *  mirantes (PROBLEMAS e SOLUÇÕES — fora do palco, dos cards e do globo) e o SALÃO da capela (em volta do globo).
 *  `lugar(u, v)` (u, v em 0..1) dá um ponto da área e `alvo` é pra onde se olha */
type Interesse = { id: string; lugar(u: number, v: number): { x: number; z: number }; alvo: { x: number; z: number } };
const INTERESSES: Interesse[] = [
  ...MIRANTES_ESTACAO.flatMap((m) => ([["problemas", -MEIO_TELOES], ["solucoes", MEIO_TELOES]] as const).map(([nome, dv]): Interesse => ({
    id: `telao-${nome}-${m.id}`,
    lugar: (u, v) => noMirante(m, ESTACAO.u + 12 + u * 16, ESTACAO.v + dv + (v - 0.5) * 22),   // 12–28 m na frente, na largura do telão
    alvo: noMirante(m, ESTACAO.u, ESTACAO.v + dv),
  }))),
  { id: "salao", lugar: (u, v) => { const a = v * Math.PI * 2, r = CIDADE.mesaHolo.r + 6 + u * (CIDADE.cidadela.r - CIDADE.mesaHolo.r - 14); return { x: Math.cos(a) * r, z: Math.sin(a) * r }; }, alvo: { x: 0, z: 0 } },
];
/** pontos do CÉU pro passeio de moto (passa voando, sem pousar): o anel em volta da Zaeon, a volta de cada campus, e
 *  pontos soltos entre eles; `fora` = fora da Zaeon (o passeio começa e termina num desses) */
type PontoCeu = Ponto & { fora: boolean; pousa: boolean };
const CEU: PontoCeu[] = [
  ...Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * Math.PI * 2, R = 330 + (k % 3) * 25; return { id: `ceu-zaeon-${k}`, x: CIDADE.centro.x + Math.cos(a) * R, y: PISO - 40 + (k % 3) * 25, z: CIDADE.centro.z + Math.sin(a) * R, estudo: false, fora: false, pousa: false }; }),
  ...IDS_PLATAFORMAS.flatMap((id) => { const P = PLATAFORMAS[id]; return [0, 1, 2, 3].map((k) => { const a = (k / 4) * Math.PI * 2 + 0.5, R = P.r + 45; return { id: `ceu-${id}-${k}`, x: P.centro.x + Math.cos(a) * R, y: P.y + 22, z: P.centro.z + Math.sin(a) * R, estudo: false, fora: true, pousa: false }; }); }),
  // o FLUXO entre as PLATAFORMAS DE ESTUDO (pedido do dono, out/2026): 3 pontos no céu do lado de fora de cada uma
  // (biblioteca, jardim, lounge) — o passeio vai de uma pra outra (os pontos soltos pelo mapa, dos campi, saíram)
  // (o LOUNGE saiu: com os níveis separados, ele é o Templo Cósmico — chega-se pelo buraco negro, não voando)
  ...(NIVEIS_SEPARADOS ? (["biblioteca", "jardim"] as const) : (["biblioteca", "jardim", "lounge"] as const)).flatMap((nome) => { const s = CIDADE.salas[nome], c = mundo(s); return [-0.45, 0, 0.45].map((da, k) => {
    const a = s.ang + da, R = s.r + 35; return { id: `ceu-${nome}-${k}`, x: c.x + Math.cos(a) * R, y: PISO + s.y + 16 + k * 5, z: c.z + Math.sin(a) * R, estudo: false, fora: false, pousa: false }; }); }),
  ...VISITAS.map((v) => ({ ...v, fora: true, pousa: true })),
];
const CHEGADA: P3 = { x: NOS.zaeon.chegada.x, y: PISO, z: NOS.zaeon.chegada.z };
/** a GARAGEM: onde as IAs pegam/largam a moto — 24 vagas de decolagem num anel em volta do miolo da sala (cada IA na
 *  dela, pelo hash), no piso das salas */
const VAGAS_GARAGEM: P3[] = Array.from({ length: 24 }, (_, k) => {
  const a = (k / 24) * Math.PI * 2, r = 14 + (k % 3) * 7, w = mundo(daSala(CIDADE.salas.garagem, Math.cos(a) * r, -12 + Math.sin(a) * r * 0.8));
  return { x: w.x, y: CIDADE.pisoY + ALTURA_LOUNGE + 0.2, z: w.z };
});
export const pontoDaGaragem = (chave: string): P3 => VAGAS_GARAGEM[Math.floor(acasoDe("garagem", chave)() * VAGAS_GARAGEM.length)]!;

const NA_CHEGADA: Ponto = { id: "chegada", ...CHEGADA, estudo: false };
/** o movimento APROXIMADO (`preciso` false — o de todo mundo, a cada 0,4 s) de cada bloco, cacheado (o preciso, só pras
 *  ~18 desenhadas em detalhe, é refeito) */
const memoMov = new Map<string, Movimento>();
function movimentoCache(agente: string, blocos: readonly BlocoPlano[], i: number, flags: FlagsFrota, preciso: boolean): Movimento {
  if (preciso) return movimento(agente, blocos, i, flags, true);
  const b = blocos[i]!, k = `${agente}|${i}|${b.ini}|${b.fim}|${flags.mochila ? 1 : 0}`; let m = memoMov.get(k);
  if (!m) { m = movimento(agente, blocos, i, flags, false); memoMov.set(k, m); if (memoMov.size > 8000) memoMov.delete(memoMov.keys().next().value!); }
  return m;
}
/** onde a IA está ao TERMINAR um bloco (a próxima viagem sai daqui) — no passeio (moto/a pé), o fim do roteiro já
 *  CORTADO pro tempo do bloco (`movimento`), então bate exatamente com onde ela está */
function fimDoBloco(agente: string, blocos: readonly BlocoPlano[], i: number, flags: FlagsFrota): Ponto {
  const b = blocos[i]!;
  if (b.spot) { const p = b.deitado && b.spot.deita ? b.spot.deita : b.spot; return { id: b.spot.id, x: p.x, y: b.spot.y, z: p.z, estudo: true, ...(b.spot.templo ? { templo: b.spot.templo } : {}) }; }
  if (b.atividade !== "moto" && b.atividade !== "andar") return NA_CHEGADA;
  return movimentoCache(agente, blocos, i, flags, false).fim;
}
/** de onde a IA sai pro bloco `i` (o fim do anterior, se encosta; senão a chegada) */
function antDoBloco(agente: string, blocos: readonly BlocoPlano[], i: number, flags: FlagsFrota): Ponto {
  return i > 0 && blocos[i - 1]!.fim >= blocos[i]!.ini - 1 ? fimDoBloco(agente, blocos, i - 1, flags) : NA_CHEGADA;
}

// ── os ROTEIROS (determinísticos por agente+bloco, cacheados) ──────────────────────────────────────────────────────
type Parada = { p: Ponto; fica: number; pousa: boolean };   // (fica em s)
const cacheRoteiros = new Map<string, unknown>();
function lembrar<T>(k: string, f: () => T): T { let v = cacheRoteiros.get(k) as T | undefined; if (v === undefined) { v = f(); cacheRoteiros.set(k, v); if (cacheRoteiros.size > 6000) cacheRoteiros.delete(cacheRoteiros.keys().next().value!); } return v; }
const dist3 = (a: P3, b: P3) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
/** o PASSEIO DE MOTO: voando de ponto em ponto do céu (o próximo a 250–1400 m do atual), pousando às vezes num campus
 *  (35 % dos que dá, 40–120 s); começa e termina FORA da Zaeon; enche ~85 % do bloco (o resto é a ida/volta) */
export function roteiroMoto(b: BlocoPlano, a: string, iBloco: number): Parada[] {
  const chave = b.evento ? `moto|${b.evento}` : `moto|${a}|${iBloco}|${b.ini}`;
  return lembrar(chave, () => {
    const r = acasoDe("moto", b.evento ?? a, b.evento ? 0 : iBloco), alvo = (b.fim - b.ini) * 60 * 0.85;
    const fora = CEU.filter((q) => q.fora && !q.pousa);
    let atual: PontoCeu = fora[Math.floor(r() * fora.length)]!, tempo = 90;
    const lista: Parada[] = [{ p: atual, fica: 0, pousa: false }];
    while (tempo < alvo && lista.length < 90) {
      const cand = CEU.filter((q) => q.id !== atual.id && dist3(q, atual) > 250 && dist3(q, atual) < 1400);
      const prox = (cand.length ? cand : CEU)[Math.floor(r() * (cand.length || CEU.length))]!;
      const pousa = prox.pousa && r() < 0.35, fica = pousa ? entre(r, 40, 120) : 0;
      tempo += trechoMoto(atual, prox, lista.at(-1)!.pousa, pousa).dur + fica;
      lista.push({ p: prox, fica, pousa }); atual = prox;
    }
    if (!atual.fora) { const f = fora.reduce((m, q) => (dist3(q, atual) < dist3(m, atual) ? q : m)); lista.push({ p: f, fica: 0, pousa: false }); }
    return lista;
  });
}
/** um trecho do passeio de moto: no céu (os dois pontos no ar) RETO na velocidade; saindo/chegando no chão, sobe/desce */
function trechoMoto(de: P3, para: P3, deChao: boolean, paraChao: boolean): Viagem {
  if (deChao || paraChao) return deMoto(de, para);
  const d = dist3(de, para), rumo = Math.atan2(para.x - de.x, para.z - de.z), dur = Math.max(0.1, d / MOV.moto);
  return { modo: "moto", dur, em: (u) => ({ x: de.x + (para.x - de.x) * u, y: de.y + (para.y - de.y) * u, z: de.z + (para.z - de.z) * u, rumo, modo: "moto" }) };
}
/** um ROTEIRO tocado no tempo que sobra do bloco: os trechos (com as paradas) num ritmo ajustado pra TERMINAR
 *  exatamente no fim (`escala` = tempo do roteiro ÷ tempo disponível, limitado a 0,6–1,4) — assim a próxima atividade
 *  sai de onde a IA está de verdade (sem salto) e não sobra tempo parado */
type Trecho = { v: Viagem; fica: number; ate: Ponto; parada: () => { x: number; z: number; rumo: number } & { y: number } };
/** corta os trechos pra caber em `disponivel` (s): para no 1º que passa de 90 % dele (o `percorrer` ajusta o ritmo) */
function cortar(trechos: Trecho[], disponivel: number): Trecho[] {
  let soma = 0; for (let m = 0; m < trechos.length; m++) { soma += trechos[m]!.v.dur + trechos[m]!.fica; if (soma >= disponivel * 0.9) return trechos.slice(0, m + 1); }
  return trechos;
}
function percorrer(trechos: Trecho[], k: number, disponivel: number): { em: "trecho"; p: P3 & { rumo: number; modo?: ModoViagem }; v: Viagem } | { em: "parada"; q: P3 & { rumo: number } } {
  const total = trechos.reduce((a, t) => a + t.v.dur + t.fica, 0), escala = Math.max(0.6, Math.min(1.4, total / Math.max(1, disponivel)));
  let r = Math.min(total - 1e-6, Math.max(0, k * escala));
  for (const t of trechos) {
    if (r < t.v.dur) return { em: "trecho", p: t.v.em(t.v.dur > 0 ? r / t.v.dur : 1), v: t.v };
    r -= t.v.dur;
    if (r < t.fica) return { em: "parada", q: t.parada() };
    r -= t.fica;
  }
  const ult = trechos.at(-1)!; return { em: "trecho", p: ult.v.em(1), v: ult.v };
}
/** os trechos do passeio de moto a partir de `de` (no ar, ou no chão se `deChao`): voo entre os pontos e as pousadas
 *  (de pé ao lado de onde pousou); `todos` = começa do 1º ponto do roteiro (depois da corrida) em vez do 2º */
function trechosDoCeu(rot: Parada[], de: P3, deChao: boolean, agente: string, i: number, todos = false): Trecho[] {
  const out: Trecho[] = []; let a = de, aChao = deChao;
  for (let j = todos ? 0 : 1; j < rot.length; j++) {
    const par = rot[j]!, v = trechoMoto(a, par.p, aChao, par.pousa);
    out.push({ v, fica: par.fica, ate: par.p, parada: () => { const c = cantoEmVolta(par.p, agente, i * 100 + j); return { x: c.x, y: par.p.y, z: c.z, rumo: c.rumo }; } });
    a = par.p; aChao = par.pousa;
  }
  return out;
}
/** o PASSEIO A PÉ: a TURMA (os amigos, `b.turma`) sorteia a mesma sequência de PONTOS DE INTERESSE — os dois telões de um
 *  mirante (problemas → soluções, a ordem de leitura) e/ou o salão da capela — e cada um fica no SEU lugar perto do
 *  ponto de encontro da turma (2–5 m), virado pro telão/globo, 3–8 min em cada. Quem passeia no mesmo pedaço da tarde
 *  que um amigo acaba no mesmo lugar que ele */
export function roteiroAndar(b: BlocoPlano, a: string, iBloco: number): Ponto[] {
  return lembrar(`andar|${a}|${iBloco}|${b.ini}`, () => {
    const turma = b.turma ?? a, rt = acasoDe("interesse", turma, Math.floor(b.ini / 40));   // (a turma, nesse pedaço do dia)
    // metade dos passeios é nos LOUNGES (o Templo Cósmico — chega-se pelo buraco negro: `travessia`)
    // (os NOVATOS — `zona: "zaeon"` — nunca; o passeio do Templo — `zona: "templo"` — sempre)
    if (NIVEIS_SEPARADOS && b.passeio && b.zona !== "zaeon" && (b.zona === "templo" || rt() < 0.5)) return roteiroNoTemplo(turma, a, iBloco, b.ini, rt);
    const m = MIRANTES_ESTACAO[Math.floor(rt() * MIRANTES_ESTACAO.length)]!.id, tel = (n: string) => INTERESSES.find((q) => q.id === `telao-${n}-${m}`)!, salao = INTERESSES.at(-1)!;
    const seq = rt() < 0.4 ? [salao, tel("problemas"), tel("solucoes")] : rt() < 0.6 ? [tel("problemas"), tel("solucoes"), salao] : [tel("problemas"), tel("solucoes")];
    const ra = acasoDe("lugar-interesse", a, iBloco);
    const solidos = colisoresDaCidade(), livre = (w: { x: number; z: number }) => solidos.every((c) => Math.hypot(w.x - c.x, w.z - c.z) > c.r + 0.5);
    return seq.map((q, k) => {
      const enc = q.lugar(rt(), rt());
      let l = enc, w = mundo(l);
      for (let t = 0; t < 12; t++) {   // o lugar de cada um em volta do encontro (2–5 m), fora de tudo que é sólido
        const ang = ra() * Math.PI * 2, d = entre(ra, 2, 5 + t * 0.5); l = { x: enc.x + Math.cos(ang) * d, z: enc.z + Math.sin(ang) * d }; w = mundo(l);
        if (livre(w)) break;
      }
      // (na CAPELA, o novato só passa pra pegar uma informação com a Zaeon e vai embora)
      const fica = q.id === "salao" && b.zona === "zaeon" ? entre(rt, 50, 110) : entre(rt, 180, 480);
      return { id: `${q.id}#${k}`, x: w.x, y: PISO, z: w.z, estudo: false, olha: Math.atan2(q.alvo.x - l.x, q.alvo.z - l.z), fica };
    });
  });
}
// ── o PASSEIO nos LOUNGES (o Templo Cósmico — referencial do layout do lounge; mundo pelo `daSala`) ──────────────────
/** a altura do piso (MUNDO) num ponto do layout do Templo: pura (sem o nível ativo — a frota pode rodar fora dele) */
const yTemplo = (q: { x: number; z: number }) => PISO + ALTURA_LOUNGE + (alturaNoComplexo(q) ?? 0);
const doLayout = (q: { x: number; z: number }): P3 => ({ ...mundo(daSala(CIDADE.salas.lounge, q.x, q.z)), y: yTemplo(q) });
/** os LUGARES do passeio nos lounges: o caminho a pé desde o HUB (na frente da pirâmide, no salão) — retas que não
 *  atravessam a pirâmide nem paredes, pelas pontes e escadas — e a área onde a turma fica, virada pro que vê */
type LugarTemplo = { id: string; caminho: { x: number; z: number }[]; lugar(u: number, v: number): { x: number; z: number }; alvo: { x: number; z: number } };
const HUB_TEMPLO = { x: SALAO.x, z: SALAO.z + 22 };
const LUGARES_TEMPLO: readonly LugarTemplo[] = (() => {
  const ponte = (id: string) => PONTES.find((p) => p.id === id)!, plat = (id: string) => PLATS.find((p) => p.id === id)!;
  const doEstudo = (id: "estudoL" | "estudoR") => { const p = ponte(id); return [p.a, p.b]; };
  const noAnel = (c: { x: number; z: number }, r0: number, r1: number, a0: number, a1: number) => (u: number, v: number) => { const a = a0 + (a1 - a0) * v, r = r0 + (r1 - r0) * u; return { x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r }; };
  const ang = (de: { x: number; z: number }, para: { x: number; z: number }) => Math.atan2(para.z - de.z, para.x - de.x);
  const eL = plat("estudoL"), eR = plat("estudoR"), lounge = ponte("lounge"), rasta = ponte("rasta");
  return [
    // o SALÃO: na frente e dos lados da pirâmide (o lado de trás é o caminho do campus), olhando pra ela
    // (até 26 m do centro: a chegada de quem vem pelo buraco negro fica a 33 — ninguém parado em cima de quem chega)
    { id: "salao", caminho: [], lugar: noAnel(SALAO, 16, 26, 0.25, Math.PI - 0.25), alvo: PIRAMIDE },
    // o CAMPUS DE TI: contorna a pirâmide pelo lado e desce pelo corredor do meio, olhando pra torre
    { id: "campus", caminho: [{ x: SALAO.x + 22, z: SALAO.z + 12 }, { x: SALAO.x + 22, z: SALAO.z - 30 }, { x: SALAO.x, z: SALAO.z - SALAO.r - 4 }],
      lugar: (u, v) => ({ x: SALAO.x + (u - 0.5) * 7, z: SALAO.z - SALAO.r - 12 - v * 150 }), alvo: { x: TORRE_TI.x, z: TORRE_TI.z } },
    // os LOUNGES ESTUDANTIS (o térreo): pela ponte do salão, por dentro, olhando pro caracol
    { id: "estudoL", caminho: doEstudo("estudoL"), lugar: noAnel(eL, 9, 18, ang(eL, ponte("estudoL").b) - 0.9, ang(eL, ponte("estudoL").b) + 0.9), alvo: eL },
    { id: "estudoR", caminho: doEstudo("estudoR"), lugar: noAnel(eR, 9, 18, ang(eR, ponte("estudoR").b) - 0.9, ang(eR, ponte("estudoR").b) + 0.9), alvo: eR },
    // o LOUNGE CÓSMICO: pelo lounge estudantil e a escada subindo; fica no pátio, perto de onde a escada chega
    { id: "lounge", caminho: [...doEstudo("estudoL"), lounge.a, lounge.b], lugar: noAnel({ x: 0, z: 0 }, 50, 60, ang({ x: 0, z: 0 }, lounge.b) - 0.35, ang({ x: 0, z: 0 }, lounge.b) + 0.35), alvo: { x: 0, z: 0 } },
    // o LOUNGE RASTA: pelo outro lounge estudantil e a escada; fica no disco, olhando pra árvore
    { id: "rasta", caminho: [...doEstudo("estudoR"), rasta.a, rasta.b], lugar: noAnel(RASTA, 22, 52, ang(RASTA, rasta.b) - 0.5, ang(RASTA, rasta.b) + 0.5), alvo: RASTA },
  ];
})();
/** a sala (lib/cyber/frota/templo) de cada lugar do passeio */
const SALA_DO_LUGAR: Record<string, SalaTemplo> = { salao: "salao", campus: "campus", estudoL: "estudoL", estudoR: "estudoR", lounge: "lounge", rasta: "rasta" };
/** o caminho a pé de um lugar do Templo a outro: volta pelo caminho do de saída até o hub e vai pelo do destino */
function caminhoNoTemplo(de: LugarTemplo, ponto: { x: number; z: number }, para: LugarTemplo, chegada: { x: number; z: number }): P3[] {
  return [ponto, ...[...de.caminho].reverse(), HUB_TEMPLO, ...para.caminho, chegada].map(doLayout);
}
/** o PASSEIO da turma nos lounges: 2–3 lugares do Templo, cada um com o seu canto em volta do ponto de encontro */
function roteiroNoTemplo(turma: string, a: string, iBloco: number, ini: number, rt: Acaso): Ponto[] {
  const ra = acasoDe("lugar-templo", a, iBloco), n = 2 + Math.floor(rt() * 2), seq: LugarTemplo[] = [];
  for (let k = 0; k < n; k++) { let l = LUGARES_TEMPLO[Math.floor(rt() * LUGARES_TEMPLO.length)]!; if (seq.at(-1) === l) l = LUGARES_TEMPLO[(LUGARES_TEMPLO.indexOf(l) + 1) % LUGARES_TEMPLO.length]!; seq.push(l); }
  const out: Ponto[] = []; let ant: { l: LugarTemplo; q: { x: number; z: number } } | null = null;
  seq.forEach((l, k) => {
    const enc = l.lugar(rt(), rt()), d = entre(ra, 1.5, 4), g = ra() * Math.PI * 2, q = { x: enc.x + Math.cos(g) * d, z: enc.z + Math.sin(g) * d };
    // (o canto de cada um tem que ser PISO do Templo: senão fica no ponto de encontro)
    const ok = alturaNoComplexo(q) !== null || Math.hypot(q.x, q.z) < 66 ? q : enc, w = doLayout(ok);
    out.push({ id: `templo-${l.id}#${k}`, ...w, templo: { sala: SALA_DO_LUGAR[l.id] ?? "salao", yRel: w.y - PISO - ALTURA_LOUNGE, andar: 0, q: ok }, estudo: false, olha: rumoNaSala(CIDADE.salas.lounge, Math.atan2(l.alvo.x - ok.x, l.alvo.z - ok.z)), fica: entre(rt, 150, 360), ...(ant ? { via: caminhoNoTemplo(ant.l, ant.q, l, ok) } : {}) });
    ant = { l, q: ok };
  });
  void turma; void ini;
  return out;
}
/** o CIRCUITO da corrida: um anel em volta da Zaeon por fora (raio 330 m, 40 m acima do piso), com uma ondulação */
export function noCircuito(evento: string, s: number): P3 & { rumo: number } {
  const r = acasoDe("circuito", evento), R = 330 + entre(r, -20, 30), fase = r() * Math.PI * 2, L = 2 * Math.PI * R;
  const a = fase + (s / L) * Math.PI * 2, c = CIDADE.centro;
  return { x: c.x + Math.cos(a) * R, y: PISO + 40 + Math.sin(a * 3) * 6, z: c.z + Math.sin(a) * R, rumo: Math.atan2(-Math.sin(a), Math.cos(a)) };
}

// ── as VIAGENS ─────────────────────────────────────────────────────────────────────────────────────────────────────
export type ModoViagem = "mochila" | "moto" | "pe";
type Viagem = { modo: ModoViagem; dur: number; em(u: number): P3 & { rumo: number; modo?: ModoViagem; /** dentro do TÚNEL cósmico (entre os níveis): não aparece */ oculto?: boolean }; rota?: { x: number; z: number }[];
  /** (com estacionamento, em s da viagem) até quando a moto ainda está PARADA na vaga de onde sai; desde quando já está
   *  parada na vaga de chegada */
  saida?: number; chegada?: number };
const rotasPe = new Map<string, { x: number; z: number }[]>();
/** um trecho de MOCHILA: o arco — sobe, voa reto, desce */
function deMochila(de: P3, para: P3): Viagem {
  const dist = Math.hypot(para.x - de.x, para.z - de.z), rumo = Math.atan2(para.x - de.x, para.z - de.z);
  const alto = 8 + 0.12 * dist + Math.max(0, para.y - de.y) * 0.15, dur = MOV.decola + MOV.pousa + dist / MOV.mochila;
  return { modo: "mochila", dur, em: (u) => ({ x: de.x + (para.x - de.x) * s3(u), z: de.z + (para.z - de.z) * s3(u), y: de.y + (para.y - de.y) * u + alto * Math.sin(Math.PI * u), rumo, modo: "mochila" }) };
}
/** um trecho de MOTO: sobe até o cruzeiro, vai reto, desce no destino */
function deMoto(de: P3, para: P3): Viagem {
  const dist = Math.hypot(para.x - de.x, para.z - de.z), rumo = Math.atan2(para.x - de.x, para.z - de.z);
  // subir/descer leva o tempo da ALTURA (no máximo ~20 m/s na vertical; no mínimo `sobeMoto`) — do céu da Zaeon até
  // um campus são ~300 m de descida
  const cruz = Math.max(de.y, para.y) + MOV.cruzeiroAcima, voo = dist / MOV.moto;
  const sobe = Math.max(MOV.sobeMoto, (cruz - de.y) / 20), desce = Math.max(MOV.sobeMoto, (cruz - para.y) / 20), dur = sobe + voo + desce;
  return { modo: "moto", dur, em: (u) => {
    const t = u * dur;
    if (t < sobe) { const k = s3(t / sobe); return { x: de.x, y: de.y + (cruz - de.y) * k, z: de.z, rumo, modo: "moto" }; }
    if (t < sobe + voo) { const k = (t - sobe) / voo; return { x: de.x + (para.x - de.x) * k, y: cruz, z: de.z + (para.z - de.z) * k, rumo, modo: "moto" }; }
    const k = s3((t - sobe - voo) / desce); return { x: para.x, y: cruz + (para.y - cruz) * k, z: para.z, rumo, modo: "moto" };
  } };
}
/** a pé por uma polilinha (com a altura de cada vértice) */
function pelaVia(via: readonly P3[]): Viagem {
  const acum = [0]; for (let k = 1; k < via.length; k++) acum.push(acum[k - 1]! + Math.hypot(via[k]!.x - via[k - 1]!.x, via[k]!.z - via[k - 1]!.z));
  const L = acum.at(-1)!, dur = Math.max(0.5, L / MOV.pe);
  return { modo: "pe", dur, em: (u) => {
    const s = L * Math.max(0, Math.min(1, u)); let k = 1; while (k < via.length - 1 && acum[k]! < s) k++;
    const a0 = via[k - 1]!, a1 = via[k]!, seg = Math.max(1e-6, acum[k]! - acum[k - 1]!), f = Math.max(0, Math.min(1, (s - acum[k - 1]!) / seg));
    return { x: a0.x + (a1.x - a0.x) * f, y: a0.y + (a1.y - a0.y) * f, z: a0.z + (a1.z - a0.z) * f, rumo: Math.atan2(a1.x - a0.x, a1.z - a0.z), modo: "pe" };
  } };
}
/** o caminho no TEMPLO (lib/cyber/frota/templo): a pé pelos trechos, de mochila nos saltos (a torre, a escadaria) */
function aPeNoTemplo(trechos: readonly TrechoTemplo[]): Viagem {
  const vs = trechos.map((t) => (t.salto ? deMochila(t.pts[0]!, t.pts.at(-1)!) : pelaVia(t.pts)));
  return vs.length ? vs.reduce(emSeguida) : { modo: "pe", dur: 0, em: () => ({ x: 0, y: 0, z: 0, rumo: 0, modo: "pe" }) };
}
/** (cacheado: o caminho de um lugar a outro não muda — e é pedido a cada quadro pra quem está andando à vista) */
const memoCaminho = new Map<string, Viagem>();
function caminhoEntre(de: LugarNoTemplo, para: LugarNoTemplo): Viagem {
  const k = `${de.sala}|${de.andar}|${de.q.x.toFixed(2)},${de.q.z.toFixed(2)}>${para.sala}|${para.andar}|${para.q.x.toFixed(2)},${para.q.z.toFixed(2)}`;
  let v = memoCaminho.get(k);
  if (!v) { v = aPeNoTemplo(caminhoPeloTemplo({ q: de.q, no: de }, { q: para.q, no: para })); memoCaminho.set(k, v); if (memoCaminho.size > 6000) memoCaminho.delete(memoCaminho.keys().next().value!); }
  return v;
}
/** a fração das trocas de SALA no Templo que vão DE MOTO (out/2026, o dono: "crie um fluxo de motos dentro desse mapa
 *  também") — o resto, a pé pelas pontes */
export const MOTO_NO_TEMPLO = 0.85;
/** a troca de sala no Templo DE MOTO: a pé até um chão aberto perto (céu livre), monta, sobe na VERTICAL até acima de
 *  tudo que está no caminho, cruza reto, desce na vertical perto de onde vai ficar e segue a pé */
const memoMotoT = new Map<string, Viagem>();
function deMotoNoTemplo(de: LugarNoTemplo, para: LugarNoTemplo, chave: string): Viagem {
  let v = memoMotoT.get(chave);
  if (v) return v;
  const r = acasoDe("moto-templo", chave), p0 = pousoPerto(de.sala === "salao" ? undefined : de, r), p1 = pousoPerto(para.sala === "salao" ? undefined : para, r);
  const a = noTemplo(p0), b = noTemplo(p1), cruz = doLayoutT(p0.q, cruzeiroNoTemplo(p0.q, p1.q, p0.yRel, p1.yRel)).y;
  const alto0 = { x: a.x, y: Math.max(cruz, a.y + 18), z: a.z }, alto1 = { x: b.x, y: alto0.y, z: b.z };
  const sobe: Viagem = { modo: "moto", dur: Math.max(2.5, (alto0.y - a.y) / 14), em: (u) => ({ x: a.x, y: a.y + (alto0.y - a.y) * s3(u), z: a.z, rumo: Math.atan2(b.x - a.x, b.z - a.z), modo: "moto" }) };
  const d = Math.hypot(b.x - a.x, b.z - a.z), rumo = Math.atan2(b.x - a.x, b.z - a.z);
  const cruza: Viagem = { modo: "moto", dur: Math.max(1, d / (MOV.moto * 0.45)), em: (u) => ({ x: alto0.x + (alto1.x - alto0.x) * s3(u), y: alto0.y, z: alto0.z + (alto1.z - alto0.z) * s3(u), rumo, modo: "moto" }) };
  v = [caminhoEntre(de, p0), motoParada(a, 1.2), sobe, cruza, desceNaVertical(alto1, b), motoParada(b, 1.2), caminhoEntre(p1, para)].reduce(emSeguida);
  memoMotoT.set(chave, v); if (memoMotoT.size > 3000) memoMotoT.delete(memoMotoT.keys().next().value!);
  return v;
}
/** um lugar do Templo no mundo (com o lugar junto) */
const noTemplo = (l: LugarNoTemplo): P3 => ({ ...doLayoutT(l.q, l.yRel), templo: l });
/** dois trechos seguidos (o modo de cada ponto vem no `em`) */
function emSeguida(a: Viagem, b: Viagem): Viagem {
  const dur = a.dur + b.dur;
  return { modo: a.modo, dur, em: (u) => { const t = u * dur; return t < a.dur ? a.em(a.dur > 0 ? t / a.dur : 1) : b.em(b.dur > 0 ? (t - a.dur) / b.dur : 1); } };
}
// ── a TRAVESSIA entre os NÍVEIS (o dono, out/2026: "o fluxo dos bots levando em conta a rotina — saindo da cidadela e
//    indo pros lounges"): as salas (o lounge = o Templo Cósmico) são níveis separados; a IA faz o caminho do JOGADOR —
//    vai de mochila até a BOCA do fio cósmico da sala no hub, some no fluxo (o túnel), SAI do buraco negro do outro
//    lado num arco e chega no ponto de chegada da sala (o salão), e de lá segue pro lugar dela. Voltando: a boca de
//    saída da sala (no salão) → o túnel → sai do portal da cidadela e chega na chegada do hub ──
/** quanto tempo (s) a IA fica "dentro do túnel" (sumida) entre os níveis */
export const TUNEL_IA = 4;
const nivelDe = (p: P3): IdNivel => nivelDoPonto(p, p.y);
const ehSalaNivel = (n: IdNivel): n is NomeSala => n === "lounge" || n === "garagem" || n === "biblioteca" || n === "jardim";
/** um trecho PARADO e sumido (no túnel) */
const noTunel = (em: P3): Viagem => ({ modo: "mochila", dur: TUNEL_IA, em: () => ({ ...em, rumo: 0, modo: "mochila", oculto: true }) });
/** SAINDO do buraco negro: de dentro dele (`de`) até o ponto de chegada, num arco (o `emergir` do jogador, mais calmo:
 *  ~55 m/s — o buraco negro de saída fica a centenas de metros) */
function emergindo(de: P3, para: P3 & { rumo?: number }, nivel: IdNivel): Viagem {
  const d = dist3(de, para), dur = Math.max(3, d / 55), rumo = para.rumo ?? Math.atan2(para.x - de.x, para.z - de.z);
  return { modo: "mochila", dur, em: (u) => { const k = 0.5 * u + 0.5 * s3(u), p = { x: de.x + (para.x - de.x) * k, y: de.y + (para.y - de.y) * k + Math.sin(Math.PI * u) * 6, z: de.z + (para.z - de.z) * k };
    return { ...p, rumo, modo: "mochila", oculto: nivelDoPonto(p, p.y) !== nivel }; } };   // (o buraco negro de saída fica fora do nível: só aparece ao entrar nele)
}
const noMundo = (l: { x: number; y: number; z: number }): P3 => ({ ...mundo(l), y: PISO + l.y });
/** SAINDO do buraco negro DE MOTO (o trânsito): o mesmo arco do `emergindo`, mais rápido, montado */
function emergindoDeMoto(de: P3, para: P3, nivel: IdNivel): Viagem {
  const d = dist3(de, para), dur = Math.max(2.5, d / MOV.moto), rumo = Math.atan2(para.x - de.x, para.z - de.z);
  return { modo: "moto", dur, em: (u) => { const k = s3(u), p = { x: de.x + (para.x - de.x) * k, y: de.y + (para.y - de.y) * u + Math.sin(Math.PI * u) * 8, z: de.z + (para.z - de.z) * k };
    return { ...p, rumo, modo: "moto", oculto: nivelDoPonto(p, p.y) !== nivel }; } };
}
/** a moto descendo na VERTICAL até o pouso (desacelerando) */
function desceNaVertical(de: P3, para: P3): Viagem {
  const dur = Math.max(2.5, (de.y - para.y) / 14), rumo = 0;
  return { modo: "moto", dur, em: (u) => ({ x: para.x, y: de.y + (para.y - de.y) * (1 - (1 - u) * (1 - u)), z: para.z, rumo, modo: "moto" }) };
}
/** a moto PARADA num ponto `dur` s (a IA montando — a moto se materializa — ou descendo) */
const motoParada = (p: P3, dur: number): Viagem => ({ modo: "moto", dur, em: () => ({ ...p, rumo: 0, modo: "moto" }) });
/** o TRÂNSITO DE MOTO (out/2026, o dono: "os de level 2 pra cima passeiam entre o lounge cósmico e a cidadela, não
 *  param muito, só passam de moto voando pra outros buracos negros"): de onde está, A PÉ até a boca de saída do
 *  Templo (no salão), MONTA e entra no buraco negro; SAI do portal da cidadela de moto, cruza a Zaeon VOANDO por cima
 *  da capela e mergulha no fio de uma sala (quase sempre a do Templo de novo); sai do buraco negro de lá e POUSA */
const SALAS_DO_TRANSITO: readonly (readonly [NomeSala, number])[] = [["lounge", 0.75], ["biblioteca", 0.1], ["jardim", 0.1], ["garagem", 0.05]];
export function transitoDeMoto(de: P3, agente: string, i: number, proximo?: LugarNoTemplo): { v: Viagem; fim: Ponto } {
  const r = acasoDe("transito", agente, i), pernas: Viagem[] = [];
  const nd = NIVEIS_SEPARADOS ? nivelDe(de) : "zaeon";
  if (ehSalaNivel(nd)) {   // 1) sai da sala: a pé até a boca (no Templo, pelas pontes), monta e some no túnel
    const boca = noMundo(saidaDaSala(nd).boca);
    pernas.push(nd === "lounge" && de.templo ? emSeguida(caminhoEntre(de.templo, BOCA_NO_TEMPLO), deMochila(noTemplo(BOCA_NO_TEMPLO), boca)) : deMochila(de, boca), motoParada(boca, 1.2), noTunel(boca));
    // 2) sai do portal da cidadela, já de moto, e sobe por cima da capela
    const portal = { ...mundo(CIDADE.portalTunel), y: PISO + 9 };
    const sobre = { x: CIDADE.centro.x + (r() - 0.5) * 90, y: PISO + 26 + r() * 14, z: CIDADE.centro.z + (r() - 0.5) * 90 };
    pernas.push(emergindoDeMoto(portal, sobre, "zaeon"));
    de = sobre;
  } else pernas.push(deMoto(de, { x: de.x, y: Math.max(de.y, PISO) + 24, z: de.z }));   // (na Zaeon: monta e sobe)
  // 3) o fio de uma sala: voa até a boca dele (no hub) e mergulha
  let x = r() * SALAS_DO_TRANSITO.reduce((a, [, p]) => a + p, 0), destino: NomeSala = "lounge";
  for (const [s, p] of SALAS_DO_TRANSITO) if ((x -= p) < 0) { destino = s; break; }
  const fio = fiosCosmicos().find((f) => f.sala === destino)!, boca = noMundo(fio.boca), aqui = pernas.length ? de : de;
  const d = dist3(aqui, boca), rumo = Math.atan2(boca.x - aqui.x, boca.z - aqui.z);
  pernas.push({ modo: "moto", dur: Math.max(1, d / MOV.moto), em: (u) => ({ x: aqui.x + (boca.x - aqui.x) * u, y: aqui.y + (boca.y - aqui.y) * s3(u), z: aqui.z + (boca.z - aqui.z) * u, rumo, modo: "moto" }) }, noTunel(boca));
  // 4) sai do buraco negro da sala de moto e POUSA (no Templo, num canto do salão; nas outras, perto da chegada)
  const bn = noMundo(saidaDaSala(destino).bn);
  let pouso: P3;
  if (destino === "lounge") pouso = noTemplo(pousoPerto(proximo, r));   // (pousa PERTO de onde vai ficar — qualquer chão aberto serve)
  else { const ch = NOS[destino].chegada, a = r() * Math.PI * 2; pouso = { x: ch.x + Math.cos(a) * (LIVRE_DO_POUSO + r() * 6), y: NOS[destino].y, z: ch.z + Math.sin(a) * (LIVRE_DO_POUSO + r() * 6) }; }
  // sai do buraco negro num arco até EM CIMA do pouso e DESCE na vertical (nada de cortar cobertura, cúpula ou laje)
  const acima = { x: pouso.x, y: pouso.y + 38, z: pouso.z };
  pernas.push(emergindoDeMoto(bn, acima, destino), desceNaVertical(acima, pouso), motoParada(pouso, 1.5));
  return { v: pernas.reduce(emSeguida), fim: { id: `pouso-${destino}`, ...pouso, estudo: false } };
}
/** quão longe da chegada (m) quem vem de moto pousa nas salas antigas */
const LIVRE_DO_POUSO = 9;
/** a viagem entre NÍVEIS diferentes (pelo menos um deles é uma sala): pelo hub, pelos buracos negros */
function travessia(de: P3, nDe: IdNivel, para: P3, nPara: IdNivel, flags: FlagsFrota, chave: string, preciso: boolean): Viagem {
  const pernas: Viagem[] = []; let aqui = de;
  if (ehSalaNivel(nDe)) {   // sai da sala: a boca de saída (no salão, no Templo) → o túnel → o portal da cidadela
    const boca = noMundo(saidaDaSala(nDe).boca), portal = { ...mundo(CIDADE.portalTunel), y: PISO + 9 }, ch = NOS.zaeon.chegada;
    // (no Templo, A PÉ até a boca — pelas pontes e pelo caracol; nas outras salas, de mochila)
    pernas.push(nDe === "lounge" && de.templo ? emSeguida(caminhoEntre(de.templo, BOCA_NO_TEMPLO), deMochila(noTemplo(BOCA_NO_TEMPLO), boca)) : deMochila(aqui, boca), noTunel(boca), emergindo(portal, { x: ch.x, y: PISO, z: ch.z, rumo: ch.rumo }, "zaeon"));
    aqui = { x: ch.x, y: PISO, z: ch.z };
  }
  if (ehSalaNivel(nPara)) {   // entra na sala: a boca do fio dela no hub → o túnel → sai do buraco negro dela → a chegada
    const fio = fiosCosmicos().find((f) => f.sala === nPara)!, boca = noMundo(fio.boca), bn = noMundo(saidaDaSala(nPara).bn), ch = NOS[nPara].chegada;
    const chegada = { x: ch.x, y: NOS[nPara].y, z: ch.z };
    // (chegando no Templo, a pé da chegada até o lugar)
    pernas.push(viagem(aqui, boca, flags, `${chave}|boca`, preciso), noTunel(boca), emergindo(bn, { ...chegada, rumo: ch.rumo }, nPara), nPara === "lounge" && para.templo ? caminhoEntre(CHEGADA_NO_TEMPLO, para.templo) : deMochila(chegada, para));
  } else pernas.push(viagem(aqui, para, flags, `${chave}|hub`, preciso));
  return pernas.reduce(emSeguida);
}
/** a viagem de A até B: mochila (dentro da Zaeon), moto (fora dela — saindo/chegando PELA GARAGEM) ou a pé (sem
 *  mochila, na central); entre NÍVEIS (as salas), pelos buracos negros (`travessia`) */
export function viagem(de: P3, para: P3, flags: FlagsFrota, chave: string, preciso = true): Viagem {
  // (por enquanto só o LOUNGE — o Templo Cósmico — vai pelos buracos negros; as outras salas seguem pelo ar)
  if (NIVEIS_SEPARADOS) { const nd = nivelDe(de), np = nivelDe(para); if (nd !== np && (nd === "lounge" || np === "lounge")) return travessia(de, nd, para, np, flags, chave, preciso); }
  // dentro do TEMPLO: a pé (as pontes, o caracol), nunca o arco de mochila atravessando as lajes
  if (de.templo && para.templo) {
    const longe = de.templo.sala !== para.templo.sala && Math.hypot(para.x - de.x, para.z - de.z) > 30;
    return longe && flags.moto && acasoDe("moto-templo?", chave)() < MOTO_NO_TEMPLO ? deMotoNoTemplo(de.templo, para.templo, chave) : caminhoEntre(de.templo, para.templo);
  }
  const dist = Math.hypot(para.x - de.x, para.z - de.z), dentroDe = naZaeon(de), dentroPara = naZaeon(para), dentro = dentroDe && dentroPara;
  if (dist < 0.5 && Math.abs(para.y - de.y) < 0.5) return { modo: "pe", dur: 0, em: () => ({ ...para, rumo: 0 }) };
  if (dentro && flags.mochila) return deMochila(de, para);
  if (dentro && Math.abs(para.y - de.y) < 1 && Math.abs(de.y - PISO) < 1) {   // a pé, na central (A* — só pra quem está à vista)
    let r = rotasPe.get(chave);
    if (!r && !preciso) r = [de, para];   // (de longe basta a reta — o A* só pra quem está à vista)
    if (!r) { const lr = rotaAPe(local(de), local(para)); r = (lr ?? [local(de), local(para)]).map((q) => mundo(q)); rotasPe.set(chave, r); if (rotasPe.size > 2000) rotasPe.delete(rotasPe.keys().next().value!); }
    // o TEMPO é o da reta × 1,35 (igual de perto e de longe — o A* só desenha o caminho), senão as duas contas
    // desencontravam e a IA "pulava" na troca de detalhe
    const L = comprimento(r), dur = (Math.hypot(para.x - de.x, para.z - de.z) * 1.35) / MOV.pe;
    return { modo: "pe", dur, rota: r, em: (u) => { const q = pontoNaRota(r!, L * u); return { x: q.x, y: de.y, z: q.z, rumo: q.rumo, modo: "pe" }; } };
  }
  if (dentro) return deMochila(de, para);   // (sem mochila mas mudando de andar: ainda assim pelo ar — nada de moto saindo de sala)
  // cruzando a borda da Zaeon: a moto é pega/largada na GARAGEM
  const g = pontoDaGaragem(chave);
  if (dentroDe) return emSeguida(deMochila(de, g), deMoto(g, para));
  if (dentroPara) return emSeguida(deMoto(de, g), deMochila(g, para));
  return deMoto(de, para);
}

/** a viagem com ESTACIONAMENTO: sai da vaga do lugar anterior (vai de mochila até ela) e/ou chega na vaga do destino
 *  (de lá, de mochila até o lugar). Sem moto parada dos dois lados: a viagem de sempre. Sem vaga de um lado: na Zaeon
 *  central a moto é pega/largada na GARAGEM; fora, ela se materializa/desfaz (components/cyber/FrotaIA) */
export function viagemComVaga(de: P3, vagaDe: VagaEstudo | null, para: P3, vagaPara: VagaEstudo | null, flags: FlagsFrota, chave: string, preciso = true): Viagem {
  if (!vagaDe && !vagaPara) return viagem(de, para, flags, chave, preciso);
  if (vagaDe && vagaPara && vagaDe.ambiente === vagaPara.ambiente) return viagem(de, para, flags, chave, preciso);   // (o mesmo lugar)
  const pernas: Viagem[] = [];
  let m0: P3, saida: number | undefined;
  if (vagaDe) { const a = deMochila(de, vagaDe); pernas.push(a); m0 = vagaDe; saida = a.dur; }
  else if (naZaeon(de)) { const g = pontoDaGaragem(chave); pernas.push(deMochila(de, g)); m0 = g; }
  else m0 = de;
  let m1: P3, cauda: Viagem | null = null;
  if (vagaPara) { m1 = vagaPara; cauda = deMochila(vagaPara, para); }
  else if (naZaeon(para)) { const g = pontoDaGaragem(chave); m1 = g; cauda = deMochila(g, para); }
  else m1 = para;
  pernas.push(deMoto(m0, m1)); if (cauda) pernas.push(cauda);
  const v = pernas.reduce(emSeguida);
  return { ...v, saida, chegada: vagaPara && cauda ? v.dur - cauda.dur : undefined };
}
/** a moto que ficou ESTACIONADA onde a IA pousou no trânsito do bloco anterior (no Templo): fica parada ali durante este
 *  bloco (a IA vai a pé pro lugar dela); no próximo, some — o trânsito seguinte chama outra */
function motoDoPouso(agente: string, blocos: readonly BlocoPlano[], i: number, flags: FlagsFrota): MotoNoChao | null {
  const a = blocos[i - 1];
  if (!a || !a.transito || a.fim < blocos[i]!.ini - 1 || blocos[i]!.transito) return null;
  const mv = movimentoCache(agente, blocos, i - 1, flags, false), f = mv.pouso ?? mv.fim; if (!f.templo) return null;
  return motoNoChao(f);
}
const motoNoChao = (f: Ponto): MotoNoChao => {
  return { ambiente: "templo", i: Math.abs(Math.round(f.x * 7 + f.z * 13)), x: f.x, y: f.y, z: f.z, rumo: (Math.abs(Math.round(f.x + f.z)) % 628) / 100, zaeon: true };
}
/** a vaga onde a moto ficou no bloco ANTERIOR (se ele encosta neste) */
const vagaAnterior = (blocos: readonly BlocoPlano[], i: number) => (i > 0 && blocos[i - 1]!.fim >= blocos[i]!.ini - 1 ? blocos[i - 1]!.vaga ?? null : null);
/** qual moto parada é dela no instante `u` (s) de uma viagem `v` com estacionamento */
const motoParadaNa = (v: Viagem, u: number, vagaDe: VagaEstudo | null, vagaPara: VagaEstudo | null): VagaEstudo | null =>
  vagaDe && v.saida !== undefined && u < v.saida ? vagaDe : vagaPara && v.chegada !== undefined && u >= v.chegada ? vagaPara : null;

/** o ESTADO de uma IA no minuto `min` (do dia). `musica` = está rolando som no lounge agora */
export function estadoDaIA(agente: string, blocos: readonly BlocoPlano[], min: number, flags: FlagsFrota, musica: boolean, preciso = true): EstadoIA {
  const e = estadoDoBloco(agente, blocos, min, flags, musica, preciso);
  if (!e.visivel || e.vagaMoto || e.pose === "moto" || e.bloco < 0) return e;
  const p = motoDoPouso(agente, blocos, e.bloco, flags);   // (a moto que ficou onde ela pousou)
  return p ? { ...e, vagaMoto: p } : e;
}
function estadoDoBloco(agente: string, blocos: readonly BlocoPlano[], min: number, flags: FlagsFrota, musica: boolean, preciso: boolean): EstadoIA {
  const i = blocos.findIndex((b) => min >= b.ini && min < b.fim);
  if (i < 0) return OFFLINE;
  const b = blocos[i]!, t = (min - b.ini) * 60, durBloco = (b.fim - b.ini) * 60;
  if (b.atividade === "festa" && !musica) return OFFLINE;   // a festa só acontece com som
  const ant = antDoBloco(agente, blocos, i, flags), vAnt = vagaAnterior(blocos, i), vAqui = b.vaga ?? null;
  const base = { visivel: true, bloco: i, atividade: b.atividade, ambiente: b.ambiente ?? null, evento: b.evento ?? null, sentar: 0, tablet: 0, assentoY: 0.7, moto: null, vagaMoto: null };
  const comViagem = (destino: P3, ini: number): { fim: number; estado?: EstadoIA } => {
    const v = viagemComVaga(ant, vAnt, destino, vAqui, flags, `${agente}|${i}|${destino.x.toFixed(1)}`, preciso), d = Math.min(v.dur, durBloco * 0.6);
    if (t - ini >= d) return { fim: ini + d };
    const u = d > 0 ? (t - ini) / d : 1, p = v.em(u), modo = p.modo ?? v.modo;
    return { fim: ini + d, estado: { ...base, visivel: !p.oculto, x: p.x, y: p.y, z: p.z, rumo: p.rumo, zaeon: naZaeon(p), pose: poseDoModo(modo), moto: modo === "moto" ? { vel: MOV.moto, curva: 0 } : null, vagaMoto: motoParadaNa(v, u * v.dur, vAnt, vAqui) } };
  };
  // ESTUDO e FESTA: viaja, senta (ou dança) e fica
  if (b.spot) {
    const s: Spot = b.spot, alvo = b.deitado && s.deita ? s.deita : s, destino: P3 = { x: alvo.x, y: s.y, z: alvo.z, ...(s.templo ? { templo: s.templo } : {}) };
    const v = comViagem(destino, 0); if (v.estado) return v.estado;
    const jaLa = dist3(ant, destino) < 0.05;   // (veio do trânsito e já sentou no fim dele: não levanta e senta de novo)
    const kf = t - v.fim + (jaLa ? MOV.senta + MOV.tabletIn : 0), fimSentar = durBloco - (t - v.fim);   // (levanta no fim, junto com a próxima viagem)
    const sentar = Math.min(s3(kf / MOV.senta), s3(fimSentar / MOV.senta));
    if (b.atividade === "festa") return { ...base, x: s.x, y: s.y, z: s.z, rumo: s.rumo, zaeon: s.zaeon, pose: "danca", vagaMoto: vAqui };
    // (numa roda DE PÉ — `pe`: conversando, sem sentar e sem o tablet)
    if (s.tipo === "pe") return { ...base, vagaMoto: vAqui, x: s.x, y: s.y, z: s.z, rumo: s.rumo, zaeon: s.zaeon, pose: "parado" };
    const pose: PoseIA = b.deitado ? "deitado" : s.tipo === "pufe" ? "relaxa" : s.tipo === "piso" ? "chao" : "sentado";
    // (na CABINE da cidadela: na cadeira, de frente pro monitor — sem o tablet)
    return { ...base, vagaMoto: vAqui, x: alvo.x, y: s.y, z: alvo.z, rumo: alvo.rumo, zaeon: s.zaeon, pose, sentar, tablet: s.tipo === "cabine" ? 0 : s3((kf - MOV.senta) / MOV.tabletIn) * s3(fimSentar / MOV.tabletIn), assentoY: s.tipo === "sofa" ? 0.78 : s.tipo === "pufe" ? 0.74 : s.tipo === "puff" ? 0.7 : s.tipo === "trono" ? 0.76 : s.tipo === "cabine" ? 0.56 : 0 };
  }
  // CORRIDA / MOTO / ANDAR: a ida + (a corrida) + o roteiro já cortado pro tempo do bloco (`movimento`)
  if (b.atividade === "moto" || b.atividade === "andar") {
    const mv = movimentoCache(agente, blocos, i, flags, preciso), base0 = base;
    const estadoDe = (p: P3 & { rumo: number; modo?: ModoViagem; oculto?: boolean }, modo: ModoViagem): EstadoIA => ({ ...base, visivel: !p.oculto, x: p.x, y: p.y, z: p.z, rumo: p.rumo, zaeon: naZaeon(p), pose: poseDoModo(modo), moto: modo === "moto" ? { vel: MOV.moto, curva: 0.15 } : null });
    if (t < mv.idaDur) { const u = t / mv.idaDur, p = mv.ida.em(u); return { ...estadoDe(p, p.modo ?? mv.ida.modo), vagaMoto: motoParadaNa(mv.ida, u * mv.ida.dur, vAnt, null) }; }
    let k = t - mv.idaDur;
    if (mv.corrida) {   // dá voltas com a turma (cada um no seu ritmo e na sua faixa)
      const c = mv.corrida;
      if (k < c.dur) { const sAt = (k / MOV.corridaVolta) * 2 * Math.PI * 330 * c.ritmo, p = noCircuito(b.evento!, sAt); return { ...base, x: p.x + Math.cos(p.rumo) * c.faixa, y: p.y, z: p.z - Math.sin(p.rumo) * c.faixa, rumo: p.rumo, zaeon: true, pose: "moto", moto: { vel: MOV.moto * c.ritmo, curva: 0.3 } }; }
      k -= c.dur;
    }
    if (mv.segue) {   // (o trânsito pousou no Templo: a pé até o lugar do próximo bloco, e já senta pra estudar)
      const s = mv.segue.spot, base = { ...base0, vagaMoto: motoNoChao(mv.pouso!) }, d = Math.min(mv.segue.v.dur, Math.max(1, mv.disponivel * 0.9)), kk = t - mv.idaDur;
      if (kk < d) { const p = mv.segue.v.em(kk / d), modo = p.modo ?? mv.segue.v.modo; return { ...base, x: p.x, y: p.y, z: p.z, rumo: p.rumo, zaeon: naZaeon(p), pose: poseDoModo(modo) }; }
      if (s.tipo === "pe") return { ...base, x: s.x, y: s.y, z: s.z, rumo: s.rumo, zaeon: s.zaeon, pose: "parado" };
      const kf = kk - d;
      return { ...base, atividade: "estudo-lounge", ambiente: "lounge", x: s.x, y: s.y, z: s.z, rumo: s.rumo, zaeon: s.zaeon, pose: s.tipo === "piso" ? "chao" : "sentado", sentar: s3(kf / MOV.senta), tablet: s.tipo === "cabine" ? 0 : s3((kf - MOV.senta) / MOV.tabletIn), assentoY: s.tipo === "cabine" ? 0.56 : 0 };
    }
    if (!mv.trechos.length) { const f = mv.fim; return b.atividade === "moto" && !b.transito ? { ...base, x: f.x, y: f.y, z: f.z, rumo: 0, zaeon: naZaeon(f), pose: "moto", moto: { vel: 0, curva: 0 } } : { ...base, x: f.x, y: f.y, z: f.z, rumo: 0, zaeon: true, pose: "parado" }; }
    const r = percorrer(mv.trechos, k, mv.disponivel);
    if (r.em === "parada") return { ...base, x: r.q.x, y: r.q.y, z: r.q.z, rumo: r.q.rumo, zaeon: naZaeon(r.q), pose: "parado" };   // (moto: de pé ao lado de onde pousou)
    const e = estadoDe(r.p, r.p.modo ?? r.v.modo);
    if (mv.corrida) { e.x += Math.cos(r.p.rumo) * mv.corrida.faixa * 2.5; e.z -= Math.sin(r.p.rumo) * mv.corrida.faixa * 2.5; }   // depois da corrida: em BANDO, cada um na sua faixa
    return e;
  }
  // (um bloco sem lugar — o plano não achou assento): não aparece, em vez de ficar parado na chegada com outros
  return OFFLINE;
}
const poseDoModo = (m: ModoViagem): PoseIA => (m === "moto" ? "moto" : m === "mochila" ? "mochila" : "andando");
/** o MOVIMENTO de um bloco de moto/andar: a IDA (até o 1º ponto do roteiro — da Zaeon, pela garagem; comprimida em
 *  até 60 % do bloco), a CORRIDA (se for), e os trechos do roteiro CORTADOS pra caber no resto (`disponivel`) — o fim
 *  do último trecho é o fim do bloco */
type Movimento = { ida: Viagem; idaDur: number; corrida: { dur: number; ritmo: number; faixa: number } | null; trechos: Trecho[]; disponivel: number; fim: Ponto;
  /** (trânsito) onde a moto pousou — e, se o próximo bloco é num lugar do Templo, o caminho a pé até ele: a IA já vai
   *  pra lá e senta pra estudar (nada de ficar parada ao lado da moto até o bloco acabar) */
  pouso?: Ponto; segue?: { v: Viagem; spot: Spot } };
function movimento(agente: string, blocos: readonly BlocoPlano[], i: number, flags: FlagsFrota, preciso: boolean): Movimento {
  const b = blocos[i]!, durBloco = (b.fim - b.ini) * 60, ant = antDoBloco(agente, blocos, i, flags);
  if (b.atividade === "moto" && b.transito) {   // o TRÂNSITO: a viagem inteira (sem roteiro de passeio); depois, de pé onde pousou
    const prox = blocos[i + 1], spot = prox && prox.ini <= b.fim + 1 ? prox.spot : undefined;
    const t = transitoDeMoto(ant, agente, i, spot?.templo), idaDur = Math.min(t.v.dur, durBloco * 0.92);
    if (spot?.templo && t.fim.templo) {
      const fim: Ponto = { id: spot.id, x: spot.x, y: spot.y, z: spot.z, estudo: true, templo: spot.templo };
      return { ida: t.v, idaDur, corrida: null, trechos: [], disponivel: durBloco - idaDur, fim, pouso: t.fim, segue: { v: caminhoEntre(t.fim.templo, spot.templo), spot } };
    }
    return { ida: t.v, idaDur, corrida: null, trechos: [], disponivel: durBloco - idaDur, fim: t.fim };
  }
  if (b.atividade === "moto") {
    const rot = roteiroMoto(b, agente, i);
    if (b.evento?.startsWith("corrida")) {
      const r = acasoDe("piloto", agente, b.evento), ritmo = entre(r, 0.94, 1.06), faixa = entre(r, -4, 4);
      const ida = viagemComVaga(ant, vagaAnterior(blocos, i), noCircuito(b.evento, 0), null, flags, `${agente}|${i}|corrida`, preciso), idaDur = Math.min(ida.dur, durBloco * 0.6);
      const dur = Math.min(MOV.corridaMax, (durBloco - idaDur) * 0.5), fimC = noCircuito(b.evento, (dur / MOV.corridaVolta) * 2 * Math.PI * 330 * ritmo);
      const disponivel = durBloco - idaDur - dur, trechos = cortar(trechosDoCeu(rot, fimC, false, agente, i, true), disponivel);
      return { ida, idaDur, corrida: { dur, ritmo, faixa }, trechos, disponivel, fim: trechos.at(-1)?.ate ?? { id: "corrida", ...fimC, estudo: false } };
    }
    const ida = viagemComVaga(ant, vagaAnterior(blocos, i), rot[0]!.p, null, { ...flags, mochila: false }, `${agente}|${i}|m0`, preciso), idaDur = Math.min(ida.dur, durBloco * 0.6);
    const disponivel = durBloco - idaDur, trechos = cortar(trechosDoCeu(rot, rot[0]!.p, false, agente, i), disponivel);
    return { ida, idaDur, corrida: null, trechos, disponivel, fim: trechos.at(-1)?.ate ?? rot[0]!.p };
  }
  const rot = roteiroAndar(b, agente, i);
  const ida = viagemComVaga(ant, vagaAnterior(blocos, i), rot[0]!, null, flags, `${agente}|${i}|a0`, preciso), idaDur = Math.min(ida.dur, durBloco * 0.6);
  const todos: Trecho[] = [];
  for (let j = 1; j < rot.length; j++) {
    const de = rot[j - 1]!, p = rot[j]!, reta = Math.hypot(p.x - de.x, p.z - de.z), dur = (reta * 1.35) / MOV.pe, chave = `${agente}|${i}|a${j}`;
    if (p.via) {   // (nos LOUNGES: o caminho já vem pronto, pelas pontes e escadas — a altura muda junto)
      const via = p.via, acum = [0]; for (let k = 1; k < via.length; k++) acum.push(acum[k - 1]! + Math.hypot(via[k]!.x - via[k - 1]!.x, via[k]!.z - via[k - 1]!.z));
      const L = acum.at(-1)!, durV = Math.max(1, L / MOV.pe);
      const v: Viagem = { modo: "pe", dur: durV, em: (u) => {
        const s = L * Math.max(0, Math.min(1, u)); let k = 1; while (k < via.length - 1 && acum[k]! < s) k++;
        const a0 = via[k - 1]!, a1 = via[k]!, seg = Math.max(1e-6, acum[k]! - acum[k - 1]!), f = Math.max(0, Math.min(1, (s - acum[k - 1]!) / seg));
        return { x: a0.x + (a1.x - a0.x) * f, y: a0.y + (a1.y - a0.y) * f, z: a0.z + (a1.z - a0.z) * f, rumo: Math.atan2(a1.x - a0.x, a1.z - a0.z), modo: "pe" };
      } };
      todos.push({ v, fica: p.fica ?? 30, ate: p, parada: () => ({ x: p.x, y: p.y, z: p.z, rumo: p.olha ?? 0 }) });
      continue;
    }
    const v: Viagem = { modo: "pe", dur, em: (u) => {
      let rota = rotasPe.get(chave);
      if (!rota && preciso) { const lr = rotaAPe(local(de), local(p)); rota = (lr ?? [local(de), local(p)]).map((q) => mundo(q)); rotasPe.set(chave, rota); if (rotasPe.size > 2000) rotasPe.delete(rotasPe.keys().next().value!); }
      rota ??= [de, p];
      const L = comprimento(rota), q = pontoNaRota(rota, L * u); return { x: q.x, y: PISO, z: q.z, rumo: q.rumo, modo: "pe" };
    } };
    // a parada: no ponto, virada pro que está vendo (o telão, o globo) — o próximo trecho sai dali
    todos.push({ v, fica: p.fica ?? 30, ate: p, parada: () => ({ x: p.x, y: p.y, z: p.z, rumo: p.olha ?? 0 }) });
  }
  // a CHEGADA conta como a 1ª parada (fica no 1º ponto antes de ir pro 2º): um trecho parado no lugar
  const p0 = rot[0]!, chegada: Trecho = { v: { modo: "pe", dur: 0, em: () => ({ x: p0.x, y: p0.y, z: p0.z, rumo: p0.olha ?? 0, modo: "pe" }) }, fica: p0.fica ?? 30, ate: p0, parada: () => ({ x: p0.x, y: p0.y, z: p0.z, rumo: p0.olha ?? 0 }) };
  const disponivel = durBloco - idaDur, trechos = cortar([chegada, ...todos], disponivel);
  return { ida, idaDur, corrida: null, trechos, disponivel, fim: trechos.at(-1)?.ate ?? p0 };
}
/** um canto em volta de um ponto do passeio (2–9 m, cada IA no seu, virada pro ponto) — ninguém empilhado */
function cantoEmVolta(p: P3, agente: string, chave: number): { x: number; z: number; rumo: number } {
  const r = acasoDe("canto", agente, chave), a = r() * Math.PI * 2, d = entre(r, 2, 9);
  return { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d, rumo: Math.atan2(-Math.cos(a), -Math.sin(a)) };
}
/** parado num lugar visitado: num ponto do CHÃO da plataforma (`spotsDe` — no disco, fora de prédios e mesas), cada IA no
 *  dela pelo hash (são ~160 por plataforma: o bolo de gente num ponto só acabou); na praça, num canto de até 16 m */
function paradoPerto(base: Omit<EstadoIA, "x" | "y" | "z" | "rumo" | "zaeon" | "pose">, p: P3, agente: string, chave: number, _k: number): EstadoIA {
  const id = (p as Partial<Ponto>).id, r = acasoDe("perto", agente, chave);
  const chao = id && id in PLATAFORMAS && id !== "solana" ? spotsDe(id as Parameters<typeof spotsDe>[0]) : null;
  // (AO LADO do ponto, não em cima: os pontos de chão também são de quem está ESTUDANDO ali)
  if (chao?.length) { const s = chao[Math.floor(r() * chao.length)]!, a = r() * Math.PI * 2, d = entre(r, 1, 1.6); return { ...base, x: s.x + Math.cos(a) * d, y: s.y, z: s.z + Math.sin(a) * d, rumo: s.rumo, zaeon: false, pose: "parado" }; }
  const a = r() * Math.PI * 2, d = entre(r, 3, 16);
  return { ...base, x: p.x + Math.cos(a) * d, y: p.y, z: p.z + Math.sin(a) * d, rumo: a + Math.PI, zaeon: naZaeon(p), pose: "parado" };
}
