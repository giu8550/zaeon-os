/**
 * Frota de IAs — o CORPO no instante (PURO, determinístico): dado o plano do dia de uma IA e o minuto, onde ela está e o
 * que o corpo faz. Cada bloco = VIAGEM até o lugar (no começo do bloco) + a ATIVIDADE lá:
 *  - viagem DENTRO da Zaeon (central e salas): de MOCHILA A JATO (um arco por cima das coisas — sem lotar os fios dos
 *    jogadores); sem mochila (flag), a pé na central e de moto pras salas;
 *  - viagem pra FORA (universidades, praça, Solana): de MOTO, voando alto; a moto SOME ao chegar num lugar de estudo
 *    (pra não lotar de motos);
 *  - ESTUDO: senta no lugar (sofá, pufe — a pose relaxada —, puff, ou no chão de perna cruzada; às vezes deita no sofá)
 *    e estuda no TABLET;
 *  - MOTO (o passeio): voa até 2–3 lugares do mapa e fica um tempo em cada (andando por ali); na CORRIDA, o grupo dá
 *    voltas juntos num circuito em volta da Zaeon e depois para junto num lugar;
 *  - ANDAR: passeia pela Zaeon (a pé; trechos longos de mochila), parando pra olhar as coisas;
 *  - FESTA: dança na pista do lounge (só se estiver rolando som — senão já foi embora).
 * Fora dos blocos: offline (não aparece). Coordenadas do MUNDO; `zaeon` = está na ilha/salas (o engine soma a boia).
 */
import { CIDADE, mundo } from "../ceu";
import { comprimento, pontoNaRota, rotaAPe } from "../caminhos";
import { NOS } from "../buracos";
import { PLATAFORMAS } from "../plataformas";
import { PRACA } from "../praca";
import { MIRANTES } from "../terra";
import { acasoDe, entre, inteiro, embaralhar } from "./aleatorio";
import type { FlagsFrota } from "./agenda";
import type { BlocoPlano } from "./plano";
import type { Spot } from "./lugares";

type P3 = { x: number; y: number; z: number };
export type PoseIA = "andando" | "parado" | "mochila" | "moto" | "sentado" | "deitado" | "relaxa" | "chao" | "danca";
export type EstadoIA = {
  visivel: boolean; x: number; y: number; z: number; rumo: number; zaeon: boolean;
  pose: PoseIA;
  /** peso de sentar (0..1: abaixando/levantando), o tablet (0..1: materializando) e a altura do assento */
  sentar: number; tablet: number; assentoY: number;
  /** a moto (quando está nela) */
  moto: { vel: number; curva: number } | null;
  /** índice do bloco e o tipo de atividade (pra conversa e debug) */
  bloco: number; atividade: BlocoPlano["atividade"] | null; ambiente: string | null; evento: string | null;
};
export const OFFLINE: EstadoIA = { visivel: false, x: 0, y: 0, z: 0, rumo: 0, zaeon: false, pose: "parado", sentar: 0, tablet: 0, assentoY: 0.7, moto: null, bloco: -1, atividade: null, ambiente: null, evento: null };

/** as velocidades (m/s) e os tempos (s) */
export const MOV = { pe: 1.5, mochila: 13, moto: 34, decola: 3.5, pousa: 3.5, sobeMoto: 5, cruzeiroAcima: 28, senta: 0.8, tabletIn: 0.9, corridaVolta: 110, corridaMax: 8 * 60, rodaZaeonMax: 120 } as const;

const PISO = CIDADE.pisoY;
const local = (p: { x: number; z: number }) => ({ x: p.x - CIDADE.centro.x, z: p.z - CIDADE.centro.z });
const naZaeon = (p: { x: number; z: number }) => Math.hypot(p.x - CIDADE.centro.x, p.z - CIDADE.centro.z) < 520;
const s3 = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };

/** os pontos de VISITA de moto pelo mapa (fora da Zaeon) e os de PASSEIO a pé na Zaeon (central) */
type Ponto = P3 & { id: string; estudo: boolean };
const VISITAS: Ponto[] = [
  ...(["univ", "ufc", "unifor", "uece", "solana"] as const).map((id) => { const P = PLATAFORMAS[id]; return { id, x: P.chegada.x, y: P.y, z: P.chegada.z, estudo: id !== "solana" }; }),
  { id: "praca", x: PRACA.x + 18, y: PRACA.y, z: PRACA.z + 12, estudo: false },
];
const PASSEIO_ZAEON: Ponto[] = [
  ...MIRANTES.map((m, i) => { const w = mundo({ x: m.x * 0.82, z: m.z * 0.82 }); return { id: `mirante-${i}`, x: w.x, y: PISO, z: w.z, estudo: false }; }),
  ...[0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * Math.PI * 2 + 0.4, w = mundo({ x: Math.cos(a) * 95, z: Math.sin(a) * 95 }); return { id: `praca-zaeon-${k}`, x: w.x, y: PISO, z: w.z, estudo: false }; }),
];
const CHEGADA: P3 = { x: NOS.zaeon.chegada.x, y: PISO, z: NOS.zaeon.chegada.z };

/** onde a IA está ao TERMINAR um bloco (a próxima viagem sai daqui) */
function fimDoBloco(b: BlocoPlano, a: string, iBloco: number): Ponto {
  if (b.spot) { const p = b.deitado && b.spot.deita ? b.spot.deita : b.spot; return { id: b.spot.id, x: p.x, y: b.spot.y, z: p.z, estudo: true }; }
  if (b.atividade === "moto") return roteiroMoto(b, a, iBloco).at(-1)!.p;
  if (b.atividade === "andar") return roteiroAndar(b, a, iBloco).at(-1)!;
  return { id: "chegada", ...CHEGADA, estudo: false };
}

// ── os ROTEIROS (determinísticos por agente+bloco) ─────────────────────────────────────────────────────────────────
type Parada = { p: Ponto; fica: number };   // (s)
/** o passeio de moto: 2–3 lugares, ficando 4–12 min em cada (o resto do tempo é voo) */
export function roteiroMoto(b: BlocoPlano, a: string, iBloco: number): Parada[] {
  const r = acasoDe("moto", b.evento ?? a, b.evento ? 0 : iBloco), n = inteiro(r, 2, 3), lista = embaralhar(r, VISITAS).slice(0, n);
  return lista.map((p) => ({ p, fica: entre(r, 4, 12) * 60 }));
}
/** o passeio a pé pela Zaeon: 3–5 pontos (mirantes, a praça interna), parando 2–6 min em cada */
export function roteiroAndar(b: BlocoPlano, a: string, iBloco: number): Ponto[] {
  const r = acasoDe("andar", a, iBloco), n = inteiro(r, 3, 5);
  return embaralhar(r, PASSEIO_ZAEON).slice(0, n);
}
/** o CIRCUITO da corrida: um anel em volta da Zaeon por fora (raio 330 m, 40 m acima do piso), com uma ondulação */
export function noCircuito(evento: string, s: number): P3 & { rumo: number } {
  const r = acasoDe("circuito", evento), R = 330 + entre(r, -20, 30), fase = r() * Math.PI * 2, L = 2 * Math.PI * R;
  const a = fase + (s / L) * Math.PI * 2, c = CIDADE.centro;
  return { x: c.x + Math.cos(a) * R, y: PISO + 40 + Math.sin(a * 3) * 6, z: c.z + Math.sin(a) * R, rumo: Math.atan2(-Math.sin(a), Math.cos(a)) };
}

// ── as VIAGENS ─────────────────────────────────────────────────────────────────────────────────────────────────────
type Viagem = { modo: "mochila" | "moto" | "pe"; dur: number; em(u: number): P3 & { rumo: number }; rota?: { x: number; z: number }[] };
const rotasPe = new Map<string, { x: number; z: number }[]>();
/** a viagem de A até B: mochila (dentro da Zaeon), moto (pra fora) ou a pé (sem mochila, na central) */
export function viagem(de: P3, para: P3, flags: FlagsFrota, chave: string, preciso = true): Viagem {
  const dist = Math.hypot(para.x - de.x, para.z - de.z), dentro = naZaeon(de) && naZaeon(para);
  if (dist < 0.5 && Math.abs(para.y - de.y) < 0.5) return { modo: "pe", dur: 0, em: () => ({ ...para, rumo: 0 }) };
  const rumo = Math.atan2(para.x - de.x, para.z - de.z);
  if (dentro && flags.mochila) {   // o ARCO de mochila: sobe, voa reto, desce
    const alto = 8 + 0.12 * dist + Math.max(0, para.y - de.y) * 0.15, dur = MOV.decola + MOV.pousa + dist / MOV.mochila;
    return { modo: "mochila", dur, em: (u) => ({ x: de.x + (para.x - de.x) * s3(u), z: de.z + (para.z - de.z) * s3(u), y: de.y + (para.y - de.y) * u + alto * Math.sin(Math.PI * u), rumo }) };
  }
  if (dentro && Math.abs(para.y - de.y) < 1 && Math.abs(de.y - PISO) < 1) {   // a pé, na central (A* — só pra quem está à vista)
    let r = rotasPe.get(chave);
    if (!r && !preciso) r = [de, para];   // (de longe basta a reta — o A* só pra quem está à vista)
    if (!r) { const lr = rotaAPe(local(de), local(para)); r = (lr ?? [local(de), local(para)]).map((q) => mundo(q)); rotasPe.set(chave, r); if (rotasPe.size > 2000) rotasPe.delete(rotasPe.keys().next().value!); }
    const L = comprimento(r);
    return { modo: "pe", dur: L / MOV.pe, rota: r, em: (u) => { const q = pontoNaRota(r!, L * u); return { x: q.x, y: de.y, z: q.z, rumo: q.rumo }; } };
  }
  // de MOTO: sobe até o cruzeiro, vai reto, desce no destino
  const cruz = Math.max(de.y, para.y) + MOV.cruzeiroAcima, voo = dist / MOV.moto, dur = MOV.sobeMoto * 2 + voo;
  return { modo: "moto", dur, em: (u) => {
    const t = u * dur;
    if (t < MOV.sobeMoto) { const k = s3(t / MOV.sobeMoto); return { x: de.x, y: de.y + (cruz - de.y) * k, z: de.z, rumo }; }
    if (t < MOV.sobeMoto + voo) { const k = (t - MOV.sobeMoto) / voo; return { x: de.x + (para.x - de.x) * k, y: cruz, z: de.z + (para.z - de.z) * k, rumo }; }
    const k = s3((t - MOV.sobeMoto - voo) / MOV.sobeMoto); return { x: para.x, y: cruz + (para.y - cruz) * k, z: para.z, rumo };
  } };
}

/** o ESTADO de uma IA no minuto `min` (do dia). `musica` = está rolando som no lounge agora */
export function estadoDaIA(agente: string, blocos: readonly BlocoPlano[], min: number, flags: FlagsFrota, musica: boolean, preciso = true): EstadoIA {
  const i = blocos.findIndex((b) => min >= b.ini && min < b.fim);
  if (i < 0) return OFFLINE;
  const b = blocos[i]!, t = (min - b.ini) * 60, durBloco = (b.fim - b.ini) * 60;
  if (b.atividade === "festa" && !musica) return OFFLINE;   // a festa só acontece com som
  const ant = i > 0 && blocos[i - 1]!.fim >= b.ini - 1 ? fimDoBloco(blocos[i - 1]!, agente, i - 1) : { id: "chegada", ...CHEGADA, estudo: false };
  const base = { visivel: true, bloco: i, atividade: b.atividade, ambiente: b.ambiente ?? null, evento: b.evento ?? null, sentar: 0, tablet: 0, assentoY: 0.7, moto: null };
  const comViagem = (destino: P3, ini: number): { fim: number; estado?: EstadoIA } => {
    const v = viagem(ant, destino, flags, `${agente}|${i}|${destino.x.toFixed(1)}`, preciso), d = Math.min(v.dur, durBloco * 0.6);
    if (t - ini >= d) return { fim: ini + d };
    const p = v.em(d > 0 ? (t - ini) / d : 1);
    return { fim: ini + d, estado: { ...base, x: p.x, y: p.y, z: p.z, rumo: p.rumo, zaeon: naZaeon(p), pose: v.modo === "moto" ? "moto" : v.modo === "mochila" ? "mochila" : "andando", moto: v.modo === "moto" ? { vel: MOV.moto, curva: 0 } : null } };
  };
  // ESTUDO e FESTA: viaja, senta (ou dança) e fica
  if (b.spot) {
    const s: Spot = b.spot, alvo = b.deitado && s.deita ? s.deita : s, destino = { x: alvo.x, y: s.y, z: alvo.z };
    const v = comViagem(destino, 0); if (v.estado) return v.estado;
    const kf = t - v.fim, fimSentar = durBloco - kf;   // (levanta no fim, junto com a próxima viagem)
    const sentar = Math.min(s3(kf / MOV.senta), s3(fimSentar / MOV.senta));
    if (b.atividade === "festa") return { ...base, x: s.x, y: s.y, z: s.z, rumo: s.rumo, zaeon: s.zaeon, pose: "danca" };
    const pose: PoseIA = b.deitado ? "deitado" : s.tipo === "pufe" ? "relaxa" : s.tipo === "piso" ? "chao" : "sentado";
    return { ...base, x: alvo.x, y: s.y, z: alvo.z, rumo: alvo.rumo, zaeon: s.zaeon, pose, sentar, tablet: s3((kf - MOV.senta) / MOV.tabletIn) * s3(fimSentar / MOV.tabletIn), assentoY: s.tipo === "sofa" ? 0.78 : s.tipo === "pufe" ? 0.74 : s.tipo === "puff" ? 0.7 : 0 };
  }
  // CORRIDA: vai até o circuito, dá voltas com a turma (até 8 min) e depois para junto num lugar
  if (b.atividade === "moto" && b.evento?.startsWith("corrida")) {
    const r = acasoDe("piloto", agente, b.evento), ritmo = entre(r, 0.94, 1.06), faixa = entre(r, -4, 4);
    const largada = noCircuito(b.evento, 0), v = comViagem(largada, 0); if (v.estado) return v.estado;
    const kc = t - v.fim, corrida = Math.min(MOV.corridaMax, durBloco * 0.5);
    if (kc < corrida) {
      const sAt = (kc / MOV.corridaVolta) * 2 * Math.PI * 330 * ritmo, p = noCircuito(b.evento, sAt), lx = Math.cos(p.rumo), lz = -Math.sin(p.rumo);
      return { ...base, x: p.x + lx * faixa, y: p.y, z: p.z + lz * faixa, rumo: p.rumo, zaeon: true, pose: "moto", moto: { vel: MOV.moto * ritmo, curva: 0.3 } };
    }
    const ponto = roteiroMoto(b, agente, i)[0]!.p, fim = noCircuito(b.evento, (corrida / MOV.corridaVolta) * 2 * Math.PI * 330 * ritmo);
    const v2 = viagem(fim, ponto, flags, `${agente}|${i}|corrida`, preciso), k2 = kc - corrida;
    if (k2 < v2.dur) { const p = v2.em(k2 / v2.dur); return { ...base, x: p.x, y: p.y, z: p.z, rumo: p.rumo, zaeon: naZaeon(p), pose: "moto", moto: { vel: MOV.moto, curva: 0 } }; }
    return paradoPerto(base, ponto, agente, i, t);
  }
  // MOTO (passeio): voa de lugar em lugar e fica um tempo em cada (andando por ali)
  if (b.atividade === "moto") {
    let de: P3 = ant, k = t;
    for (const [j, par] of roteiroMoto(b, agente, i).entries()) {
      const v = viagem(de, par.p, { ...flags, mochila: false }, `${agente}|${i}|m${j}`, preciso);
      if (k < v.dur) { const p = v.em(k / v.dur); return { ...base, x: p.x, y: p.y, z: p.z, rumo: p.rumo, zaeon: naZaeon(p), pose: "moto", moto: { vel: MOV.moto, curva: 0 } }; }
      k -= v.dur;
      if (k < par.fica) return paradoPerto(base, par.p, agente, i * 10 + j, k);
      k -= par.fica; de = par.p;
    }
    return paradoPerto(base, de as Ponto, agente, i, k);
  }
  // ANDAR pela Zaeon: de ponto em ponto (a pé; longe, de mochila), parando pra olhar
  if (b.atividade === "andar") {
    let de: P3 = ant, k = t;
    for (const [j, p] of roteiroAndar(b, agente, i).entries()) {
      const longe = Math.hypot(p.x - de.x, p.z - de.z) > 120 || Math.abs(de.y - p.y) > 1;   // perto: a pé; longe: de mochila
      const v = viagem(de, p, longe ? flags : { ...flags, mochila: false }, `${agente}|${i}|a${j}`, preciso);
      if (k < v.dur) { const q = v.em(k / v.dur); return { ...base, x: q.x, y: q.y, z: q.z, rumo: q.rumo, zaeon: true, pose: v.modo === "mochila" ? "mochila" : v.modo === "moto" ? "moto" : "andando", moto: v.modo === "moto" ? { vel: MOV.moto, curva: 0 } : null }; }
      k -= v.dur;
      const fica = entre(acasoDe("fica", agente, i, j), 120, 360);
      if (k < fica) return { ...base, x: p.x, y: p.y, z: p.z, rumo: entre(acasoDe("olha", agente, i, j), 0, 6.28), zaeon: true, pose: "parado" };
      k -= fica; de = p;
    }
    return { ...base, x: de.x, y: de.y, z: de.z, rumo: 0, zaeon: true, pose: "parado" };
  }
  return { ...base, x: ant.x, y: ant.y, z: ant.z, rumo: 0, zaeon: naZaeon(ant), pose: "parado" };
}
/** parado num lugar visitado (de pé, num ponto em volta dele — cada um no seu canto) */
function paradoPerto(base: Omit<EstadoIA, "x" | "y" | "z" | "rumo" | "zaeon" | "pose">, p: P3, agente: string, chave: number, _k: number): EstadoIA {
  const r = acasoDe("perto", agente, chave), a = r() * Math.PI * 2, d = entre(r, 2, 9);
  return { ...base, x: p.x + Math.cos(a) * d, y: p.y, z: p.z + Math.sin(a) * d, rumo: a + Math.PI, zaeon: naZaeon(p), pose: "parado" };
}
