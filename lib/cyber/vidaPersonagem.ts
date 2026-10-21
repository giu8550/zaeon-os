/**
 * Cyberespaço — a VIDA PRÓPRIA dos personagens na cidadela Zaeon (PURO, sem three nem rede). É o "harness" de
 * comportamento: sem conversa (ainda), só o personagem vivendo como gente — trabalha numa estação dos agentes da capela
 * (interagindo com a tela, como os jogadores na base), e depois sai: passeia pela praça, anda de moto em volta da
 * ilha, dança no lounge, fica olhando um telão, sobe num mirante e medita… e volta a trabalhar. O trabalho é nas
 * ESTAÇÕES DOS AGENTES (o anel de terminais em volta do pátio da capela — components/cyber/EstacoesAgentes).
 *
 * A AGENDA é uma função do RELÓGIO (segundos desde uma época fixa) e de uma semente: todo cliente calcula a mesma
 * agenda e vê o personagem no mesmo lugar, fazendo a mesma coisa — sem servidor, sem rede (como os droids
 * observadores). Cada BLOCO = andar até um lugar (a rota a pé de lib/cyber/caminhos) + ficar lá fazendo a atividade.
 * A sequência é aleatória (semente por bloco), sem repetir a atividade nem o lugar, com o trabalho voltando sempre.
 * Os LUGARES são de quem chega primeiro: um personagem nunca escolhe um lugar que outro (antes dele na lista
 * PERFIS_VIDA) vai estar ocupando no mesmo horário — cabem muitos personagens nas mesmas 8 estações. A agenda
 * RECOMEÇA todo dia às 04:00 de Brasília (madrugada): nunca precisa ser calculada desde a época.
 * Coordenadas LOCAIS da ilha; a altura é acima do piso da ilha.
 */
import { aleatorioComSemente } from "./audio";
import { CIDADE, ESTACOES, alturaNaCidade, daSala, estacoesLocais, mundo, rotDaSala, rumoDaPista } from "./ceu";
import { MIRANTES, MIRANTES_ESTACAO, MIRANTES_PIRAMIDE, TELOES } from "./terra";
import { POIS, marcoNav } from "./landmarks";
import { alturaEm, deEscada } from "./nav";
import { pontoNaRota, rotaAPe, comprimento } from "./caminhos";
import type { P2 } from "./colisao";

export type Atividade = "trabalhar" | "passear" | "moto" | "dancar" | "observar" | "meditar" | "estudar";
/** um lugar da agenda: onde ela CHEGA andando (`pos`, local) e pra onde fica virada (`rumo`, facing) */
export type Lugar = { id: string; atividade: Atividade; pos: P2; rumo: number; mirante?: number;
  /** numa SALA DE ESTUDO (fora da central): de lá pra outra sala vai-se de MOTO (a A* não cobre as plataformas) */ sala?: SalaDeEstudo };
/** as salas onde mora quem não é da cidadela (a pista do lounge também é sala: os dois grupos dançam lá) */
export type SalaDeEstudo = "biblioteca" | "jardim" | "lounge";

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
  estudar: { fica: [180, 360], peso: 3 },
};

const telaoAFrente = (i: number, d: number) => { const t = TELOES[i]!; return { x: t.x + Math.sin(t.rot) * d, z: t.z + Math.cos(t.rot) * d, rumo: t.rot + Math.PI }; };
const marcoDoMirante = (i: number) => { const poi = POIS.find((p) => p.id === (i === 0 ? "zaeon" : `mirante-${i}`)); return poi ? marcoNav(poi) : null; };
/** o pé da escada da pirâmide do mirante (local) */
function peDoMirante(i: number): P2 {
  const mn = marcoDoMirante(i)!, w = deEscada(mn, mn.nav.bordaR + mn.nav.escada.comprimento + 2.5, 0);
  return { x: w.x - CIDADE.centro.x, z: w.z - CIDADE.centro.z };
}
/** a moto da Nina: estacionada AO LADO do lote da Zaeon (local) */
export const VAGA_DA_NINA: P2 & { rumo: number } = { x: -60, z: -92, rumo: Math.atan2(60, 92) };

/** o PERFIL de vida de cada personagem: a semente da agenda, a vaga da moto dele e um deslocamento de lado (m) nos
 *  lugares de todos (telão, praça, mirante). A ORDEM da lista é a prioridade: quem vem antes escolhe o lugar primeiro */
export type PerfilVida = { id: string; semente: number; lado: number; vaga: P2 & { rumo: number };
  /** onde mora: na CIDADELA (estações, telões, mirantes, praça, moto em volta da ilha) ou nas SALAS DE ESTUDO (estuda,
   *  passeia e dança nelas, indo de uma pra outra de moto) — pedido do dono (out/2026) */ casa?: "cidadela" | "salas" };
export const PERFIS_VIDA: Readonly<Record<string, PerfilVida>> = {
  nina: { id: "nina", semente: 11, lado: -2.2, vaga: VAGA_DA_NINA },
  aura: { id: "aura", semente: 23, lado: 2.2, vaga: { x: -50, z: -100, rumo: Math.atan2(50, 100) } },
  examiner: { id: "examiner", semente: 53, lado: 4.4, vaga: { x: -30, z: -116, rumo: Math.atan2(30, 116) } },
  zenita: { id: "zenita", semente: 61, lado: -2.2, vaga: { x: -20, z: -124, rumo: Math.atan2(20, 124) } },
  scholar: { id: "scholar", semente: 79, lado: 2.2, vaga: { x: 0, z: -140, rumo: Math.atan2(0, 140) } },
  zaeon: { id: "zaeon", semente: 83, lado: -2.2, vaga: { x: -70, z: -84, rumo: Math.atan2(70, 84) } },
  enfermagem: { id: "enfermagem", semente: 97, lado: 2.2, vaga: { x: -90, z: -68, rumo: Math.atan2(90, 68) } },
  medicina: { id: "medicina", semente: 101, lado: -2.2, vaga: { x: -100, z: -60, rumo: Math.atan2(100, 60) } },
};

/** onde o operador fica numa estação (no referencial dela: +z = rumo ao coração; o console fica em z −0,95) */
export const OPERADOR_Z = 1.25;
/** o estrado das estações (m acima do piso) */
export const ALTURA_ESTRADO = 0.24;

/** lugares numa SALA (referencial dela: [x, z, rumo]) → local da ilha */
function noSala(sala: "biblioteca" | "jardim", atividade: Atividade, pts: readonly (readonly [number, number, number])[]): Lugar[] {
  const s = CIDADE.salas[sala], r = rotDaSala(s);
  return pts.map(([x, z, rumo], i) => ({ id: `${sala}-${atividade}-${i}`, atividade, pos: daSala(s, x, z), rumo: r + rumo, sala }));
}

/** os LUGARES da cidadela e das salas de estudo */
export const LUGARES: readonly Lugar[] = [
  // as 8 ESTAÇÕES DOS AGENTES: o operador em pé no estrado, na frente do console, virado pras telas
  ...estacoesLocais().map((e, i) => {
    const s = Math.sin(e.rot), c = Math.cos(e.rot), lz = OPERADOR_Z;
    return { id: `estacao-${i}`, atividade: "trabalhar" as const, pos: { x: e.x + lz * s, z: e.z + lz * c }, rumo: e.rot + Math.PI };
  }),
  // a pista do lounge (lá em cima)
  ...[[-387, -4], [-383, 3], [-389, 5], [-381, -6]].map(([x, z], i) => ({ id: `pista-${i}`, atividade: "dancar" as const, pos: { x: x!, z: z! }, rumo: rumoDaPista(), sala: "lounge" as const })),
  // de frente pros telões dos mirantes 1–3 (o 0 é a Recepção, a casa da Zaeon)
  ...MIRANTES_ESTACAO.map((m, i) => { const f = telaoAFrente(i, 16); return { id: `telao-${m.id}`, atividade: "observar" as const, pos: { x: f.x, z: f.z }, rumo: f.rumo }; }),
  // meditar no alto das pirâmides dos mirantes 1–3 (chega no pé da escada; a subida é parte da atividade)
  ...MIRANTES_PIRAMIDE.filter((m) => m.id !== 0).map((m) => m.id).map((i) => { const p = peDoMirante(i), m = MIRANTES[i]!; return { id: `mirante-${i}`, atividade: "meditar" as const, pos: p, rumo: Math.atan2(m.x - p.x, m.z - p.z), mirante: i }; }),
  // passeios pela praça
  ...[[110, 20], [60, -140], [-150, 40], [20, 160], [-60, -180], [170, -60], [-120, -60], [140, 90], [90, -95], [-35, 115], [185, 15], [-175, -15], [30, 180], [-95, 150], [110, -160], [-10, -205]].map(([x, z], i) => ({ id: `praca-${i}`, atividade: "passear" as const, pos: { x: x!, z: z! }, rumo: Math.atan2(-x!, -z!) })),
  // as SALAS DE ESTUDO (biblioteca e jardim — de quem mora nelas): ESTUDAR sentado nos pufes (os das mesas de leitura,
  // os do espelho d'água) e PASSEAR por dentro; referencial da sala → local da ilha (`daSala`; o rumo soma o giro dela)
  ...noSala("biblioteca", "estudar", [[-7, -12, 0], [-7, -8, Math.PI], [7, -12, 0], [7, -8, Math.PI], [-7, 0, 0], [-7, 4, Math.PI], [7, 0, 0], [7, 4, Math.PI]]),
  ...noSala("biblioteca", "passear", [[0, 20, Math.PI], [-26, -6, Math.PI / 2], [26, -6, -Math.PI / 2]]),
  ...noSala("jardim", "estudar", [1.15, 1.9, 2.65, 3.63, 4.38, 5.13].map((a) => [Math.sin(a) * 10.5, -8 + Math.cos(a) * 10.5, a + Math.PI] as [number, number, number])),
  ...noSala("jardim", "passear", [[0, 16, Math.PI], [-20, -22, Math.PI * 0.75], [20, -22, -Math.PI * 0.75]]),
  // a moto (a posição de verdade é a VAGA de cada um — `posNoLugar`)
  { id: "moto", atividade: "moto", pos: { x: VAGA_DA_NINA.x, z: VAGA_DA_NINA.z }, rumo: VAGA_DA_NINA.rumo },
];

/** onde cada um mora (sem `casa` = a cidadela) */
export const casaDe = (p: PerfilVida) => p.casa ?? "cidadela";
/** o lugar serve pra quem mora em `casa`? A cidadela não entra nas salas de estudo (só na pista do lounge, que é de
 *  todos); quem mora nas salas fica SÓ nelas */
export const lugarDaCasa = (l: Lugar, casa: "cidadela" | "salas") => (casa === "salas" ? !!l.sala : !l.sala || l.sala === "lounge");
/** as atividades de quem mora nas salas (a moto é o caminho entre elas, não um passeio) */
const ATIVIDADES_SALAS: readonly Atividade[] = ["estudar", "passear", "dancar"];
/** de uma sala pra OUTRA: de moto (as plataformas ficam fora da central e a A* não chega nelas) */
const deMotoEntre = (de: number, para: number) => { const a = LUGARES[de]!.sala, b = LUGARES[para]!.sala; return !!a && !!b && a !== b; };
/** o VOO de uma sala pra outra (local; y acima do piso): uma curva que CONTORNA a capela (o ponto de controle vai pra
 *  fora quando a reta passaria perto do centro), subindo ~30 m no meio do caminho */
export function vooEntreSalas(a: P2, b: P2): { ctrl: P2; len: number } {
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, n = Math.hypot(mid.x, mid.z);
  let ctrl = mid;
  if (n < 320) {   // empurra pro lado (perpendicular à reta) até o meio da curva passar a ~300 m do centro
    const vx = b.x - a.x, vz = b.z - a.z, m = Math.hypot(vx, vz) || 1, px = -vz / m, pz = vx / m, d = mid.x * px + mid.z * pz, lado = d < 0 ? -1 : 1;
    const k = 2 * Math.max(0, 300 - Math.abs(d)); ctrl = { x: mid.x + px * lado * k, z: mid.z + pz * lado * k };
  }
  return { ctrl, len: Math.hypot(ctrl.x - a.x, ctrl.z - a.z) + Math.hypot(b.x - ctrl.x, b.z - ctrl.z) };
}
export const VEL_MOTO_SALAS = 24;
function motoEntreSalas(a: P2, b: P2, u: number, dur: number): NonNullable<Estado["moto"]> {
  const { ctrl, len } = vooEntreSalas(a, b), s = u * u * (3 - 2 * u), q = (t: number) => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * ctrl.x + t * t * b.x, z: (1 - t) ** 2 * a.z + 2 * (1 - t) * t * ctrl.z + t * t * b.z });
  const p = q(s), p2 = q(Math.min(1, s + 0.01)), p1 = q(Math.max(0, s - 0.01)), ya = alturaLocal(a), yb = alturaLocal(b);
  return { x: p.x, y: ya + (yb - ya) * s + 4 * s * (1 - s) * 30, z: p.z, rumo: Math.atan2(p2.x - p1.x, p2.z - p1.z), voando: u > 0.04 && u < 0.96, vel: len / Math.max(1, dur), curva: 0 };
}

/** o lugar é disputado? (a moto não: cada um tem a sua vaga) */
export const disputado = (i: number) => LUGARES[i]!.atividade !== "moto";
/** onde ESTE personagem fica no lugar: a moto na vaga dele; nos lugares de todos (telão, praça, pé do mirante),
 *  deslocado de lado; estação e pista, no ponto exato */
export function posNoLugar(i: number, perfil: PerfilVida): P2 {
  const l = LUGARES[i]!;
  if (l.atividade === "moto") return { x: perfil.vaga.x, z: perfil.vaga.z };
  if (l.atividade === "trabalhar" || l.atividade === "dancar") return l.pos;
  return { x: l.pos.x + Math.cos(l.rumo) * perfil.lado, z: l.pos.z - Math.sin(l.rumo) * perfil.lado };   // a direita de quem olha pro rumo
}

export type Bloco = { dia: number; n: number; ini: number; atividade: Atividade; lugar: number; de: number; viagem: number; fim: number };

/** a virada do dia da agenda: 07:00 UTC = 04:00 em Brasília */
export const VIRADA = 7 * 3600;
export const diaDe = (t: number) => Math.floor((t - EPOCA - VIRADA) / 86400);
const inicioDoDia = (d: number) => EPOCA + VIRADA + d * 86400;
const ORDEM = () => Object.values(PERFIS_VIDA);
/** `livre(lugar, de, ate)`: o lugar está livre nesse intervalo (os outros personagens não estão lá)? */
export type Livre = (lugar: number, de: number, ate: number) => boolean;

/** sorteia o próximo bloco a partir do anterior (determinístico pela semente, pelo dia e pelo número do bloco); com
 *  `livre`, pula os lugares que outro personagem vai estar ocupando */
export function proximoBloco(ant: Bloco, perfil: PerfilVida, livre?: Livre): Bloco {
  const n = ant.n + 1, r = aleatorioComSemente((perfil.semente * 7919 + n * 104729 + ant.dia * 15485863) >>> 0);
  const casa = casaDe(perfil), principal: Atividade = casa === "salas" ? "estudar" : "trabalhar";   // (nas salas, o "trabalho" é estudar)
  const semTrabalhar = ant.atividade !== principal && ant.n > 0 && r() < 0.55;   // volta pro trabalho com frequência
  let atividade: Atividade = principal;
  if (!semTrabalhar) {
    const opcoes = (Object.keys(ATIVIDADES) as Atividade[]).filter((a) => a !== ant.atividade && (casa === "salas" ? ATIVIDADES_SALAS.includes(a) : a !== "estudar"));
    const total = opcoes.reduce((s, a) => s + ATIVIDADES[a].peso, 0); let x = r() * total;
    atividade = opcoes.find((a) => (x -= ATIVIDADES[a].peso) < 0) ?? opcoes[0]!;
  }
  if (atividade === ant.atividade) atividade = "passear";
  const sorteio = r(), [fmin, fmax] = ATIVIDADES[atividade].fica, fica = fmin + r() * (fmax - fmin);
  const ini = ant.fim, a = posNoLugar(ant.lugar, perfil);
  const montar = (lugar: number, atv: Atividade): Bloco => {
    const b = posNoLugar(lugar, perfil), viagem = deMotoEntre(ant.lugar, lugar) ? 8 + vooEntreSalas(a, b).len / VEL_MOTO_SALAS : Math.max(6, (Math.hypot(b.x - a.x, b.z - a.z) * 1.15) / VEL_A_PE);
    return { dia: ant.dia, n, ini, atividade: atv, lugar, de: ant.lugar, viagem, fim: ini + viagem + fica };
  };
  // os lugares da atividade, a partir de um sorteado (dá a volta); o 1º livre ganha. Tudo tomado → passeia num livre
  for (const atv of atividade === "passear" ? ["passear" as const] : [atividade, "passear" as const]) {
    const cand = LUGARES.map((l, i) => ({ l, i })).filter(({ l, i }) => l.atividade === atv && i !== ant.lugar && lugarDaCasa(l, casa)).map(({ i }) => i);
    const s0 = Math.floor(sorteio * cand.length);
    for (let k = 0; k < cand.length; k++) {
      const b = montar(cand[(s0 + k) % cand.length]!, atv);
      if (!livre || !disputado(b.lugar) || livre(b.lugar, b.ini + b.viagem - 2, b.fim + 2)) return b;
    }
  }
  return montar(LUGARES.findIndex((l, i) => l.atividade === "passear" && i !== ant.lugar && lugarDaCasa(l, casa)), "passear");
}

/** as agendas do dia de cada personagem (memória: só o dia atual e o anterior) */
const agendas = new Map<string, Bloco[]>();
function agendaAte(perfil: PerfilVida, dia: number, ate: number): Bloco[] {
  const chave = `${perfil.id}:${dia}`; let ag = agendas.get(chave);
  const ordem = ORDEM(), k = ordem.findIndex((p) => p.id === perfil.id), antes = k < 0 ? ordem : ordem.slice(0, k);
  if (!ag) {
    for (const c of agendas.keys()) if (Number(c.slice(c.lastIndexOf(":") + 1)) < dia - 1) agendas.delete(c);
    const i0 = inicioDoDia(dia), nasSalas = casaDe(perfil) === "salas";
    // começa o dia na estação (cidadela) ou num pufe de estudo (salas) — cada um no seu
    const inicio = LUGARES.map((l, i) => ({ l, i })).filter(({ l }) => (nasSalas ? l.atividade === "estudar" : l.atividade === "trabalhar")).map(({ i }) => i);
    const est = inicio[Math.max(0, k) % inicio.length]!;
    ag = [{ dia, n: 0, ini: i0 - 1, atividade: nasSalas ? "estudar" : "trabalhar", lugar: est, de: est, viagem: 0, fim: i0 }];
    agendas.set(chave, ag);
  }
  const livre: Livre = (lugar, de, a) => antes.every((q) => {
    const bq = agendaAte(q, dia, a);
    for (let j = bq.length - 1; j >= 0 && bq[j]!.fim > de; j--) { const x = bq[j]!; if (x.lugar === lugar && x.ini + x.viagem < a) return false; }
    return true;
  });
  while (ag[ag.length - 1]!.fim <= ate) ag.push(proximoBloco(ag[ag.length - 1]!, perfil, livre));
  return ag;
}

/** o bloco em que o relógio `t` (s, UTC) cai (`cache` = o bloco de antes, se ainda valer) */
export function blocoEm(t: number, perfil: PerfilVida, cache?: Bloco | null): Bloco {
  const dia = diaDe(t);
  if (cache && cache.dia === dia && cache.ini <= t && t < cache.fim) return cache;
  const ag = agendaAte(perfil, dia, t);
  let lo = 0, hi = ag.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (ag[m]!.fim <= t) lo = m + 1; else hi = m; }
  return ag[lo]!;
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
/** a rota a pé entre dois lugares, pra este personagem (cacheada) */
export function rotaEntre(de: number, para: number, perfil: PerfilVida): P2[] {
  const k = `${perfil.id}:${de}>${para}`; let r = rotas.get(k);
  if (!r) { const a = posNoLugar(de, perfil), b = posNoLugar(para, perfil); r = rotaAPe(a, b) ?? [a, b]; rotas.set(k, r); }
  return r;
}

/** a altura do chão (acima do piso da ilha) num ponto local — o lounge, a escada e o estrado das estações inclusos */
const ESTACOES_L = estacoesLocais();
const alturaLocal = (p: P2) => alturaNaCidade(mundo(p)) + (ESTACOES_L.some((e) => Math.hypot(p.x - e.x, p.z - e.z) <= ESTACOES.platR) ? ALTURA_ESTRADO : 0);

/** o VOO de moto (y acima do piso): sobe, sai pela borda, dá a volta na ilha por fora, volta e pousa na vaga */
export const VOO_DA_MOTO = { sobe: 6, sai: 9, raio: 275, altura: 55 } as const;
export function motoEm(k: number, dur: number, vaga: P2 & { rumo: number } = VAGA_DA_NINA): NonNullable<Estado["moto"]> {
  const V = VOO_DA_MOTO, v0 = vaga, a0 = Math.atan2(v0.z, v0.x), borda = { x: Math.cos(a0) * V.raio, z: Math.sin(a0) * V.raio };
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
function noMirante(i: number, k: number, dur: number, pe: P2, lado: number): { pos: P2; y: number; rumo: number; andando: boolean; meditando: number } {
  const mn = marcoDoMirante(i)!, c = CIDADE.centro;
  const local = (w: P2) => ({ x: w.x - c.x, z: w.z - c.z });
  // o caminho: o pé da escada (onde ela chegou andando) → o topo da escada → o lugar dela no salão (lado a lado)
  const topo = local(deEscada(mn, mn.nav.bordaR - 0.3, 0)), senta = local(deEscada(mn, 0, lado * 1.6));
  const d1 = Math.hypot(topo.x - pe.x, topo.z - pe.z), d2 = Math.hypot(senta.x - topo.x, senta.z - topo.z), L = d1 + d2;
  const ponto = (s: number): P2 => s <= d1 ? { x: pe.x + (topo.x - pe.x) * (s / d1), z: pe.z + (topo.z - pe.z) * (s / d1) } : { x: topo.x + (senta.x - topo.x) * ((s - d1) / d2), z: topo.z + (senta.z - topo.z) * ((s - d1) / d2) };
  const alt = (p: P2) => alturaEm(mn, { x: p.x + c.x, z: p.z + c.z });
  const fora = mn.nav.escada.dir + Math.PI, olhaFora = Math.atan2(Math.cos(fora), Math.sin(fora));   // de costas pra escada: olhando a vista
  const sobe = Math.min(MEDITA.sobe, dur / 3);
  if (k < sobe) { const p = ponto((L * k) / sobe); return { pos: p, y: alt(p), rumo: olhaFora, andando: true, meditando: 0 }; }
  if (k > dur - sobe) { const p = ponto(L * (1 - (k - (dur - sobe)) / sobe)); return { pos: p, y: alt(p), rumo: olhaFora + Math.PI, andando: true, meditando: 0 }; }
  return { pos: senta, y: alt(senta), rumo: olhaFora, andando: false, meditando: 1 };
}

/** o ESTADO no relógio `t` */
export function estadoEm(t: number, perfil: PerfilVida, cache?: Bloco | null): Estado & { bloco: Bloco } {
  const b = blocoEm(t, perfil, cache), lugar = LUGARES[b.lugar]!, k = t - b.ini, aqui = posNoLugar(b.lugar, perfil);
  const base = { atividade: b.atividade, lugar: lugar.id, bloco: b, sentado: 0, danca: 0, meditando: 0, moto: null };
  if (k < b.viagem && deMotoEntre(b.de, b.lugar)) {   // de uma sala de estudo pra outra: de MOTO, contornando a capela
    const m = motoEntreSalas(posNoLugar(b.de, perfil), aqui, k / b.viagem, b.viagem);
    return { ...base, fase: "andando", pos: { x: m.x, z: m.z }, y: m.y, rumo: m.rumo, andando: false, moto: m };
  }
  if (k < b.viagem) {   // andando até lá
    const r = rotaEntre(b.de, b.lugar, perfil), L = comprimento(r), p = pontoNaRota(r, (L * k) / b.viagem);
    return { ...base, fase: "andando", pos: { x: p.x, z: p.z }, y: alturaLocal(p), rumo: p.rumo, andando: true };
  }
  const kf = k - b.viagem, fica = b.fim - b.ini - b.viagem;
  if (b.atividade === "moto") {
    const m = motoEm(kf, fica, perfil.vaga);
    return { ...base, fase: "ficando", pos: { x: m.x, z: m.z }, y: m.y, rumo: m.rumo, andando: false, moto: m };
  }
  if (b.atividade === "meditar" && lugar.mirante !== undefined) {
    const m = noMirante(lugar.mirante, kf, fica, aqui, perfil.lado);
    return { ...base, fase: "ficando", pos: m.pos, y: m.y, rumo: m.rumo, andando: m.andando, meditando: m.meditando };
  }
  return {
    ...base, fase: "ficando", pos: aqui, y: alturaLocal(aqui), rumo: lugar.rumo, andando: false,
    sentado: b.atividade === "trabalhar" || b.atividade === "estudar" ? 1 : 0, danca: b.atividade === "dancar" ? 1 : 0,
  };
}
